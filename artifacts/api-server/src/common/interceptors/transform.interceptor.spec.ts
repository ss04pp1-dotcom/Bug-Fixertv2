import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

const makeContext = (method: string): ExecutionContext => ({
  switchToHttp: () => ({
    getRequest: () => ({ method }),
  }),
} as unknown as ExecutionContext);

const makeHandler = (data: unknown): CallHandler => ({
  handle: () => of(data),
});

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('wraps data in { success, message, data, errors } envelope', (done) => {
    interceptor.intercept(makeContext('GET'), makeHandler({ id: 1 })).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ id: 1 });
      expect(res.errors).toBeNull();
      expect(res.message).toBeDefined();
      done();
    });
  });

  it('uses "Request successful" for GET requests', (done) => {
    interceptor.intercept(makeContext('GET'), makeHandler(null)).subscribe((res) => {
      expect(res.message).toBe('Request successful');
      done();
    });
  });

  it('uses "Created successfully" for POST requests', (done) => {
    interceptor.intercept(makeContext('POST'), makeHandler(null)).subscribe((res) => {
      expect(res.message).toBe('Created successfully');
      done();
    });
  });

  it('uses "Updated successfully" for PUT requests', (done) => {
    interceptor.intercept(makeContext('PUT'), makeHandler(null)).subscribe((res) => {
      expect(res.message).toBe('Updated successfully');
      done();
    });
  });

  it('uses "Updated successfully" for PATCH requests', (done) => {
    interceptor.intercept(makeContext('PATCH'), makeHandler(null)).subscribe((res) => {
      expect(res.message).toBe('Updated successfully');
      done();
    });
  });

  it('uses "Deleted successfully" for DELETE requests', (done) => {
    interceptor.intercept(makeContext('DELETE'), makeHandler(null)).subscribe((res) => {
      expect(res.message).toBe('Deleted successfully');
      done();
    });
  });

  it('passes through arrays unchanged', (done) => {
    const list = [{ id: 1 }, { id: 2 }];
    interceptor.intercept(makeContext('GET'), makeHandler(list)).subscribe((res) => {
      expect(res.data).toEqual(list);
      done();
    });
  });

  it('passes through null data', (done) => {
    interceptor.intercept(makeContext('DELETE'), makeHandler(null)).subscribe((res) => {
      expect(res.data).toBeNull();
      done();
    });
  });
});
