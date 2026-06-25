import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

const makeContext = (method = 'GET', url = '/api/test', statusCode = 200): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({ method, url, ip: '127.0.0.1', get: () => 'jest' }),
    getResponse: () => ({ statusCode }),
  }),
} as unknown as ExecutionContext);

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('passes through the response data unchanged', (done) => {
    const data = { id: 1, name: 'test' };
    const handler: CallHandler = { handle: () => of(data) };

    interceptor.intercept(makeContext(), handler).subscribe((result) => {
      expect(result).toEqual(data);
      done();
    });
  });

  it('does not suppress errors', (done) => {
    const handler: CallHandler = { handle: () => throwError(() => new Error('downstream error')) };

    interceptor.intercept(makeContext(), handler).subscribe({
      error: (err: Error) => {
        expect(err.message).toBe('downstream error');
        done();
      },
    });
  });

  it('logs GET requests', (done) => {
    const logSpy = jest.spyOn((interceptor as unknown as { logger: { log: jest.Mock } }).logger, 'log')
      .mockImplementation(() => {});
    const handler: CallHandler = { handle: () => of('ok') };

    interceptor.intercept(makeContext('GET', '/api/v1/channels'), handler).subscribe(() => {
      expect(logSpy).toHaveBeenCalled();
      done();
    });
  });
});
