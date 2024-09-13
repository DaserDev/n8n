import { GlobalConfig } from '@n8n/config';
import type {
	FindManyOptions,
	FindOneOptions,
	FindOperator,
	FindOptionsWhere,
	SelectQueryBuilder,
} from '@n8n/typeorm';
import {
	Brackets,
	DataSource,
	In,
	IsNull,
	LessThan,
	LessThanOrEqual,
	MoreThanOrEqual,
	Not,
	Raw,
	Repository,
} from '@n8n/typeorm';
import { DateUtils } from '@n8n/typeorm/util/DateUtils';
import { parse, stringify } from 'flatted';
import pick from 'lodash/pick';
import { BinaryDataService } from 'n8n-core';
import {
	ExecutionCancelledError,
	ErrorReporterProxy as ErrorReporter,
	ApplicationError,
} from 'n8n-workflow';
import type {
	AnnotationVote,
	ExecutionStatus,
	ExecutionSummary,
	IRunExecutionData,
} from 'n8n-workflow';
import { Service } from 'typedi';

import config from '@/config';
import { AnnotationTagEntity } from '@/databases/entities/annotation-tag-entity';
import { AnnotationTagMapping } from '@/databases/entities/annotation-tag-mapping';
import { ExecutionAnnotation } from '@/databases/entities/execution-annotation';
import { PostgresLiveRowsRetrievalError } from '@/errors/postgres-live-rows-retrieval.error';
import type { ExecutionSummaries } from '@/executions/execution.types';
import type {
	CreateExecutionPayload,
	IExecutionBase,
	IExecutionFlattedDb,
	IExecutionResponse,
} from '@/interfaces';
import { Logger } from '@/logger';
import { separate } from '@/utils';

import { ExecutionDataRepository } from './execution-data.repository';
import type { ExecutionData } from '../entities/execution-data';
import { ExecutionEntity } from '../entities/execution-entity';
import { ExecutionMetadata } from '../entities/execution-metadata';

export interface IGetExecutionsQueryFilter {
	id?: FindOperator<string> | string;
	finished?: boolean;
	mode?: string;
	retryOf?: string;
	retrySuccessId?: string;
	status?: ExecutionStatus[];
	workflowId?: string;
	waitTill?: FindOperator<any> | boolean;
	metadata?: Array<{ key: string; value: string }>;
	startedAfter?: string;
	startedBefore?: string;
}

function parseFiltersToQueryBuilder(
	qb: SelectQueryBuilder<ExecutionEntity>,
	filters?: IGetExecutionsQueryFilter,
) {
	if (filters?.status) {
		qb.andWhere('execution.status IN (:...workflowStatus)', {
			workflowStatus: filters.status,
		});
	}
	if (filters?.finished) {
		qb.andWhere({ finished: filters.finished });
	}
	if (filters?.metadata) {
		qb.leftJoin(ExecutionMetadata, 'md', 'md.executionId = execution.id');
		for (const md of filters.metadata) {
			qb.andWhere('md.key = :key AND md.value = :value', md);
		}
	}
	if (filters?.startedAfter) {
		qb.andWhere({
			startedAt: MoreThanOrEqual(
				DateUtils.mixedDateToUtcDatetimeString(new Date(filters.startedAfter)),
			),
		});
	}
	if (filters?.startedBefore) {
		qb.andWhere({
			startedAt: LessThanOrEqual(
				DateUtils.mixedDateToUtcDatetimeString(new Date(filters.startedBefore)),
			),
		});
	}
	if (filters?.workflowId) {
		qb.andWhere({
			workflowId: filters.workflowId,
		});
	}
}

const lessThanOrEqual = (date: string): unknown => {
	return LessThanOrEqual(DateUtils.mixedDateToUtcDatetimeString(new Date(date)));
};

const moreThanOrEqual = (date: string): unknown => {
	return MoreThanOrEqual(DateUtils.mixedDateToUtcDatetimeString(new Date(date)));
};

@Service()
export class ExecutionRepository extends Repository<ExecutionEntity> {
	private hardDeletionBatchSize = 100;

	constructor(
		dataSource: DataSource,
		private readonly globalConfig: GlobalConfig,
		private readonly logger: Logger,
		private readonly executionDataRepository: ExecutionDataRepository,
		private readonly binaryDataService: BinaryDataService,
	) {
		super(ExecutionEntity, dataSource.manager);
	}

	async findMultipleExecutions(
		queryParams: FindManyOptions<ExecutionEntity>,
		options?: {
			unflattenData: true;
			includeData?: true;
		},
	): Promise<IExecutionResponse[]>;
	async findMultipleExecutions(
		queryParams: FindManyOptions<ExecutionEntity>,
		options?: {
			unflattenData?: false | undefined;
			includeData?: true;
		},
	): Promise<IExecutionFlattedDb[]>;
	async findMultipleExecutions(
		queryParams: FindManyOptions<ExecutionEntity>,
		options?: {
			unflattenData?: boolean;
			includeData?: boolean;
		},
	): Promise<IExecutionBase[]>;
	async findMultipleExecutions(
		queryParams: FindManyOptions<ExecutionEntity>,
		options?: {
			unflattenData?: boolean;
			includeData?: boolean;
		},
	): Promise<IExecutionFlattedDb[] | IExecutionResponse[] | IExecutionBase[]> {
		if (options?.includeData) {
			if (!queryParams.relations) {
				queryParams.relations = [];
			}
			(queryParams.relations as string[]).push('executionData', 'metadata');
		}

		const executions = await this.find(queryParams);

		if (options?.includeData && options?.unflattenData) {
			const [valid, invalid] = separate(executions, (e) => e.executionData !== null);
			this.reportInvalidExecutions(invalid);
			return valid.map((execution) => {
				const { executionData, metadata, ...rest } = execution;
				return {
					...rest,
					data: parse(executionData.data) as IRunExecutionData,
					workflowData: executionData.workflowData,
					customData: Object.fromEntries(metadata.map((m) => [m.key, m.value])),
				} as IExecutionResponse;
			});
		} else if (options?.includeData) {
			const [valid, invalid] = separate(executions, (e) => e.executionData !== null);
			this.reportInvalidExecutions(invalid);
			return valid.map((execution) => {
				const { executionData, metadata, ...rest } = execution;
				return {
					...rest,
					data: execution.executionData.data,
					workflowData: execution.executionData.workflowData,
					customData: Object.fromEntries(metadata.map((m) => [m.key, m.value])),
				} as IExecutionFlattedDb;
			});
		}

		return executions.map((execution) => {
			const { executionData, ...rest } = execution;
			return rest;
		});
	}

	reportInvalidExecutions(executions: ExecutionEntity[]) {
		if (executions.length === 0) return;

		ErrorReporter.error(
			new ApplicationError('Found executions without executionData', {
				extra: { executionIds: executions.map(({ id }) => id) },
			}),
		);
	}

	private serializeAnnotation(annotation: ExecutionEntity['annotation']) {
		if (!annotation) return null;

		const { id, vote, tags } = annotation;
		return {
			id,
			vote,
			tags: tags?.map((tag) => pick(tag, ['id', 'name'])) ?? [],
		};
	}

	async findSingleExecution(
		id: string,
		options?: {
			includeData: true;
			includeAnnotation?: boolean;
			unflattenData: true;
			where?: FindOptionsWhere<ExecutionEntity>;
		},
	): Promise<IExecutionResponse | undefined>;
	async findSingleExecution(
		id: string,
		options?: {
			includeData: true;
			includeAnnotation?: boolean;
			unflattenData?: false | undefined;
			where?: FindOptionsWhere<ExecutionEntity>;
		},
	): Promise<IExecutionFlattedDb | undefined>;
	async findSingleExecution(
		id: string,
		options?: {
			includeData?: boolean;
			includeAnnotation?: boolean;
			unflattenData?: boolean;
			where?: FindOptionsWhere<ExecutionEntity>;
		},
	): Promise<IExecutionBase | undefined>;
	async findSingleExecution(
		id: string,
		options?: {
			includeData?: boolean;
			includeAnnotation?: boolean;
			unflattenData?: boolean;
			where?: FindOptionsWhere<ExecutionEntity>;
		},
	): Promise<IExecutionFlattedDb | IExecutionResponse | IExecutionBase | undefined> {
		const findOptions: FindOneOptions<ExecutionEntity> = {
			where: {
				id,
				...options?.where,
			},
		};
		if (options?.includeData) {
			findOptions.relations = { executionData: true, metadata: true };
		}

		if (options?.includeAnnotation) {
			findOptions.relations = {
				...findOptions.relations,
				annotation: {
					tags: true,
				},
			};
		}

		const execution = await this.findOne(findOptions);

		if (!execution) {
			return undefined;
		}

		const { executionData, metadata, annotation, ...rest } = execution;
		const serializedAnnotation = this.serializeAnnotation(annotation);

		return {
			...rest,
			...(options?.includeData && {
				data: options?.unflattenData
					? (parse(executionData.data) as IRunExecutionData)
					: executionData.data,
				workflowData: executionData?.workflowData,
				customData: Object.fromEntries(metadata.map((m) => [m.key, m.value])),
			}),
			...(options?.includeAnnotation &&
				serializedAnnotation && { annotation: serializedAnnotation }),
		};
	}

	/**
	 * Insert a new execution and its execution data using a transaction.
	 */
	async createNewExecution(execution: CreateExecutionPayload): Promise<string> {
		const { data, workflowData, ...rest } = execution;
		const { identifiers: inserted } = await this.insert(rest);
		const { id: executionId } = inserted[0] as { id: string };
		const { connections, nodes, name, settings } = workflowData ?? {};
		await this.executionDataRepository.insert({
			executionId,
			workflowData: { connections, nodes, name, settings, id: workflowData.id },
			data: stringify(data),
		});
		return String(executionId);
	}

	async markAsCrashed(executionIds: string | string[]) {
		if (!Array.isArray(executionIds)) executionIds = [executionIds];

		await this.update(
			{ id: In(executionIds) },
			{
				status: 'crashed',
				stoppedAt: new Date(),
			},
		);

		this.logger.info('Marked executions as `crashed`', { executionIds });
	}

	/**
	 * Permanently remove a single execution and its binary data.
	 */
	async hardDelete(ids: { workflowId: string; executionId: string }) {
		return await Promise.all([
			this.delete(ids.executionId),
			this.binaryDataService.deleteMany([ids]),
		]);
	}

	async updateStatus(executionId: string, status: ExecutionStatus) {
		await this.update({ id: executionId }, { status });
	}

	async setRunning(executionId: string) {
		await this.update({ id: executionId }, { status: 'running', startedAt: new Date() });
	}

	async updateExistingExecution(executionId: string, execution: Partial<IExecutionResponse>) {
		// Se isolate startedAt because it must be set when the execution starts and should never change.
		// So we prevent updating it, if it's sent (it usually is and causes problems to executions that
		// are resumed after waiting for some time, as a new startedAt is set)
		const { id, data, workflowId, workflowData, startedAt, customData, ...executionInformation } =
			execution;
		if (Object.keys(executionInformation).length > 0) {
			await this.update({ id: executionId }, executionInformation);
		}

		if (data || workflowData) {
			const executionData: Partial<ExecutionData> = {};
			if (workflowData) {
				executionData.workflowData = workflowData;
			}
			if (data) {
				executionData.data = stringify(data);
			}
			// @ts-ignore
			await this.executionDataRepository.update({ executionId }, executionData);
		}
	}

	async deleteExecutionsByFilter(
		filters: IGetExecutionsQueryFilter | undefined,
		accessibleWorkflowIds: string[],
		deleteConditions: {
			deleteBefore?: Date;
			ids?: string[];
		},
	) {
		if (!deleteConditions?.deleteBefore && !deleteConditions?.ids) {
			throw new ApplicationError(
				'Either "deleteBefore" or "ids" must be present in the request body',
			);
		}

		const query = this.createQueryBuilder('execution')
			.select(['execution.id', 'execution.workflowId'])
			.andWhere('execution.workflowId IN (:...accessibleWorkflowIds)', { accessibleWorkflowIds });

		if (deleteConditions.deleteBefore) {
			// delete executions by date, if user may access the underlying workflows
			query.andWhere('execution.startedAt <= :deleteBefore', {
				deleteBefore: deleteConditions.deleteBefore,
			});
			// Filters are only used when filtering by date
			parseFiltersToQueryBuilder(query, filters);
		} else if (deleteConditions.ids) {
			// delete executions by IDs, if user may access the underlying workflows
			query.andWhere('execution.id IN (:...executionIds)', { executionIds: deleteConditions.ids });
		}

		const executions = await query.getMany();

		if (!executions.length) {
			if (deleteConditions.ids) {
				this.logger.error('Failed to delete an execution due to insufficient permissions', {
					executionIds: deleteConditions.ids,
				});
			}
			return;
		}

		const ids = executions.map(({ id, workflowId }) => ({
			executionId: id,
			workflowId,
		}));

		do {
			// Delete in batches to avoid "SQLITE_ERROR: Expression tree is too large (maximum depth 1000)" error
			const batch = ids.splice(0, this.hardDeletionBatchSize);
			await Promise.all([
				this.delete(batch.map(({ executionId }) => executionId)),
				this.binaryDataService.deleteMany(batch),
			]);
		} while (ids.length > 0);
	}

	async getIdsSince(date: Date) {
		return await this.find({
			select: ['id'],
			where: {
				startedAt: MoreThanOrEqual(DateUtils.mixedDateToUtcDatetimeString(date)),
			},
		}).then((executions) => executions.map(({ id }) => id));
	}

	async softDeletePrunableExecutions() {
		const maxAge = config.getEnv('executions.pruneDataMaxAge'); // in h
		const maxCount = config.getEnv('executions.pruneDataMaxCount');

		// Sub-query to exclude executions having annotations
		const annotatedExecutionsSubQuery = this.manager
			.createQueryBuilder()
			.subQuery()
			.select('annotation.executionId')
			.from(ExecutionAnnotation, 'annotation');

		// Find ids of all executions that were stopped longer that pruneDataMaxAge ago
		const date = new Date();
		date.setHours(date.getHours() - maxAge);

		const toPrune: Array<FindOptionsWhere<ExecutionEntity>> = [
			// date reformatting needed - see https://github.com/typeorm/typeorm/issues/2286
			{ stoppedAt: LessThanOrEqual(DateUtils.mixedDateToUtcDatetimeString(date)) },
		];

		if (maxCount > 0) {
			const executions = await this.createQueryBuilder('execution')
				.select('execution.id')
				.where('execution.id NOT IN ' + annotatedExecutionsSubQuery.getQuery())
				.skip(maxCount)
				.take(1)
				.orderBy('execution.id', 'DESC')
				.getMany();

			if (executions[0]) {
				toPrune.push({ id: LessThanOrEqual(executions[0].id) });
			}
		}

		const [timeBasedWhere, countBasedWhere] = toPrune;

		return await this.createQueryBuilder()
			.update(ExecutionEntity)
			.set({ deletedAt: new Date() })
			.where({
				deletedAt: IsNull(),
				// Only mark executions as deleted if they are in an end state
				status: Not(In(['new', 'running', 'waiting'])),
			})
			// Only mark executions as deleted if they are not annotated
			.andWhere('id NOT IN ' + annotatedExecutionsSubQuery.getQuery())
			.andWhere(
				new Brackets((qb) =>
					countBasedWhere
						? qb.where(timeBasedWhere).orWhere(countBasedWhere)
						: qb.where(timeBasedWhere),
				),
			)
			.execute();
	}

	async hardDeleteSoftDeletedExecutions() {
		const date = new Date();
		date.setHours(date.getHours() - config.getEnv('executions.pruneDataHardDeleteBuffer'));

		const workflowIdsAndExecutionIds = (
			await this.find({
				select: ['workflowId', 'id'],
				where: {
					deletedAt: LessThanOrEqual(DateUtils.mixedDateToUtcDatetimeString(date)),
				},
				take: this.hardDeletionBatchSize,

				/**
				 * @important This ensures soft-deleted executions are included,
				 * else `@DeleteDateColumn()` at `deletedAt` will exclude them.
				 */
				withDeleted: true,
			})
		).map(({ id: executionId, workflowId }) => ({ workflowId, executionId }));

		return workflowIdsAndExecutionIds;
	}

	async deleteByIds(executionIds: string[]) {
		return await this.delete({ id: In(executionIds) });
	}

	async getWaitingExecutions() {
		// Find all the executions which should be triggered in the next 70 seconds
		const waitTill = new Date(Date.now() + 70000);
		const where: FindOptionsWhere<ExecutionEntity> = {
			waitTill: LessThanOrEqual(waitTill),
			status: Not('crashed'),
		};

		const dbType = this.globalConfig.database.type;
		if (dbType === 'sqlite') {
			// This is needed because of issue in TypeORM <> SQLite:
			// https://github.com/typeorm/typeorm/issues/2286
			where.waitTill = LessThanOrEqual(DateUtils.mixedDateToUtcDatetimeString(waitTill));
		}

		return await this.findMultipleExecutions({
			select: ['id', 'waitTill'],
			where,
			order: {
				waitTill: 'ASC',
			},
		});
	}

	async getExecutionsCountForPublicApi(data: {
		limit: number;
		lastId?: string;
		workflowIds?: string[];
		status?: ExecutionStatus;
		excludedWorkflowIds?: string[];
	}): Promise<number> {
		const executions = await this.count({
			where: {
				...(data.lastId && { id: LessThan(data.lastId) }),
				...(data.status && { ...this.getStatusCondition(data.status) }),
				...(data.workflowIds && { workflowId: In(data.workflowIds) }),
				...(data.excludedWorkflowIds && { workflowId: Not(In(data.excludedWorkflowIds)) }),
			},
			take: data.limit,
		});

		return executions;
	}

	private getStatusCondition(status: ExecutionStatus) {
		const condition: Pick<FindOptionsWhere<IExecutionFlattedDb>, 'status'> = {};

		if (status === 'success') {
			condition.status = 'success';
		} else if (status === 'waiting') {
			condition.status = 'waiting';
		} else if (status === 'error') {
			condition.status = In(['error', 'crashed']);
		}

		return condition;
	}

	async getExecutionsForPublicApi(params: {
		limit: number;
		includeData?: boolean;
		lastId?: string;
		workflowIds?: string[];
		status?: ExecutionStatus;
		excludedExecutionsIds?: string[];
	}): Promise<IExecutionBase[]> {
		let where: FindOptionsWhere<IExecutionFlattedDb> = {};

		if (params.lastId && params.excludedExecutionsIds?.length) {
			where.id = Raw((id) => `${id} < :lastId AND ${id} NOT IN (:...excludedExecutionsIds)`, {
				lastId: params.lastId,
				excludedExecutionsIds: params.excludedExecutionsIds,
			});
		} else if (params.lastId) {
			where.id = LessThan(params.lastId);
		} else if (params.excludedExecutionsIds?.length) {
			where.id = Not(In(params.excludedExecutionsIds));
		}

		if (params.status) {
			where = { ...where, ...this.getStatusCondition(params.status) };
		}

		if (params.workflowIds) {
			where = { ...where, workflowId: In(params.workflowIds) };
		}

		return await this.findMultipleExecutions(
			{
				select: [
					'id',
					'mode',
					'retryOf',
					'retrySuccessId',
					'startedAt',
					'stoppedAt',
					'workflowId',
					'waitTill',
					'finished',
				],
				where,
				order: { id: 'DESC' },
				take: params.limit,
				relations: ['executionData'],
			},
			{
				includeData: params.includeData,
				unflattenData: true,
			},
		);
	}

	async getExecutionInWorkflowsForPublicApi(
		id: string,
		workflowIds: string[],
		includeData?: boolean,
	): Promise<IExecutionBase | undefined> {
		return await this.findSingleExecution(id, {
			where: {
				workflowId: In(workflowIds),
			},
			includeData,
			unflattenData: true,
		});
	}

	async findWithUnflattenedData(executionId: string, accessibleWorkflowIds: string[]) {
		return await this.findSingleExecution(executionId, {
			where: {
				workflowId: In(accessibleWorkflowIds),
			},
			includeData: true,
			unflattenData: true,
			includeAnnotation: true,
		});
	}

	async findIfShared(executionId: string, sharedWorkflowIds: string[]) {
		return await this.findSingleExecution(executionId, {
			where: {
				workflowId: In(sharedWorkflowIds),
			},
			includeData: true,
			unflattenData: false,
			includeAnnotation: true,
		});
	}

	async findIfAccessible(executionId: string, accessibleWorkflowIds: string[]) {
		return await this.findSingleExecution(executionId, {
			where: { workflowId: In(accessibleWorkflowIds) },
		});
	}

	async stopBeforeRun(execution: IExecutionResponse) {
		execution.status = 'canceled';
		execution.stoppedAt = new Date();

		await this.update(
			{ id: execution.id },
			{ status: execution.status, stoppedAt: execution.stoppedAt },
		);

		return execution;
	}

	async stopDuringRun(execution: IExecutionResponse) {
		const error = new ExecutionCancelledError(execution.id);

		execution.data ??= { resultData: { runData: {} } };
		execution.data.resultData.error = {
			...error,
			message: error.message,
			stack: error.stack,
		};

		execution.stoppedAt = new Date();
		execution.waitTill = null;
		execution.status = 'canceled';

		await this.updateExistingExecution(execution.id, execution);

		return execution;
	}

	async cancelMany(executionIds: string[]) {
		await this.update({ id: In(executionIds) }, { status: 'canceled', stoppedAt: new Date() });
	}

	// ----------------------------------
	//            new API
	// ----------------------------------

	/**
	 * Fields to include in the summary of an execution when querying for many.
	 */
	private summaryFields = {
		id: true,
		workflowId: true,
		mode: true,
		retryOf: true,
		status: true,
		startedAt: true,
		stoppedAt: true,
	};

	private annotationFields = {
		id: true,
		vote: true,
	};

	/**
	 * This function reduces duplicate rows in the raw result set of the query builder from *toQueryBuilderWithAnnotations*
	 * by merging the tags of the same execution annotation.
	 */
	private reduceExecutionsWithAnnotations(
		rawExecutionsWithTags: Array<
			ExecutionSummary & {
				annotation_id: number;
				annotation_vote: AnnotationVote;
				annotation_tags_id: string;
				annotation_tags_name: string;
			}
		>,
	) {
		return rawExecutionsWithTags.reduce(
			(
				acc,
				{
					annotation_id: _,
					annotation_vote: vote,
					annotation_tags_id: tagId,
					annotation_tags_name: tagName,
					...row
				},
			) => {
				const existingExecution = acc.find((e) => e.id === row.id);

				if (existingExecution) {
					if (tagId) {
						existingExecution.annotation = existingExecution.annotation ?? {
							vote,
							tags: [] as Array<{ id: string; name: string }>,
						};
						existingExecution.annotation.tags.push({ id: tagId, name: tagName });
					}
				} else {
					acc.push({
						...row,
						annotation: {
							vote,
							tags: tagId ? [{ id: tagId, name: tagName }] : [],
						},
					});
				}
				return acc;
			},
			[] as ExecutionSummary[],
		);
	}

	async findManyByRangeQuery(query: ExecutionSummaries.RangeQuery): Promise<ExecutionSummary[]> {
		if (query?.accessibleWorkflowIds?.length === 0) {
			throw new ApplicationError('Expected accessible workflow IDs');
		}

		// Due to performance reasons, we use custom query builder with raw SQL.
		// IMPORTANT: it produces duplicate rows for executions with multiple tags, which we need to reduce manually
		const qb = this.toQueryBuilderWithAnnotations(query);

		const rawExecutionsWithTags: Array<
			ExecutionSummary & {
				annotation_id: number;
				annotation_vote: AnnotationVote;
				annotation_tags_id: string;
				annotation_tags_name: string;
			}
		> = await qb.getRawMany();

		const executions = this.reduceExecutionsWithAnnotations(rawExecutionsWithTags);

		return executions.map((execution) => this.toSummary(execution));
	}

	// @tech_debt: These transformations should not be needed
	private toSummary(execution: {
		id: number | string;
		startedAt?: Date | string;
		stoppedAt?: Date | string;
		waitTill?: Date | string | null;
	}): ExecutionSummary {
		execution.id = execution.id.toString();

		const normalizeDateString = (date: string) => {
			if (date.includes(' ')) return date.replace(' ', 'T') + 'Z';
			return date;
		};

		if (execution.startedAt) {
			execution.startedAt =
				execution.startedAt instanceof Date
					? execution.startedAt.toISOString()
					: normalizeDateString(execution.startedAt);
		}

		if (execution.waitTill) {
			execution.waitTill =
				execution.waitTill instanceof Date
					? execution.waitTill.toISOString()
					: normalizeDateString(execution.waitTill);
		}

		if (execution.stoppedAt) {
			execution.stoppedAt =
				execution.stoppedAt instanceof Date
					? execution.stoppedAt.toISOString()
					: normalizeDateString(execution.stoppedAt);
		}

		return execution as ExecutionSummary;
	}

	async fetchCount(query: ExecutionSummaries.CountQuery) {
		return await this.toQueryBuilder(query).getCount();
	}

	async getLiveExecutionRowsOnPostgres() {
		const tableName = `${this.globalConfig.database.tablePrefix}execution_entity`;

		const pgSql = `SELECT n_live_tup as result FROM pg_stat_all_tables WHERE relname = '${tableName}';`;

		try {
			const rows = (await this.query(pgSql)) as Array<{ result: string }>;

			if (rows.length !== 1) throw new PostgresLiveRowsRetrievalError(rows);

			const [row] = rows;

			return parseInt(row.result, 10);
		} catch (error) {
			if (error instanceof Error) this.logger.error(error.message, { error });

			return -1;
		}
	}

	private toQueryBuilder(query: ExecutionSummaries.Query) {
		const {
			accessibleWorkflowIds,
			status,
			finished,
			workflowId,
			startedBefore,
			startedAfter,
			metadata,
			annotationTags,
			vote,
		} = query;

		const fields = Object.keys(this.summaryFields)
			.concat(['waitTill', 'retrySuccessId'])
			.map((key) => `execution.${key} AS "${key}"`)
			.concat('workflow.name AS "workflowName"');

		const qb = this.createQueryBuilder('execution')
			.select(fields)
			.innerJoin('execution.workflow', 'workflow')
			.where('execution.workflowId IN (:...accessibleWorkflowIds)', { accessibleWorkflowIds });

		if (query.kind === 'range') {
			const { limit, firstId, lastId } = query.range;

			qb.limit(limit);

			if (firstId) qb.andWhere('execution.id > :firstId', { firstId });
			if (lastId) qb.andWhere('execution.id < :lastId', { lastId });

			if (query.order?.startedAt === 'DESC') {
				qb.orderBy({ 'execution.startedAt': 'DESC' });
			} else if (query.order?.top) {
				qb.orderBy(`(CASE WHEN execution.status = '${query.order.top}' THEN 0 ELSE 1 END)`);
			} else {
				qb.orderBy({ 'execution.id': 'DESC' });
			}
		}

		if (status) qb.andWhere('execution.status IN (:...status)', { status });
		if (finished) qb.andWhere({ finished });
		if (workflowId) qb.andWhere({ workflowId });
		if (startedBefore) qb.andWhere({ startedAt: lessThanOrEqual(startedBefore) });
		if (startedAfter) qb.andWhere({ startedAt: moreThanOrEqual(startedAfter) });

		if (metadata?.length === 1) {
			const [{ key, value }] = metadata;

			qb.innerJoin(
				ExecutionMetadata,
				'md',
				'md.executionId = execution.id AND md.key = :key AND md.value = :value',
			);

			qb.setParameter('key', key);
			qb.setParameter('value', value);
		}

		if (annotationTags?.length || vote) {
			// If there is a filter by one or multiple tags or by vote - we need to join the annotations table
			qb.innerJoin('execution.annotation', 'annotation');

			// Add an inner join for each tag
			if (annotationTags?.length) {
				for (let index = 0; index < annotationTags.length; index++) {
					qb.innerJoin(
						AnnotationTagMapping,
						`atm_${index}`,
						`atm_${index}.annotationId = annotation.id AND atm_${index}.tagId = :tagId_${index}`,
					);

					qb.setParameter(`tagId_${index}`, annotationTags[index]);
				}
			}

			// Add filter by vote
			if (vote) {
				qb.andWhere('annotation.vote = :vote', { vote });
			}
		}

		return qb;
	}

	/**
	 * This method is used to add the annotation fields to the executions query
	 * It uses original query builder as a subquery and adds the annotation fields to it
	 * IMPORTANT: Query made with this query builder fetches duplicate execution rows for each tag,
	 *  this is intended, as we are working with raw query.
	 *  The duplicates are reduced in the *reduceExecutionsWithAnnotations* method.
	 */
	private toQueryBuilderWithAnnotations(query: ExecutionSummaries.Query) {
		const annotationFields = Object.keys(this.annotationFields).map(
			(key) => `annotation.${key} AS "annotation_${key}"`,
		);

		const subQuery = this.toQueryBuilder(query).addSelect(annotationFields);

		// Ensure the join with annotations is made only once
		// It might be already present as an inner join if the query includes filter by annotation tags
		// If not, it must be added as a left join
		if (!subQuery.expressionMap.joinAttributes.some((join) => join.alias.name === 'annotation')) {
			subQuery.leftJoin('execution.annotation', 'annotation');
		}

		return this.manager
			.createQueryBuilder()
			.select(['e.*', 'ate.id AS "annotation_tags_id"', 'ate.name AS "annotation_tags_name"'])
			.from(`(${subQuery.getQuery()})`, 'e')
			.setParameters(subQuery.getParameters())
			.leftJoin(AnnotationTagMapping, 'atm', 'atm.annotationId = e.annotation_id')
			.leftJoin(AnnotationTagEntity, 'ate', 'ate.id = atm.tagId');
	}

	async getAllIds() {
		const executions = await this.find({ select: ['id'], order: { id: 'ASC' } });

		return executions.map(({ id }) => id);
	}

	/**
	 * Retrieve a batch of execution IDs with `new` or `running` status, in most recent order.
	 */
	async getInProgressExecutionIds(batchSize: number) {
		const executions = await this.find({
			select: ['id'],
			where: { status: In(['new', 'running']) },
			order: { startedAt: 'DESC' },
			take: batchSize,
		});

		return executions.map(({ id }) => id);
	}
}
