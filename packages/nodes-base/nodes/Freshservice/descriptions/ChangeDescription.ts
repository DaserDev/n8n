import {
	INodeProperties,
} from 'n8n-workflow';

export const changeOperations = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		displayOptions: {
			show: {
				resource: [
					'change',
				],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a change',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a change',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a change',
			},
			{
				name: 'Get All',
				value: 'getAll',
				description: 'Retrieve all changes',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a change',
			},
		],
		default: 'create',
	},
] as INodeProperties[];

export const changeFields = [
	// ----------------------------------------
	//              change: create
	// ----------------------------------------
	{
		displayName: 'Requester ID',
		name: 'requesterId',
		description: 'ID of the requester of the change',
		type: 'options',
		required: true,
		default: '',
		typeOptions: {
			loadOptionsMethod: [
				'getRequesters',
			],
		},
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'create',
				],
			},
		},
	},
	{
		displayName: 'Planned Start Date',
		name: 'planned_start_date',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'create',
				],
			},
		},
	},
	{
		displayName: 'Planned End Date',
		name: 'planned_end_date',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'create',
				],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'create',
				],
			},
		},
		options: [
			{
				displayName: 'Agent ID',
				name: 'agent_id',
				type: 'options',
				default: '',
				description: 'ID of the agent to whom the change is assigned',
				typeOptions: {
					loadOptionsMethod: [
						'getAgents',
					],
				},
			},
			{
				displayName: 'Change Type',
				name: 'change_type',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Minor',
						value: 1,
					},
					{
						name: 'Standard',
						value: 2,
					},
					{
						name: 'Major',
						value: 3,
					},
					{
						name: 'Emergency',
						value: 4,
					},
				],
			},
			{
				displayName: 'Department ID',
				name: 'department_id',
				type: 'options',
				default: '',
				description: 'ID of the department requesting the change',
				typeOptions: {
					loadOptionsMethod: [
						'getDepartments',
					],
				},
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'HTML supported',
			},
			{
				displayName: 'Group ID',
				name: 'group_id',
				type: 'options',
				default: '',
				description: 'ID of the agent group to which the change is assigned',
				typeOptions: {
					loadOptionsMethod: [
						'getAgentGroups',
					],
				},
			},
			{
				displayName: 'Impact',
				name: 'impact',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Low',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'High',
						value: 3,
					},
				],
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Low',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'High',
						value: 3,
					},
					{
						name: 'Urgent',
						value: 4,
					},
				],
			},
			{
				displayName: 'Risk',
				name: 'risk',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Low',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'High',
						value: 3,
					},
					{
						name: 'Very High',
						value: 4,
					},
				],
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Open',
						value: 1,
					},
					{
						name: 'Planning',
						value: 2,
					},
					{
						name: 'Approval',
						value: 3,
					},
					{
						name: 'Pending Release',
						value: 4,
					},
					{
						name: 'Pending Review',
						value: 5,
					},
					{
						name: 'Closed',
						value: 6,
					},
				],
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
			},
		],
	},

	// ----------------------------------------
	//              change: delete
	// ----------------------------------------
	{
		displayName: 'Change ID',
		name: 'changeId',
		description: 'ID of the change to delete',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'delete',
				],
			},
		},
	},

	// ----------------------------------------
	//               change: get
	// ----------------------------------------
	{
		displayName: 'Change ID',
		name: 'changeId',
		description: 'ID of the change to retrieve',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'get',
				],
			},
		},
	},

	// ----------------------------------------
	//              change: getAll
	// ----------------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'getAll',
				],
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'How many results to return',
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'getAll',
				],
				returnAll: [
					false,
				],
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'getAll',
				],
			},
		},
		options: [
			{
				displayName: 'Predefined Filters',
				name: 'type',
				type: 'options',
				default: 'my_open',
				options: [
					{
						name: 'Closed',
						value: 'closed',
					},
					{
						name: 'My Open',
						value: 'my_open',
					},
					{
						name: 'Release Requested',
						value: 'release_requested',
					},
					{
						name: 'Requester ID',
						value: 'requester_id',
					},
					{
						name: 'Unassigned',
						value: 'unassigned',
					},
				],
			},
			{
				displayName: 'Sort Order',
				name: 'sort_by',
				type: 'options',
				options: [
					{
						name: 'Ascending',
						value: 'asc',
					},
					{
						name: 'Descending',
						value: 'desc',
					},
				],
				default: 'asc',
			},
			{
				displayName: 'Updated Since',
				name: 'updated_since',
				type: 'dateTime',
				default: '',
			},
		],
	},

	// ----------------------------------------
	//              change: update
	// ----------------------------------------
	{
		displayName: 'Change ID',
		name: 'changeId',
		description: 'ID of the change to update',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'update',
				],
			},
		},
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: [
					'change',
				],
				operation: [
					'update',
				],
			},
		},
		options: [
			{
				displayName: 'Agent ID',
				name: 'agent_id',
				type: 'options',
				default: '',
				description: 'ID of the agent to whom the change is assigned',
				typeOptions: {
					loadOptionsMethod: [
						'getAgents',
					],
				},
			},
			{
				displayName: 'Change Type',
				name: 'change_type',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Minor',
						value: 1,
					},
					{
						name: 'Standard',
						value: 2,
					},
					{
						name: 'Major',
						value: 3,
					},
					{
						name: 'Emergency',
						value: 4,
					},
				],
			},
			{
				displayName: 'Department ID',
				name: 'department_id',
				type: 'options',
				default: '',
				description: 'ID of the department requesting the change',
				typeOptions: {
					loadOptionsMethod: [
						'getDepartments',
					],
				},
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description: 'HTML supported',
			},
			{
				displayName: 'Group ID',
				name: 'group_id',
				type: 'options',
				default: '',
				description: 'ID of the agent group to which the change is assigned',
				typeOptions: {
					loadOptionsMethod: [
						'getAgentGroups',
					],
				},
			},
			{
				displayName: 'Impact',
				name: 'impact',
				type: 'options',
				default: 1,
				description: 'Impact of the change',
				options: [
					{
						name: 'Low',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'High',
						value: 3,
					},
				],
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Low',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'High',
						value: 3,
					},
					{
						name: 'Urgent',
						value: 4,
					},
				],
			},
			{
				displayName: 'Requester ID',
				name: 'requester_id',
				type: 'options',
				default: '',
				description: 'ID of the requester of the change',
				typeOptions: {
					loadOptionsMethod: [
						'getRequesters',
					],
				},
			},
			{
				displayName: 'Risk',
				name: 'risk',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Low',
						value: 1,
					},
					{
						name: 'Medium',
						value: 2,
					},
					{
						name: 'High',
						value: 3,
					},
					{
						name: 'Very High',
						value: 4,
					},
				],
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: 1,
				options: [
					{
						name: 'Open',
						value: 1,
					},
					{
						name: 'Planning',
						value: 2,
					},
					{
						name: 'Approval',
						value: 3,
					},
					{
						name: 'Pending Release',
						value: 4,
					},
					{
						name: 'Pending Review',
						value: 5,
					},
					{
						name: 'Closed',
						value: 6,
					},
				],
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
			},
		],
	},
] as INodeProperties[];
