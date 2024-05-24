/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	ExecutionError,
	IDataObject,
	IHttpRequestOptions,
	IHttpRequestMethods,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError, jsonParse } from 'n8n-workflow';

import { getConnectionHintNoticeField } from '../../../utils/sharedFields';

import { DynamicStructuredTool, DynamicTool } from '@langchain/core/tools';

import {
	configureHttpRequestFunction,
	prettifyToolName,
	configureResponseOptimizer,
	extractPlaceholders,
	updatePlaceholders,
	prepareJSONSchema7Properties,
} from './utils';

import {
	authenticationProperties,
	jsonInput,
	optimizeResponseProperties,
	parametersCollection,
	placeholderDefinitionsCollection,
	specifyBySelector,
} from './descriptions';

import {
	BODY_PARAMETERS_PLACEHOLDER,
	HEADERS_PARAMETERS_PLACEHOLDER,
	QUERY_PARAMETERS_PLACEHOLDER,
} from './interfaces';
import type { ParameterInputType, ParametersValues, ToolParameter } from './interfaces';
import { getSandboxWithZod } from '../../../utils/schemaParsing';
import type { DynamicZodObject } from '../../../types/zod.types';
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

export class ToolHttpRequest implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'HTTP Request Tool',
		name: 'toolHttpRequest',
		icon: 'file:httprequest.svg',
		group: ['output'],
		version: 1,
		description: 'Makes an HTTP request and returns the response data',
		subtitle: `={{(${prettifyToolName})($parameter.name)}}`,
		defaults: {
			name: 'HTTP Request',
		},
		credentials: [],
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolhttprequest/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.AiTool],
		outputNames: ['Tool'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiAgent]),
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. get_current_weather',
				validateType: 'string-alphanumeric',
				description:
					'The name of the function to be called, could contain letters, numbers, and underscores only',
			},
			{
				displayName: 'Description',
				name: 'toolDescription',
				type: 'string',
				description:
					'Explain to LLM what this tool does, better description would allow LLM to produce expected result',
				placeholder: 'e.g. Get the current weather in the requested city',
				default: '',
				typeOptions: {
					rows: 3,
				},
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				options: [
					{
						name: 'DELETE',
						value: 'DELETE',
					},
					{
						name: 'GET',
						value: 'GET',
					},
					{
						name: 'PATCH',
						value: 'PATCH',
					},
					{
						name: 'POST',
						value: 'POST',
					},
					{
						name: 'PUT',
						value: 'PUT',
					},
				],
				default: 'GET',
			},
			{
				displayName:
					'Tip: You can use a {placeholder} for any part of the request to be filled by the model. Provide more context about them in the placeholders section',
				name: 'placeholderNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. http://www.example.com/{path}',
				validateType: 'url',
			},
			...authenticationProperties,
			//Query parameters
			{
				displayName: 'Send Query Parameters',
				name: 'sendQuery',
				type: 'boolean',
				default: false,
				noDataExpression: true,
				description: 'Whether the request has query params or not',
			},
			{
				...specifyBySelector,
				displayName: 'Specify Query Parameters',
				name: 'specifyQuery',
				displayOptions: {
					show: {
						sendQuery: [true],
					},
				},
			},
			{
				...parametersCollection,
				displayName: 'Query Parameters',
				name: 'parametersQuery',
				displayOptions: {
					show: {
						sendQuery: [true],
						specifyQuery: ['keypair'],
					},
				},
			},
			{
				...jsonInput,
				name: 'jsonQuery',
				displayOptions: {
					show: {
						sendQuery: [true],
						specifyQuery: ['json'],
					},
				},
			},
			//Headers parameters
			{
				displayName: 'Send Headers',
				name: 'sendHeaders',
				type: 'boolean',
				default: false,
				noDataExpression: true,
				description: 'Whether the request has headers or not',
			},
			{
				...specifyBySelector,
				displayName: 'Specify Headers',
				name: 'specifyHeaders',
				displayOptions: {
					show: {
						sendHeaders: [true],
					},
				},
			},
			{
				...parametersCollection,
				displayName: 'Header Parameters',
				name: 'parametersHeaders',
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['keypair'],
					},
				},
			},
			{
				...jsonInput,
				name: 'jsonHeaders',
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['json'],
					},
				},
			},
			//Body parameters
			{
				displayName: 'Send Body',
				name: 'sendBody',
				type: 'boolean',
				default: false,
				noDataExpression: true,
				description: 'Whether the request has body or not',
			},
			{
				...specifyBySelector,
				displayName: 'Specify Body',
				name: 'specifyBody',
				displayOptions: {
					show: {
						sendBody: [true],
					},
				},
			},
			{
				...parametersCollection,
				displayName: 'Body Parameters',
				name: 'parametersBody',
				displayOptions: {
					show: {
						sendBody: [true],
						specifyBody: ['keypair'],
					},
				},
			},
			{
				...jsonInput,
				name: 'jsonBody',
				displayOptions: {
					show: {
						sendBody: [true],
						specifyBody: ['json'],
					},
				},
			},
			placeholderDefinitionsCollection,
			...optimizeResponseProperties,
		],
	};

	async supplyData(this: IExecuteFunctions, itemIndex: number): Promise<SupplyData> {
		const name = this.getNodeParameter('name', itemIndex) as string;
		const toolDescription = this.getNodeParameter('toolDescription', itemIndex) as string;
		const method = this.getNodeParameter('method', itemIndex, 'GET') as IHttpRequestMethods;
		const url = this.getNodeParameter('url', itemIndex) as string;

		const authentication = this.getNodeParameter('authentication', itemIndex, 'none') as
			| 'predefinedCredentialType'
			| 'genericCredentialType'
			| 'none';

		if (authentication !== 'none') {
			const domain = new URL(url).hostname;
			if (domain.includes('{') && domain.includes('}')) {
				throw new NodeOperationError(
					this.getNode(),
					"Can't use a placeholder for the domain when using authentication",
					{
						itemIndex,
						description:
							'This is for security reasons, to prevent the model accidentally sending your credentials to an unauthorized domain',
					},
				);
			}
		}

		const httpRequest = await configureHttpRequestFunction(this, authentication, itemIndex);
		const optimizeResponse = configureResponseOptimizer(this, itemIndex);

		let qs: IDataObject = {};
		const headers: IDataObject = {};
		const body: IDataObject = {};

		const placeholders = this.getNodeParameter(
			'placeholderDefinitions.values',
			itemIndex,
			[],
		) as ToolParameter[];

		let qsPlaceholder: string = '';
		let headersPlaceholder: string = '';
		let bodyPlaceholder: string = '';

		const urlPlaceholders = extractPlaceholders(url);

		if (urlPlaceholders.length) {
			for (const placeholder of urlPlaceholders) {
				updatePlaceholders(
					placeholders,
					placeholder,
					true,
					'string, do not wrap in quotas this parameter!',
				);
			}
		}

		const sendQuery = this.getNodeParameter('sendQuery', itemIndex, false) as boolean;
		if (sendQuery) {
			const specifyQuery = this.getNodeParameter('specifyQuery', itemIndex) as ParameterInputType;

			if (specifyQuery === 'model') {
				placeholders.push({
					name: QUERY_PARAMETERS_PLACEHOLDER,
					description:
						'Specify query parameters for request, if needed, here, must be a valid JSON object',
					type: 'json',
					required: false,
				});

				qsPlaceholder = `"qs": {${QUERY_PARAMETERS_PLACEHOLDER}}`;
			}

			if (specifyQuery === 'keypair') {
				const queryParameters = [];
				const parametersQueryValues = this.getNodeParameter(
					'parametersQuery.values',
					itemIndex,
					[],
				) as ParametersValues;

				for (const entry of parametersQueryValues) {
					if (entry.valueProvider.includes('model')) {
						queryParameters.push(`"${entry.name}":{${entry.name}}`);
						updatePlaceholders(placeholders, entry.name, entry.valueProvider === 'modelRequired');
					} else {
						qs[entry.name] = entry.value;
					}
				}

				qsPlaceholder = `"qs": {${queryParameters.join(',')}}`;
			}

			if (specifyQuery === 'json') {
				const jsonQuery = this.getNodeParameter('jsonQuery', itemIndex, '') as string;

				const matches = extractPlaceholders(jsonQuery);

				for (const match of matches) {
					updatePlaceholders(placeholders, match, true);
				}

				qsPlaceholder = `"qs": ${jsonQuery}`;
			}
		}

		const sendHeaders = this.getNodeParameter('sendHeaders', itemIndex, false) as boolean;
		if (sendHeaders) {
			const specifyHeaders = this.getNodeParameter(
				'specifyHeaders',
				itemIndex,
			) as ParameterInputType;

			if (specifyHeaders === 'model') {
				placeholders.push({
					name: HEADERS_PARAMETERS_PLACEHOLDER,
					description: 'Specify headers for request, if needed, here, must be a valid JSON object',
					type: 'json',
					required: false,
				});

				headersPlaceholder = `"headers": {${HEADERS_PARAMETERS_PLACEHOLDER}}`;
			}

			if (specifyHeaders === 'keypair') {
				const headersParameters = [];
				const parametersHeadersValues = this.getNodeParameter(
					'parametersHeaders.values',
					itemIndex,
					[],
				) as ParametersValues;

				for (const entry of parametersHeadersValues) {
					if (entry.valueProvider.includes('model')) {
						headersParameters.push(`"${entry.name}":{${entry.name}}`);
						updatePlaceholders(placeholders, entry.name, entry.valueProvider === 'modelRequired');
					} else {
						headers[entry.name] = entry.value;
					}
				}

				headersPlaceholder = `"headers": {${headersParameters.join(',')}}`;
			}

			if (specifyHeaders === 'json') {
				const jsonHeaders = this.getNodeParameter('jsonHeaders', itemIndex, '') as string;

				const matches = extractPlaceholders(jsonHeaders);

				for (const match of matches) {
					updatePlaceholders(placeholders, match, true);
				}

				headersPlaceholder = `"headers": ${jsonHeaders}`;
			}
		}

		const sendBody = this.getNodeParameter('sendBody', itemIndex, false) as boolean;
		if (sendBody) {
			const specifyBody = this.getNodeParameter('specifyBody', itemIndex) as ParameterInputType;

			if (specifyBody === 'model') {
				placeholders.push({
					name: BODY_PARAMETERS_PLACEHOLDER,
					description: 'Specify body for request, if needed, here, must be a valid JSON object',
					type: 'json',
					required: false,
				});

				bodyPlaceholder = `"body": {${BODY_PARAMETERS_PLACEHOLDER}}`;
			}

			if (specifyBody === 'keypair') {
				const bodyParameters = [];
				const parametersBodyValues = this.getNodeParameter(
					'parametersBody.values',
					itemIndex,
					[],
				) as ParametersValues;

				for (const entry of parametersBodyValues) {
					if (entry.valueProvider.includes('model')) {
						bodyParameters.push(`"${entry.name}":{${entry.name}}`);
						updatePlaceholders(placeholders, entry.name, entry.valueProvider === 'modelRequired');
					} else {
						body[entry.name] = entry.value;
					}
				}

				bodyPlaceholder = `"body": {${bodyParameters.join(',')}}`;
			}

			if (specifyBody === 'json') {
				const jsonBody = this.getNodeParameter('jsonBody', itemIndex, '') as string;

				const matches = extractPlaceholders(jsonBody);

				for (const match of matches) {
					updatePlaceholders(placeholders, match, true);
				}

				bodyPlaceholder = `"body": ${jsonBody}`;
			}
		}

		const requestTemplate = `
{
	${[
		`"url": "${url}"`,
		`"method": "${method}"`,
		`${qsPlaceholder}`,
		`${headersPlaceholder}`,
		`${bodyPlaceholder}`,
	]
		.filter((e) => e)
		.join(',\n')}
}`;

		let description = `${toolDescription}`;

		if (placeholders.length) {
			description += `
Tool expects string as input with ${placeholders.length} values that represent the following parameters:

${placeholders
	.filter((p) => p.name)
	.map(
		(p) =>
			`${p.name}(description: ${p.description || ''}, type: ${p.type || ''}, required: ${!!p.required})`,
	)
	.join(',\n ')}

Separate values with tree commas(,,,)
Do not attempt to send key value pairs, only values in the same order as shown above, if parameter is not required it could be null.`;
		}

		const toolHandler = async (query: string | IDataObject): Promise<string> => {
			const { index } = this.addInputData(NodeConnectionType.AiTool, [[{ json: { query } }]]);

			let response: string = '';
			let executionError: Error | undefined = undefined;
			let requestOptions: IHttpRequestOptions | null = null;

			// parse LLM's input
			try {
				if (query && placeholders.length) {
					//non structured query
					if (typeof query === 'string') {
						let rawRequestOptions = requestTemplate;
						const modelProvidedArguments = query.split(',,,').map((p) => p.trim());
						for (let i = 0; i < modelProvidedArguments.length; i++) {
							let value = modelProvidedArguments[i];
							if (value === 'null' && placeholders[i].type === 'json') {
								value = '{}';
							}
							if (value !== 'null' && placeholders[i].type === 'string' && !value.startsWith('"')) {
								value = `"${value}"`;
							}
							rawRequestOptions = rawRequestOptions.replace(`{${placeholders[i].name}}`, value);
						}

						requestOptions = jsonParse<IHttpRequestOptions>(rawRequestOptions);
					} else {
						//structured query
						requestOptions = (query as { requestOptions: IHttpRequestOptions }).requestOptions;

						if (query.pathInput) {
							const pathInput = query.pathInput as IDataObject;
							let parsedUrl = requestOptions.url;
							for (const [key, value] of Object.entries(pathInput)) {
								parsedUrl = parsedUrl.replace(`{${key}}`, encodeURIComponent(String(value)));
							}
							requestOptions.url = parsedUrl;
						} else {
							requestOptions.url = url;
						}

						requestOptions.method = method;
					}
				} else {
					requestOptions = {
						url,
						method,
					};
				}
			} catch (error) {
				const errorMessage = `Input could not be parsed as JSON: ${query}`;
				executionError = new NodeOperationError(this.getNode(), errorMessage, {
					itemIndex,
				});

				response = errorMessage;
			}

			//add user provided request options
			if (requestOptions) {
				if (Object.keys(headers).length) {
					requestOptions.headers = requestOptions.headers
						? { ...requestOptions.headers, ...headers }
						: headers;
				}

				if (Object.keys(qs).length) {
					requestOptions.qs = requestOptions.qs ? { ...requestOptions.qs, ...qs } : qs;
				}

				if (Object.keys(body)) {
					requestOptions.body = requestOptions.body
						? { ...(requestOptions.body as IDataObject), ...body }
						: body;
				}

				// send request and optimize response
				try {
					response = optimizeResponse(await httpRequest(requestOptions));
				} catch (error) {
					response = `There was an error: "${error.message}"`;
				}
			}

			if (typeof response !== 'string') {
				executionError = new NodeOperationError(this.getNode(), 'Wrong output type returned', {
					description: `The response property should be a string, but it is an ${typeof response}`,
				});
				response = `There was an error: "${executionError.message}"`;
			}

			if (executionError) {
				void this.addOutputData(NodeConnectionType.AiTool, index, executionError as ExecutionError);
			} else {
				void this.addOutputData(NodeConnectionType.AiTool, index, [[{ json: { response } }]]);
			}

			return response;
		};

		let tool: DynamicTool | DynamicStructuredTool | undefined = undefined;

		const pathParameters = extractPlaceholders(url);

		let pathInput: { [key: string]: JSONSchema7Definition } = {};
		if (pathParameters.length) {
			for (const entry of pathParameters) {
				updatePlaceholders(placeholders, entry, true, 'string');
			}

			pathInput = prepareJSONSchema7Properties(
				pathParameters.map((pathParameter) => ({
					name: pathParameter,
					valueProvider: 'modelRequired',
				})),
				placeholders,
				'keypair',
				'pathParameters',
				'',
			).schema;
		}

		const queryInput = prepareJSONSchema7Properties(
			(this.getNodeParameter('parametersQuery.values', itemIndex, []) as ParametersValues) || [],
			placeholders,
			this.getNodeParameter('specifyQuery', itemIndex, 'keypair') as ParameterInputType,
			'qs',
			'Query parameters for request as key value pairs',
		);

		qs = { ...qs, ...queryInput.values };

		const jsonSchema: JSONSchema7 = {
			$schema: 'http://json-schema.org/draft-07/schema#',
			title: 'Request',
			type: 'object',
			properties: {
				...pathInput,
				requestOptions: {
					type: 'object',
					properties: {
						...queryInput.schema,
					},
					required: [],
				},
			},
			required: ['requestOptions'],
		};

		console.log(JSON.stringify(jsonSchema, null, 2));

		const zodSchemaSandbox = getSandboxWithZod(this, jsonSchema, 0);
		const zodSchema = (await zodSchemaSandbox.runCode()) as DynamicZodObject;

		try {
			tool = new DynamicStructuredTool<typeof zodSchema>({
				name,
				description: toolDescription,
				func: toolHandler,
				schema: zodSchema,
			});
		} catch (error) {
			tool = new DynamicTool({
				name,
				description,
				func: toolHandler,
			});
		}

		return {
			response: tool,
		};
	}
}
