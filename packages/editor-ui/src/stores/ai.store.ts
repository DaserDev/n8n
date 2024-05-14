import { defineStore } from 'pinia';
import * as aiApi from '@/api/ai';
import type { DebugErrorPayload, DebugChatPayload } from '@/api/ai';
import { useRootStore } from '@/stores/n8nRoot.store';
import { useSettingsStore } from '@/stores/settings.store';
import { chatEventBus } from '@n8n/chat/event-buses';
import type { ChatMessage } from '@n8n/chat/types';
import { computed, nextTick, ref } from 'vue';
import type { INodeTypeDescription } from 'n8n-workflow';
import { jsonParse, type IUser, type NodeError } from 'n8n-workflow';
import { useUsersStore } from './users.store';
import { useNDVStore } from './ndv.store';
import { useWorkflowsStore } from './workflows.store';
import { useDataSchema } from '@/composables/useDataSchema';
import { executionDataToJson } from '@/utils/nodeTypesUtils';
import { codeNodeEditorEventBus } from '@/event-bus';

export const useAIStore = defineStore('ai', () => {
	const rootStore = useRootStore();
	const usersStore = useUsersStore();
	const settingsStore = useSettingsStore();
	const currentSessionId = ref<string>('Whatever');
	const waitingForResponse = ref(false);
	const chatTitle = ref('');

	const userName = computed(() => usersStore.currentUser?.firstName ?? 'there');
	const activeNode = computed(() => useNDVStore().activeNodeName);

	const eventBus = codeNodeEditorEventBus;

	const debugSessionInProgress = ref(false);
	const initialMessages = ref<ChatMessage[]>([
		{
			id: '1',
			type: 'text',
			sender: 'bot',
			createdAt: new Date().toISOString(),
			text: `Hi ${userName.value}! Please let me use my wast knowledge to help you with the error in your ${activeNode.value ? `__${activeNode.value}__` : ''} node`,
		},
		{
			id: '2',
			type: 'text',
			sender: 'bot',
			createdAt: new Date().toISOString(),
			text: '⚠️ I currently do ont support chat sessions, so make sure to reload your page to start a new session.',
		},
	]);

	const messages = ref<ChatMessage[]>([]);

	async function sendMessage(text: string) {
		const hasUserMessages = messages.value.some((message) => message.sender === 'user');
		messages.value.push({
			createdAt: new Date().toISOString(),
			text,
			sender: 'user',
			id: Math.random().toString(),
		});

		chatEventBus.emit('scrollToBottom');

		waitingForResponse.value = true;
		if (debugSessionInProgress.value) {
			await debugWithAssistantFollowup(text);
		} else {
			await askAssistant(text, !hasUserMessages);
		}
		waitingForResponse.value = false;
	}

	const isErrorDebuggingEnabled = computed(() => settingsStore.settings.ai.errorDebugging);

	async function debugError(payload: DebugErrorPayload) {
		return await aiApi.debugError(rootStore.getRestApiContext, payload);
	}
	function getLastMessage() {
		return messages.value[messages.value.length - 1];
	}
	function onMessageReceived(messageChunk: string) {
		waitingForResponse.value = false;
		if (messageChunk.length === 0) return;
		if (messageChunk === '__END__') return;

		if (getLastMessage()?.sender !== 'bot') {
			messages.value.push({
				createdAt: new Date().toISOString(),
				text: messageChunk,
				sender: 'bot',
				type: 'text',
				id: Math.random().toString(),
			});
			return;
		}

		const lastMessage = getLastMessage();

		if (lastMessage.type === 'text') {
			lastMessage.text += `\n${messageChunk}`;

			chatEventBus.emit('scrollToBottom');
		}
	}
	async function onMessageSuggestionReceived(messageChunk: string) {
		waitingForResponse.value = false;
		if (messageChunk.length === 0) return;
		if (messageChunk === '__END__') {
			const lastMessage = getLastMessage();
			// If last message is a component, then show the follow-up actions
			if (lastMessage.type === 'component') {
				const followUpQuestion: string = lastMessage.arguments.suggestions[0].followUpQuestion;
				// const suggestedCode: string = lastMessage.arguments.suggestions[0].codeSnippet;
				// messages.value.push({
				// 	createdAt: new Date().toISOString(),
				// 	sender: 'bot',
				// 	type: 'text',
				// 	id: Math.random().toString(),
				// 	text: '```javascript' + suggestedCode,
				// });

				// TODO: Think about using MessageWithActions instead of text + QuickReplies
				messages.value.push({
					createdAt: new Date().toISOString(),
					sender: 'bot',
					type: 'text',
					id: Math.random().toString(),
					text: followUpQuestion,
				});
				const followUpActions = lastMessage.arguments.suggestions.map((suggestion) => {
					return {
						label: suggestion.followUpAction,
						key: 'test_code',
					};
				});
				followUpActions.push({ label: 'No, try another suggestion', key: 'ask_question' });
				const newMessageId = Math.random().toString();
				messages.value.push({
					createdAt: new Date().toISOString(),
					transparent: true,
					key: 'QuickReplies',
					sender: 'bot',
					type: 'component',
					id: newMessageId,
					arguments: {
						suggestions: followUpActions,
						async onReplySelected({ label, key }: { action: string; label: string }) {
							console.log(label);
							console.log(key);
							if (key === 'test_code') {
								const currentNode = useNDVStore().activeNode;

								// properties: {
								// 	parameters: {
								// 		...node.parameters,
								// 		[nodeAuthField.name]: type,
								// 	},
								eventBus.emit('updateCodeContent');

								// useWorkflowsStore().updateNodeProperties({
								// 	name: currentNode?.name,
								// 	properties: {
								// 		parameters: { jsCode: 'suggestedCode' },
								// 	},
								// });
								return;
							}

							await sendMessage(label);
							// Remove the quick replies so only user message is shown
							messages.value = messages.value.filter((message) => {
								return message.id !== newMessageId;
							});
						},
					},
				});
				chatEventBus.emit('scrollToBottom');
			}
			return;
		}

		const parsedMessage = jsonParse<Record<string, unknown>>(messageChunk);

		console.log(parsedMessage);

		if (getLastMessage()?.sender !== 'bot') {
			messages.value.push({
				createdAt: new Date().toISOString(),
				sender: 'bot',
				key: 'MessageWithSuggestions',
				type: 'component',
				id: Math.random().toString(),
				arguments: {
					...parsedMessage,
				},
			});
			chatEventBus.emit('scrollToBottom');
			return;
		}

		const lastMessage = getLastMessage();

		if (lastMessage.type === 'component') {
			lastMessage.arguments = parsedMessage;
			await nextTick();
			await nextTick();
			chatEventBus.emit('scrollToBottom');
		}
	}

	async function debugChat(payload: DebugChatPayload) {
		waitingForResponse.value = true;
		return await aiApi.debugChat(rootStore.getRestApiContext, payload, onMessageSuggestionReceived);
	}

	async function debugWithAssistantFollowup(message: string) {
		chatEventBus.emit('open');
		waitingForResponse.value = true;
		await aiApi.debugWithAssistant(rootStore.getRestApiContext, { message }, onMessageReceived);
		waitingForResponse.value = false;
	}

	async function debugWithAssistant(
		nodeType: INodeTypeDescription,
		error: NodeError,
		authType: { name: string; value: string },
	) {
		chatEventBus.emit('open');
		waitingForResponse.value = true;
		await aiApi.debugWithAssistant(
			rootStore.getRestApiContext,
			{ nodeType, error, authType },
			onMessageReceived,
		);
		waitingForResponse.value = false;
	}

	async function askAssistant(message: string, newSession: boolean = false) {
		await aiApi.askAssistant(
			rootStore.getRestApiContext,
			{ message, newSession },
			onMessageReceived,
		);
	}

	async function askPinecone() {
		await aiApi.askPinecone(rootStore.getRestApiContext, onMessageReceived);
	}

	async function startNewDebugSession(error: NodeError) {
		const currentNode = useNDVStore().activeNode;
		const workflowNodes = useWorkflowsStore().allNodes;

		const schemas = workflowNodes.map((node) => {
			const { getSchemaForExecutionData, getInputDataWithPinned } = useDataSchema();
			const schema = getSchemaForExecutionData(
				executionDataToJson(getInputDataWithPinned(node)),
				true,
			);
			return {
				node_name: node.name,
				schema,
			};
		});

		const currentNodeParameters = currentNode?.parameters ?? {};
		const currentUser = usersStore.currentUser ?? ({} as IUser);
		// return;
		messages.value = [];
		currentSessionId.value = `${currentUser.id}-${error.timestamp}`;
		chatTitle.value = error.message;
		delete error.stack;
		chatEventBus.emit('open');

		const promptText = `
			## Error:
				${JSON.stringify(error).trim()};
		`;

		return await aiApi.debugChat(
			rootStore.getRestApiContext,
			{
				error,
				sessionId: currentSessionId.value,
				schemas,
				nodes: workflowNodes.map((n) => n.name),
				parameters: currentNodeParameters,
			},
			onMessageSuggestionReceived,
		);
	}
	return {
		debugError,
		startNewDebugSession,
		sendMessage,
		chatTitle,
		isErrorDebuggingEnabled,
		messages,
		initialMessages,
		waitingForResponse,
		askAssistant,
		askPinecone,
		debugWithAssistant,
		debugWithAssistantFollowup,
		debugSessionInProgress,
	};
});
