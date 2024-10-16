import type { GlobalConfig } from '@n8n/config';
import { QueryFailedError } from '@n8n/typeorm';
import type { ErrorEvent } from '@sentry/types';
import { AxiosError } from 'axios';
import { mock } from 'jest-mock-extended';
import type { InstanceSettings } from 'n8n-core';
import { ApplicationError } from 'n8n-workflow';

import { ErrorReporting } from '@/error-reporting';
import { InternalServerError } from '@/errors/response-errors/internal-server.error';

const init = jest.fn();

jest.mock('@sentry/node', () => ({
	init,
	setTag: jest.fn(),
	captureException: jest.fn(),
	Integrations: {},
}));

jest.spyOn(process, 'on');

describe('initErrorHandling', () => {
	const globalConfig = mock<GlobalConfig>();
	const instanceSettings = mock<InstanceSettings>();
	const errorReporting = new ErrorReporting(globalConfig, instanceSettings);
	const event = {} as ErrorEvent;

	describe('beforeSend', () => {
		it('ignores errors with level warning', async () => {
			const originalException = new InternalServerError('test');
			originalException.level = 'warning';

			expect(await errorReporting.beforeSend(event, { originalException })).toEqual(null);
		});

		it('keeps events with a cause with error level', async () => {
			const cause = new Error('cause-error');
			const originalException = new InternalServerError('test', cause);

			expect(await errorReporting.beforeSend(event, { originalException })).toEqual(event);
		});

		it('ignores events with error cause with warning level', async () => {
			const cause: Error & { level?: 'warning' } = new Error('cause-error');
			cause.level = 'warning';
			const originalException = new InternalServerError('test', cause);

			expect(await errorReporting.beforeSend(event, { originalException })).toEqual(null);
		});

		it('should set level, extra, and tags from ApplicationError', async () => {
			const originalException = new ApplicationError('Test error', {
				level: 'error',
				extra: { foo: 'bar' },
				tags: { tag1: 'value1' },
			});

			const testEvent = {} as ErrorEvent;

			const result = await errorReporting.beforeSend(testEvent, { originalException });

			expect(result).toEqual({
				level: 'error',
				extra: { foo: 'bar' },
				tags: { tag1: 'value1' },
			});
		});

		it('should deduplicate errors with same stack trace', async () => {
			const originalException = new Error();

			const firstResult = await errorReporting.beforeSend(event, { originalException });
			expect(firstResult).toEqual(event);

			const secondResult = await errorReporting.beforeSend(event, { originalException });
			expect(secondResult).toBeNull();
		});

		it('should handle Promise rejections', async () => {
			const originalException = Promise.reject(new Error());

			const result = await errorReporting.beforeSend(event, { originalException });

			expect(result).toEqual(event);
		});

		test.each([
			['undefined', undefined],
			['null', null],
			['an AxiosError', new AxiosError()],
			['a rejected Promise with AxiosError', Promise.reject(new AxiosError())],
			[
				'a QueryFailedError with SQLITE_FULL',
				new QueryFailedError('', [], new Error('SQLITE_FULL')),
			],
			[
				'a QueryFailedError with SQLITE_IOERR',
				new QueryFailedError('', [], new Error('SQLITE_IOERR')),
			],
			['an ApplicationError with "warning" level', new ApplicationError('', { level: 'warning' })],
			[
				'an Error with ApplicationError as cause with "warning" level',
				new Error('', { cause: new ApplicationError('', { level: 'warning' }) }),
			],
		])('ignore if originalException is %s', async (_, originalException) => {
			const result = await errorReporting.beforeSend(event, { originalException });
			expect(result).toBeNull();
		});
	});
});
