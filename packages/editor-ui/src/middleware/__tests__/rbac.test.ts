import { useRBACStore } from '@/stores/rbac.store';
import { rbac } from '@/middleware/rbac';
import { VIEWS } from '@/constants';
import {
	inferProjectIdFromRoute,
	inferResourceIdFromRoute,
	inferResourceTypeFromRoute,
} from '@/utils/rbacUtils';

vi.mock('@/stores/rbac.store', () => ({
	useRBACStore: vi.fn(),
}));

vi.mock('@/utils/rbacUtils', () => ({
	inferProjectIdFromRoute: vi.fn(),
	inferResourceIdFromRoute: vi.fn(),
	inferResourceTypeFromRoute: vi.fn(),
}));

describe('RBAC Middleware', () => {
	it('should redirect to homepage if the user does not have the required scope', async () => {
		vi.mocked(useRBACStore).mockReturnValue({
			hasScope: vi.fn().mockReturnValue(false),
		});
		vi.mocked(inferProjectIdFromRoute).mockReturnValue('123');
		vi.mocked(inferResourceTypeFromRoute).mockReturnValue('workflow');
		vi.mocked(inferResourceIdFromRoute).mockReturnValue('456');

		const nextMock = vi.fn();
		const scope = 'read:workflow';

		await rbac({}, {}, nextMock, { scope });

		expect(nextMock).toHaveBeenCalledWith({ name: VIEWS.HOMEPAGE });
	});

	it('should allow navigation if the user has the required scope', async () => {
		vi.mocked(useRBACStore).mockReturnValue({
			hasScope: vi.fn().mockReturnValue(true),
		});
		vi.mocked(inferProjectIdFromRoute).mockReturnValue('123');
		vi.mocked(inferResourceTypeFromRoute).mockReturnValue('workflow');
		vi.mocked(inferResourceIdFromRoute).mockReturnValue('456');

		const nextMock = vi.fn();
		const scope = 'read:workflow';

		await rbac({}, {}, nextMock, { scope });

		expect(nextMock).toHaveBeenCalledTimes(0);
	});
});
