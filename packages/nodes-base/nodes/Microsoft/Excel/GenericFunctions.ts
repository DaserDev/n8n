import type { OptionsWithUri } from 'request';
import type { IExecuteFunctions, IExecuteSingleFunctions, ILoadOptionsFunctions } from 'n8n-core';
import type { IDataObject, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export type RangeUpdateOptions = {
	upsert?: boolean;
	updateAll?: boolean;
};
export type SheetRow = Array<string | null>;
export type SheetData = SheetRow[];
export type UpdateSummary = {
	updatedData: SheetData;
	appendData: IDataObject[];
	updatedRows: number[];
};

type PrepareOutputConfig = {
	rawData?: boolean;
	keyRow?: number;
	firstDataRow?: number;
	columnsRow?: string[];
	updatedRows?: number[];
};

export async function microsoftApiRequest(
	this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
	method: string,
	resource: string,
	body: any = {},
	qs: IDataObject = {},
	uri?: string,
	headers: IDataObject = {},
): Promise<any> {
	const options: OptionsWithUri = {
		headers: {
			'Content-Type': 'application/json',
		},
		method,
		body,
		qs,
		uri: uri || `https://graph.microsoft.com/v1.0/me${resource}`,
		json: true,
	};
	try {
		if (Object.keys(headers).length !== 0) {
			options.headers = Object.assign({}, options.headers, headers);
		}
		return await this.helpers.requestOAuth2.call(this, 'microsoftExcelOAuth2Api', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error);
	}
}

export async function microsoftApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: string,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
): Promise<any> {
	const returnData: IDataObject[] = [];

	let responseData;
	let uri: string | undefined;
	query.$top = 100;

	do {
		responseData = await microsoftApiRequest.call(this, method, endpoint, body, query, uri);
		uri = responseData['@odata.nextLink'];
		if (uri?.includes('$top')) {
			delete query.$top;
		}
		returnData.push.apply(returnData, responseData[propertyName]);
	} while (responseData['@odata.nextLink'] !== undefined);

	return returnData;
}

export async function microsoftApiRequestAllItemsSkip(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	propertyName: string,
	method: string,
	endpoint: string,
	body: any = {},
	query: IDataObject = {},
): Promise<any> {
	const returnData: IDataObject[] = [];

	let responseData;
	query.$top = 100;
	query.$skip = 0;

	do {
		responseData = await microsoftApiRequest.call(this, method, endpoint, body, query);
		query.$skip += query.$top;
		returnData.push.apply(returnData, responseData[propertyName]);
	} while (responseData.value.length !== 0);

	return returnData;
}

export function prepareOutput(
	this: IExecuteFunctions,
	responseData: { values: string[][] },
	config: PrepareOutputConfig = {},
) {
	const returnData: INodeExecutionData[] = [];

	if (config.rawData === undefined) {
		config.rawData = this.getNodeParameter('rawData', 0, false);
	}

	const { rawData, keyRow, firstDataRow, columnsRow, updatedRows } = {
		keyRow: 0,
		firstDataRow: 1,
		columnsRow: undefined,
		updatedRows: undefined,
		...config,
	};

	if (!rawData) {
		let values = responseData.values;
		if (values === null) {
			throw new NodeOperationError(this.getNode(), 'Operation did not return data');
		}

		const columns = columnsRow ? columnsRow : values[keyRow];
		const startIndex = columnsRow ? 0 : firstDataRow;

		if (updatedRows) {
			values = values.filter((_, index) => updatedRows.includes(index));
		}

		for (let rowIndex = startIndex; rowIndex < values.length; rowIndex++) {
			const data: IDataObject = {};
			for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
				data[columns[columnIndex]] = values[rowIndex][columnIndex];
			}
			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray({ ...data }),
				{ itemData: { item: rowIndex } },
			);

			returnData.push(...executionData);
		}
	} else {
		const dataProperty = this.getNodeParameter('dataProperty', 0) as string;
		const executionData = this.helpers.constructExecutionMetaData(
			this.helpers.returnJsonArray({ [dataProperty]: responseData }),
			{ itemData: { item: 0 } },
		);

		returnData.push(...executionData);
	}

	return returnData;
}

export function updateByDefinedValues(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	sheetData: SheetData,
	updateAll = false,
): UpdateSummary {
	const [columns, ...originalValues] = sheetData;
	const updateValues: SheetData = originalValues.map((row) => row.map(() => null));

	const updatedRowsIndexes = new Set<number>();
	const appendData: IDataObject[] = [];

	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		const columnToMatchOn = this.getNodeParameter('columnToMatchOn', itemIndex) as string;
		const valueToMatchOn = this.getNodeParameter('valueToMatchOn', itemIndex) as string;

		const definedFields = this.getNodeParameter('fieldsUi.values', itemIndex, []) as Array<{
			column: string;
			fieldValue: string;
		}>;

		const columnToMatchOnIndex = columns.indexOf(columnToMatchOn);

		const rowIndexes: number[] = [];
		if (updateAll) {
			for (const [index, row] of originalValues.entries()) {
				if (
					row[columnToMatchOnIndex] === valueToMatchOn ||
					Number(row[columnToMatchOnIndex]) === Number(valueToMatchOn)
				) {
					rowIndexes.push(index);
				}
			}
		} else {
			const rowIndex = originalValues.findIndex(
				(row) =>
					row[columnToMatchOnIndex] === valueToMatchOn ||
					Number(row[columnToMatchOnIndex]) === Number(valueToMatchOn),
			);

			if (rowIndex === -1) {
				const appendItem: IDataObject = {};
				appendItem[columnToMatchOn] = valueToMatchOn;

				for (const entry of definedFields) {
					appendItem[entry.column] = entry.fieldValue;
				}
				appendData.push(appendItem);
				continue;
			}

			rowIndexes.push(rowIndex);
		}

		for (const rowIndex of rowIndexes) {
			for (const entry of definedFields) {
				const columnIndex = columns.indexOf(entry.column);
				if (rowIndex === -1) continue;
				updateValues[rowIndex][columnIndex] = entry.fieldValue;
				updatedRowsIndexes.add(rowIndex);
			}
		}
	}

	const summary: UpdateSummary = {
		updatedData: [columns, ...updateValues],
		appendData,
		updatedRows: [0, ...Array.from(updatedRowsIndexes).map((index) => index + 1)], //add columns index and shift by 1
	};

	return summary;
}

export function updateByAutoMaping(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	sheetData: SheetData,
	columnToMatchOn: string,
	updateAll = false,
): UpdateSummary {
	const [columns, ...values] = sheetData;
	const columnToMatchOnIndex = columns.indexOf(columnToMatchOn);
	const columnToMatchOnData = values.map((row) => row[columnToMatchOnIndex]);

	const updatedRowsIndexes = new Set<number>();
	const appendData: IDataObject[] = [];

	const itemsData = items.map((item) => item.json);
	for (const item of itemsData) {
		const columnValue = item[columnToMatchOn] as string;

		const rowIndexes: number[] = [];
		if (updateAll) {
			columnToMatchOnData.forEach((value, index) => {
				if (value === columnValue || Number(value) === Number(columnValue)) {
					rowIndexes.push(index);
				}
			});
		} else {
			const rowIndex = columnToMatchOnData.findIndex(
				(value) => value === columnValue || Number(value) === Number(columnValue),
			);

			if (rowIndex === -1) continue;

			rowIndexes.push(rowIndex);
		}

		if (!rowIndexes.length) {
			appendData.push(item);
			continue;
		}

		const updatedRow: Array<string | null> = [];

		for (const columnName of columns as string[]) {
			const updateValue = item[columnName] === undefined ? null : (item[columnName] as string);
			updatedRow.push(updateValue);
		}

		for (const rowIndex of rowIndexes) {
			values[rowIndex] = updatedRow as string[];
			updatedRowsIndexes.add(rowIndex);
		}
	}

	const summary: UpdateSummary = {
		updatedData: [columns, ...values],
		appendData,
		updatedRows: [0, ...Array.from(updatedRowsIndexes).map((index) => index + 1)], //add columns index and shift by 1
	};

	return summary;
}

export async function updateOrUpsertRange(
	this: IExecuteFunctions,
	updateSummary: UpdateSummary,
	workbookId: string,
	worksheetId: string,
	range: string,
	columnsRow: string[],
	upsert = false,
) {
	const { appendData, updatedRows } = updateSummary;
	let { updatedData } = updateSummary;

	if (upsert && appendData.length) {
		const appendValues: string[][] = [];

		for (const [index, item] of appendData.entries()) {
			const updateRow: string[] = [];

			for (const column of columnsRow) {
				updateRow.push(item[column] as string);
			}

			appendValues.push(updateRow);
			updatedRows.push(index + updatedData.length);
		}

		updatedData = updatedData.concat(appendValues);
		const [rangeFrom, rangeTo] = range.split(':');
		const cellDataTo = rangeTo.match(/([a-zA-Z]{1,10})([0-9]{0,10})/) || [];

		range = `${rangeFrom}:${cellDataTo[1]}${Number(cellDataTo[2]) + appendValues.length}`;
	}

	return microsoftApiRequest.call(
		this,
		'PATCH',
		`/drive/items/${workbookId}/workbook/worksheets/${worksheetId}/range(address='${range}')`,
		{ values: updatedData },
	);
}
