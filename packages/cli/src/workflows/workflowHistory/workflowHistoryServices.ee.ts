import { WorkflowHistoryRepository } from '@db/repositories/workflowHistory.repository';
import { Service } from 'typedi';

@Service()
export class WorkflowHistoryServices {
	constructor(private readonly workflowHistoryRepository: WorkflowHistoryRepository) {}
}
