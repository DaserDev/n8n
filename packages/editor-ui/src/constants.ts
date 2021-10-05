export const MAX_DISPLAY_DATA_SIZE = 204800;
export const MAX_DISPLAY_ITEMS_AUTO_ALL = 250;
export const NODE_NAME_PREFIX = 'node-';

export const PLACEHOLDER_FILLED_AT_EXECUTION_TIME = '[filled at execution time]';

// workflows
export const PLACEHOLDER_EMPTY_WORKFLOW_ID = '__EMPTY__';
export const DEFAULT_NODETYPE_VERSION = 1;
export const DEFAULT_NEW_WORKFLOW_NAME = 'My workflow';
export const MIN_WORKFLOW_NAME_LENGTH = 1;
export const MAX_WORKFLOW_NAME_LENGTH = 128;
export const DUPLICATE_POSTFFIX = ' copy';

// tags
export const MAX_TAG_NAME_LENGTH = 24;

// modals
export const DUPLICATE_MODAL_KEY = 'duplicate';
export const TAGS_MANAGER_MODAL_KEY = 'tagsManager';
export const WORKFLOW_OPEN_MODAL_KEY = 'workflowOpen';
export const VERSIONS_MODAL_KEY = 'versions';
export const WORKFLOW_SETTINGS_MODAL_KEY = 'settings';
export const CREDENTIAL_EDIT_MODAL_KEY = 'editCredential';
export const CREDENTIAL_SELECT_MODAL_KEY = 'selectCredential';
export const CREDENTIAL_LIST_MODAL_KEY = 'credentialsList';
export const ONBOARDING_MODAL_KEY = 'onboarding';

// breakpoints
export const BREAKPOINT_SM = 768;
export const BREAKPOINT_MD = 992;
export const BREAKPOINT_LG = 1200;
export const BREAKPOINT_XL = 1920;


// templates
export const TEMPLATES_BASE_URL = `https://api.n8n.io/`;

export const START_NODE_TYPE = 'n8n-nodes-base.start';
export const WEBHOOK_NODE_TYPE = 'n8n-nodes-base.webhook';
export const CRON_NODE_TYPE = 'n8n-nodes-base.cron';
export const HTTP_REQUEST_NODE_TYPE = 'n8n-nodes-base.httpRequest';
export const FUNCTION_NODE_TYPE = 'n8n-nodes-base.function';
export const ITEM_LISTS_NODE_TYPE = 'n8n-nodes-base.itemLists';
export const IF_NODE_TYPE = 'n8n-nodes-base.if';
export const SWITCH_NODE_TYPE = 'n8n-nodes-base.switch';
export const SALESFORCE_NODE_TYPE = 'n8n-nodes-base.salesforce';
export const ELASTIC_SECURITY_NODE_TYPE = 'n8n-nodes-base.elasticSecurity';
export const JIRA_TRIGGER_NODE_TYPE = 'n8n-nodes-base.jiraTrigger';
export const GITHUB_TRIGGER_NODE_TYPE = 'n8n-nodes-base.githubTrigger';
export const MICROSOFT_EXCEL_NODE_TYPE = 'n8n-nodes-base.microsoftExcel';
export const MICROSOFT_TEAMS_NODE_TYPE = 'n8n-nodes-base.microsoftTeams';
export const CLEARBIT_NODE_TYPE = 'n8n-nodes-base.clearbit';
export const PAGERDUTY_NODE_TYPE = 'n8n-nodes-base.pagerDuty';
export const CALENDLY_TRIGGER_NODE_TYPE = 'n8n-nodes-base.calendlyTrigger';
export const EXECUTE_COMMAND_NODE_TYPE = 'n8n-nodes-base.executeCommand';
export const XERO_NODE_TYPE = 'n8n-nodes-base.xero';
export const QUICKBOOKS_NODE_TYPE = 'n8n-nodes-base.quickbooks';
export const SPREADSHEET_FILE_NODE_TYPE = 'n8n-nodes-base.spreadsheetFile';
export const SET_NODE_TYPE = 'n8n-nodes-base.set';
export const SEGMENT_NODE_TYPE = 'n8n-nodes-base.segment';
export const EMAIl_SEND_NODE_TYPE = 'n8n-nodes-base.emailSend';
export const SLACK_NODE_TYPE = 'n8n-nodes-base.slack';

// Node creator
export const CORE_NODES_CATEGORY = 'Core Nodes';
export const CUSTOM_NODES_CATEGORY = 'Custom Nodes';
export const SUBCATEGORY_DESCRIPTIONS: {
	[category: string]: { [subcategory: string]: string };
} = {
	'Core Nodes': {
		Flow: 'Branches, core triggers, merge data',
		Files:  'Work with CSV, XML, text, images etc.',
		'Data Transformation': 'Manipulate data fields, run code',
		Helpers: 'HTTP Requests (API calls), date and time, scrape HTML',
	},
};
export const REGULAR_NODE_FILTER = 'Regular';
export const TRIGGER_NODE_FILTER = 'Trigger';
export const ALL_NODE_FILTER = 'All';
export const UNCATEGORIZED_CATEGORY = 'Miscellaneous';
export const UNCATEGORIZED_SUBCATEGORY = 'Helpers';
export const PERSONALIZED_CATEGORY = 'Suggested Nodes ✨';
export const HIDDEN_NODES = [START_NODE_TYPE];

export const REQUEST_NODE_FORM_URL = 'https://n8n-community.typeform.com/to/K1fBVTZ3';

// General
export const INSTANCE_ID_HEADER = 'n8n-instance-id';
export const WAIT_TIME_UNLIMITED = '3000-01-01T00:00:00.000Z';


export const AUTOMATION_CONSULTING_WORK_AREA = "automationConsulting";
export const FINANCE_PROCUREMENT_HR_WORK_AREA = "finance-procurment-HR";
export const IT_ENGINEERING_WORK_AREA = "IT-Engineering";
export const LEGAL_WORK_AREA = "legal";
export const MARKETING_WORK_AREA = "marketing-growth";
export const PRODUCT_WORK_AREA = "product";
export const SALES_BUSINESSDEV_WORK_AREA = "sales-businessDevelopment";
export const SECURITY_WORK_AREA = "security";
export const SUPPORT_OPS_WORK_AREA = "support-operations";
export const OTHER_WORK_AREA = "other";

export const COMPANY_SIZE_500_999 = '500-999';
export const COMPANY_SIZE_1000 = '1000+';
