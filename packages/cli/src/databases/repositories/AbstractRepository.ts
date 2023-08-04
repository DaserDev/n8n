import { Repository } from 'typeorm';
import type { WorkflowEntity } from '../entities/WorkflowEntity';
import { jsonParse } from 'n8n-workflow';
import type { Constructor } from '@/Interfaces';
import {
	IsString,
	IsBoolean,
	IsOptional,
	IsArray,
	IsDateString,
	validateSync,
} from 'class-validator';
import * as utils from '@/utils';

namespace WorkflowsQuery {
	export class Filter {
		constructor(data: unknown = {}) {
			Object.assign(this, data);
			const result = validateSync(this, { whitelist: true }); // strip unknown properties

			if (result.length > 0) {
				throw new Error('Parsed filter does not fit the schema');
			}
		}

		@IsOptional()
		@IsString()
		id?: string = undefined;

		@IsOptional()
		@IsString()
		name?: string = undefined;

		@IsOptional()
		@IsBoolean()
		active?: boolean = undefined;

		@IsOptional()
		@IsArray()
		@IsString({ each: true })
		nodes?: string[] = undefined;

		@IsOptional()
		@IsDateString()
		createdAt?: Date = undefined;

		@IsOptional()
		@IsDateString()
		updatedAt?: Date = undefined;

		static getFieldNames() {
			return Object.getOwnPropertyNames(new Filter());
		}
	}
}

function mixinQueryMethods<T extends Constructor<{}>>(base: T) {
	class Derived extends base {
		static toQueryFilter(rawFilter: string) {
			const parsedFilter = new WorkflowsQuery.Filter(
				jsonParse(rawFilter, { errorMessage: 'Failed to parse filter JSON' }),
			);

			return Object.fromEntries(
				Object.keys(parsedFilter).map((field: keyof WorkflowsQuery.Filter) => [
					field,
					parsedFilter[field],
				]),
			);
		}

		static toQuerySelect(rawSelect: string) {
			const parsedSelect = jsonParse(rawSelect, { errorMessage: 'Failed to parse select JSON' });

			if (!utils.isStringArray(parsedSelect)) {
				throw new Error('Parsed select is not a string array');
			}

			return parsedSelect.reduce<Record<string, true>>((acc, field) => {
				if (!WorkflowsQuery.Filter.getFieldNames().includes(field)) return acc;
				return (acc[field] = true), acc;
			}, {});
		}

		static toPaginationOptions(rawTake: string, rawSkip = '0') {
			const MAX_ITEMS = 50;

			const [take, skip] = [rawTake, rawSkip].map((o) => parseInt(o, 10));

			return { skip, take: Math.min(take, MAX_ITEMS) };
		}
	}

	return Derived;
}

/* eslint-disable @typescript-eslint/naming-convention */
export const BaseWorkflowRepository = mixinQueryMethods(Repository<WorkflowEntity>);
