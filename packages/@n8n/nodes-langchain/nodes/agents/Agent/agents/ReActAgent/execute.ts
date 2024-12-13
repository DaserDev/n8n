import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { AgentExecutor, ChatAgent, ZeroShotAgent } from 'langchain/agents';
import { CombiningOutputParser } from 'langchain/output_parsers';
import {
	type AiRootNodeExecuteFunctions,
	type INodeExecutionData,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import { isChatInstance } from '@utils/helpers';
import { getOptionalOutputParsers } from '@utils/output_parsers/N8nOutputParser';
import { throwIfToolSchema } from '@utils/schemaParsing';

export async function reActAgentAgentExecute(
	this: AiRootNodeExecuteFunctions,
	nodeVersion: number,
): Promise<INodeExecutionData[][]> {
	this.logger.debug('Executing ReAct Agent');

	const model = (await this.getInputConnectionData(NodeConnectionType.AiLanguageModel, 0)) as
		| BaseLanguageModel
		| BaseChatModel;

	const tools = await this.getConnectedTools(nodeVersion >= 1.5, true, true);

	this.checkForStructuredTools(tools, this.getNode(), 'ReAct Agent');

	const outputParsers = await getOptionalOutputParsers(this);

	const options = this.getNodeParameter('options', 0, {}) as {
		prefix?: string;
		suffix?: string;
		suffixChat?: string;
		humanMessageTemplate?: string;
		returnIntermediateSteps?: boolean;
	};
	let agent: ChatAgent | ZeroShotAgent;

	if (isChatInstance(model)) {
		agent = ChatAgent.fromLLMAndTools(model, tools, {
			prefix: options.prefix,
			suffix: options.suffixChat,
			humanMessageTemplate: options.humanMessageTemplate,
		});
	} else {
		agent = ZeroShotAgent.fromLLMAndTools(model, tools, {
			prefix: options.prefix,
			suffix: options.suffix,
		});
	}

	const agentExecutor = AgentExecutor.fromAgentAndTools({
		agent,
		tools,
		returnIntermediateSteps: options?.returnIntermediateSteps === true,
	});

	const returnData: INodeExecutionData[] = [];

	let outputParser: BaseOutputParser | undefined;
	let prompt: PromptTemplate | undefined;
	if (outputParsers.length) {
		outputParser =
			outputParsers.length === 1 ? outputParsers[0] : new CombiningOutputParser(...outputParsers);

		const formatInstructions = outputParser.getFormatInstructions();

		prompt = new PromptTemplate({
			template: '{input}\n{formatInstructions}',
			inputVariables: ['input'],
			partialVariables: { formatInstructions },
		});
	}

	const items = this.getInputData();
	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			let input;

			if (this.getNode().typeVersion <= 1.2) {
				input = this.getNodeParameter('text', itemIndex) as string;
			} else {
				input = this.getPromptInputByType(itemIndex);
			}

			if (input === undefined) {
				throw new NodeOperationError(this.getNode(), 'The ‘text‘ parameter is empty.');
			}

			if (prompt) {
				input = (await prompt.invoke({ input })).value;
			}

			const response = await agentExecutor
				.withConfig(this.getTracingConfig())
				.invoke({ input, outputParsers });

			if (outputParser) {
				response.output = await this.extractParsedOutput(outputParser, response.output as string);
			}

			returnData.push({ json: response });
		} catch (error) {
			throwIfToolSchema(this, error);
			if (this.continueOnFail()) {
				returnData.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
				continue;
			}

			throw error;
		}
	}

	return [returnData];
}
