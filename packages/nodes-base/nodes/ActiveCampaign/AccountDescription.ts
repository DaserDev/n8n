import { INodeProperties } from "n8n-workflow";
import {activeCampaignDefaultGetAllProperties} from "./GenericFunctions";

export const accountOperations = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		displayOptions: {
			show: {
				resource: [
					'account',
				],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create an account',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete an account',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get data of an account',
			},
			{
				name: 'Get All',
				value: 'getAll',
				description: 'Get data of all accounts',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an account',
			},
		],
		default: 'create',
		description: 'The operation to perform.',
	},
] as INodeProperties[];

export const accountFields = [
	// ----------------------------------
	//         contact:create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				operation: [
					'create',
				],
				resource: [
					'account',
				],
			},
		},
		description: 'Account\'s name.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		displayOptions: {
			show: {
				operation: [
					'create',
				],
				resource: [
					'account',
				],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Url',
				name: 'accountUrl',
				type: 'string',
				default: '',
				description: 'Account\'s website',
			},
			{
				displayName: 'Custom Properties',
				name: 'customProperties',
				placeholder: 'Add Custom Property',
				description: 'Adds a custom property to set also values which have not been predefined.',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'property',
						displayName: 'Property',
						values: [
							{
								displayName: 'Property Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the property to set.',
							},
							{
								displayName: 'Property Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the property to set.',
							},
						]
					},
				],
			},
		],
	},
	// ----------------------------------
	//         contact:update
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'number',
		displayOptions: {
			show: {
				operation: [
					'update',
				],
				resource: [
					'account',
				],
			},
		},
		default: 0,
		required: true,
		description: 'ID of the account to update.',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		description: 'The fields to update.',
		placeholder: 'Add Field',
		displayOptions: {
			show: {
				operation: [
					'update',
				],
				resource: [
					'account',
				],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Account\'s name.',
			},
			{
				displayName: 'Url',
				name: 'accountUrl',
				type: 'string',
				default: '',
				description: 'Account\'s website',
			},
			{
				displayName: 'Custom Properties',
				name: 'customProperties',
				placeholder: 'Add Custom Property',
				description: 'Adds a custom property to set also values which have not been predefined.',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'property',
						displayName: 'Property',
						values: [
							{
								displayName: 'Property Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the property to set.',
							},
							{
								displayName: 'Property Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the property to set.',
							},
						]
					},
				],
			},
		],
	},
	// ----------------------------------
	//         account:delete
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'number',
		displayOptions: {
			show: {
				operation: [
					'delete',
				],
				resource: [
					'account',
				],
			},
		},
		default: 0,
		required: true,
		description: 'ID of the account to delete.',
	},
	// ----------------------------------
	//         account:get
	// ----------------------------------
	{
		displayName: 'Account ID',
		name: 'accountId',
		type: 'number',
		displayOptions: {
			show: {
				operation: [
					'get',
				],
				resource: [
					'account',
				],
			},
		},
		default: 0,
		required: true,
		description: 'ID of the account to get.',
	},
	// ----------------------------------
	//         account:getAll
	// ----------------------------------
	...activeCampaignDefaultGetAllProperties('account', 'getAll')
] as INodeProperties[];
