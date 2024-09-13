import {
	Column,
	Entity,
	Generated,
	Index,
	ManyToOne,
	OneToMany,
	OneToOne,
	PrimaryColumn,
	Relation,
	DeleteDateColumn,
} from '@n8n/typeorm';
import { ExecutionStatus, WorkflowExecuteMode } from 'n8n-workflow';

import type { ExecutionAnnotation } from '@/databases/entities/execution-annotation';

import { datetimeColumnType } from './abstract-entity';
import type { ExecutionData } from './execution-data';
import type { ExecutionMetadata } from './execution-metadata';
import { WorkflowEntity } from './workflow-entity';
import { idStringifier } from '../utils/transformers';

@Entity()
@Index(['workflowId', 'id'])
@Index(['waitTill', 'id'])
@Index(['finished', 'id'])
@Index(['workflowId', 'finished', 'id'])
@Index(['workflowId', 'waitTill', 'id'])
export class ExecutionEntity {
	@Generated()
	@PrimaryColumn({ transformer: idStringifier })
	id: string;

	@Column()
	finished: boolean;

	@Column('varchar')
	mode: WorkflowExecuteMode;

	@Column({ nullable: true })
	retryOf: string;

	@Column({ nullable: true })
	retrySuccessId: string;

	@Column('varchar')
	status: ExecutionStatus;

	/**
	 * Time when the execution was created. This column is nullable to represent
	 * missing data for executions created before this column was added.
	 */
	@Column({ type: datetimeColumnType, nullable: true })
	createdAt: Date;

	/**
	 * Time when the processing of the execution actually started. This column
	 * is nullable to represent unavailable data until an execution has started.
	 * `createdAt` and `startedAt` may differ significantly on scaling mode and
	 * on regular mode with concurrency control enabled.
	 */
	@Column({ type: datetimeColumnType, nullable: true })
	startedAt: Date;

	@Index()
	@Column({ type: datetimeColumnType, nullable: true })
	stoppedAt: Date;

	@DeleteDateColumn({ type: datetimeColumnType, nullable: true })
	deletedAt: Date;

	@Column({ nullable: true })
	workflowId: string;

	@Column({ type: datetimeColumnType, nullable: true })
	waitTill: Date | null;

	@OneToMany('ExecutionMetadata', 'execution')
	metadata: ExecutionMetadata[];

	@OneToOne('ExecutionData', 'execution')
	executionData: Relation<ExecutionData>;

	@OneToOne('ExecutionAnnotation', 'execution')
	annotation?: Relation<ExecutionAnnotation>;

	@ManyToOne('WorkflowEntity')
	workflow: WorkflowEntity;
}
