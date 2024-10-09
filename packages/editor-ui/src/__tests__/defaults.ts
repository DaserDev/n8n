import type { FrontendSettings } from '@n8n/api-types';

export const defaultSettings: FrontendSettings = {
	databaseType: 'sqlite',
	isDocker: false,
	pruning: {
		isEnabled: false,
		maxAge: 0,
		maxCount: 0,
	},
	allowedModules: {},
	communityNodesEnabled: false,
	defaultLocale: '',
	endpointForm: '',
	endpointFormTest: '',
	endpointFormWaiting: '',
	endpointWebhook: '',
	endpointWebhookTest: '',
	endpointWebhookWaiting: '',
	enterprise: {
		sharing: false,
		ldap: false,
		saml: false,
		logStreaming: false,
		debugInEditor: false,
		advancedExecutionFilters: false,
		variables: false,
		sourceControl: false,
		auditLogs: false,
		showNonProdBanner: false,
		workflowHistory: false,
		binaryDataS3: false,
		externalSecrets: false,
		workerView: false,
		advancedPermissions: false,
		projects: {
			team: {
				limit: 1,
			},
		},
	},
	expressions: {
		evaluator: 'tournament',
	},
	executionMode: 'regular',
	executionTimeout: 0,
	hideUsagePage: false,
	hiringBannerEnabled: false,
	instanceId: '',
	license: { environment: 'development', consumerId: 'unknown' },
	logLevel: 'info',
	maxExecutionTimeout: 0,
	oauthCallbackUrls: { oauth1: '', oauth2: '' },
	personalizationSurveyEnabled: false,
	releaseChannel: 'stable',
	posthog: {
		apiHost: '',
		apiKey: '',
		autocapture: false,
		debug: false,
		disableSessionRecording: false,
		enabled: false,
	},
	publicApi: { enabled: false, latestVersion: 0, path: '', swaggerUi: { enabled: false } },
	pushBackend: 'websocket',
	saveDataErrorExecution: 'DEFAULT',
	saveDataSuccessExecution: 'DEFAULT',
	saveManualExecutions: false,
	saveExecutionProgress: false,
	sso: {
		ldap: { loginEnabled: false, loginLabel: '' },
		saml: { loginEnabled: false, loginLabel: '' },
	},
	telemetry: {
		enabled: false,
	},
	templates: { enabled: false, host: '' },
	timezone: '',
	urlBaseEditor: '',
	urlBaseWebhook: '',
	authCookie: {
		secure: false,
	},
	userManagement: {
		showSetupOnFirstLoad: false,
		smtpSetup: true,
		authenticationMethod: 'email',
		quota: 10,
	},
	versionCli: '',
	nodeJsVersion: '',
	concurrency: -1,
	versionNotifications: {
		enabled: true,
		endpoint: '',
		infoUrl: '',
	},
	workflowCallerPolicyDefaultOption: 'any',
	workflowTagsDisabled: false,
	variables: {
		limit: -1,
	},
	deployment: {
		type: 'default',
	},
	banners: {
		dismissed: [],
	},
	binaryDataMode: 'default',
	previewMode: false,
	mfa: {
		enabled: false,
	},
	askAi: {
		enabled: false,
	},
	workflowHistory: {
		pruneTime: 0,
		licensePruneTime: 0,
	},
	security: {
		blockFileAccessToN8nFiles: false,
	},
	aiAssistant: {
		enabled: false,
	},
};
