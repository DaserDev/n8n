import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class FreshworksCrmApi implements ICredentialType {
	name = 'freshworksCrmApi';
	displayName = 'Freshworks CRM API';
	documentationUrl = 'freshdesk';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			default: '',
			placeholder: 'BDsTn15vHezBlt_XGp3Tig',
		},
		{
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: '',
			placeholder: 'n8n-org',
			description: 'Domain in the Freshworks CRM org URL. For example, in <code>https://n8n-org.myfreshworks.com</code>, the domain is <code>n8n-org</code>.',
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'options',
			options: [
				{
					name: 'freshworks.com',
					value: 'freshworks.com',
				},
				{
					name: 'myfreshworks.com',
					value: 'myfreshworks.com',
				},
				{
					name: 'Custom',
					value: 'custom',
				},
			],
			default: 'myfreshworks.com',
		},
		{
			displayName: 'Custom Host',
			name: 'customHost',
			type: 'string',
			displayOptions: {
				show: {
					host: [
						'custom',
					],
				},
			},
			default: '',
		},
	];
}
