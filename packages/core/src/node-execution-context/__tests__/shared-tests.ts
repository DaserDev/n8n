import { captor, mock } from 'jest-mock-extended';
import type {
	IRunExecutionData,
	ContextType,
	IContextObject,
	INode,
	OnError,
	Workflow,
	ITaskMetadata,
	ISourceData,
	IExecuteData,
} from 'n8n-workflow';
import { ApplicationError, NodeHelpers } from 'n8n-workflow';

import type { BaseExecuteContext } from '../base-execute-context';

export const describeCommonTests = (
	context: BaseExecuteContext,
	{
		abortSignal,
		node,
		workflow,
		runExecutionData,
		executeData,
	}: {
		abortSignal: AbortSignal;
		node: INode;
		workflow: Workflow;
		runExecutionData: IRunExecutionData;
		executeData: IExecuteData;
	},
) => {
	// @ts-expect-error `additionalData` is private
	const { additionalData } = context;

	describe('getExecutionCancelSignal', () => {
		it('should return the abort signal', () => {
			expect(context.getExecutionCancelSignal()).toBe(abortSignal);
		});
	});

	describe('onExecutionCancellation', () => {
		const handler = jest.fn();
		context.onExecutionCancellation(handler);

		const fnCaptor = captor<() => void>();
		expect(abortSignal.addEventListener).toHaveBeenCalledWith('abort', fnCaptor);
		expect(handler).not.toHaveBeenCalled();

		fnCaptor.value();
		expect(abortSignal.removeEventListener).toHaveBeenCalledWith('abort', fnCaptor);
		expect(handler).toHaveBeenCalled();
	});

	describe('continueOnFail', () => {
		afterEach(() => {
			node.onError = undefined;
			node.continueOnFail = false;
		});

		it('should return false for nodes by default', () => {
			expect(context.continueOnFail()).toEqual(false);
		});

		it('should return true if node has continueOnFail set to true', () => {
			node.continueOnFail = true;
			expect(context.continueOnFail()).toEqual(true);
		});

		test.each([
			['continueRegularOutput', true],
			['continueErrorOutput', true],
			['stopWorkflow', false],
		])('if node has onError set to %s, it should return %s', (onError, expected) => {
			node.onError = onError as OnError;
			expect(context.continueOnFail()).toEqual(expected);
		});
	});

	describe('getContext', () => {
		it('should return the context object', () => {
			const contextType: ContextType = 'node';
			const expectedContext = mock<IContextObject>();
			const getContextSpy = jest.spyOn(NodeHelpers, 'getContext');
			getContextSpy.mockReturnValue(expectedContext);

			expect(context.getContext(contextType)).toEqual(expectedContext);

			expect(getContextSpy).toHaveBeenCalledWith(runExecutionData, contextType, node);

			getContextSpy.mockRestore();
		});
	});

	describe('sendMessageToUI', () => {
		it('should send console messages to the frontend', () => {
			context.sendMessageToUI('Testing', 1, 2, {});
			expect(additionalData.sendDataToUI).toHaveBeenCalledWith('sendConsoleMessage', {
				source: '[Node: "Test Node"]',
				messages: ['Testing', 1, 2, {}],
			});
		});
	});

	describe('logAiEvent', () => {
		it('should log the AI event correctly', () => {
			const eventName = 'ai-tool-called';
			const msg = 'test message';

			context.logAiEvent(eventName, msg);

			expect(additionalData.logAiEvent).toHaveBeenCalledWith(eventName, {
				executionId: additionalData.executionId,
				nodeName: node.name,
				workflowName: workflow.name,
				nodeType: node.type,
				workflowId: workflow.id,
				msg,
			});
		});
	});

	describe('getInputSourceData', () => {
		it('should return the input source data correctly', () => {
			const inputSourceData = mock<ISourceData>();
			executeData.source = { main: [inputSourceData] };

			expect(context.getInputSourceData()).toEqual(inputSourceData);
		});

		it('should throw an error if the source data is missing', () => {
			executeData.source = null;

			expect(() => context.getInputSourceData()).toThrow(ApplicationError);
		});
	});

	describe('setMetadata', () => {
		it('sets metadata on execution data', () => {
			const metadata: ITaskMetadata = {
				subExecution: {
					workflowId: '123',
					executionId: 'xyz',
				},
			};

			expect(context.getExecuteData().metadata?.subExecution).toEqual(undefined);
			context.setMetadata(metadata);
			expect(context.getExecuteData().metadata?.subExecution).toEqual(metadata.subExecution);
		});
	});

	describe('evaluateExpression', () => {
		it('should evaluate the expression correctly', () => {
			const expression = '$json.test';
			const expectedResult = 'data';
			const resolveSimpleParameterValueSpy = jest.spyOn(
				workflow.expression,
				'resolveSimpleParameterValue',
			);
			resolveSimpleParameterValueSpy.mockReturnValue(expectedResult);

			expect(context.evaluateExpression(expression, 0)).toEqual(expectedResult);

			expect(resolveSimpleParameterValueSpy).toHaveBeenCalledWith(
				`=${expression}`,
				{},
				runExecutionData,
				0,
				0,
				node.name,
				[],
				'manual',
				expect.objectContaining({}),
				executeData,
			);

			resolveSimpleParameterValueSpy.mockRestore();
		});
	});
};
