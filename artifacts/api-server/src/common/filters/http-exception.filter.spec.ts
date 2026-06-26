import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';

const makeHost = (method = 'GET', url = '/api/test') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status };

  const req = { method, url, ip: '127.0.0.1', get: jest.fn(() => 'jest-agent') };

  return {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
};

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('handles HttpException with a string message', () => {
    const host = makeHost();
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    filter.catch(exception, host);

    const res = host.switchToHttp().getResponse() as { status: jest.Mock };
    const statusFn = res.status;
    expect(statusFn).toHaveBeenCalledWith(404);
    const jsonArg = statusFn.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.message).toBe('Not found');
  });

  it('handles HttpException with an object body', () => {
    const host = makeHost();
    const exception = new HttpException({ message: 'Conflict', error: 'Conflict' }, HttpStatus.CONFLICT);
    filter.catch(exception, host);

    const statusFn = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusFn).toHaveBeenCalledWith(409);
  });

  it('handles validation errors (array of messages)', () => {
    const host = makeHost('POST', '/api/v1/auth/register');
    const exception = new HttpException(
      { message: ['email must be valid', 'password too short'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, host);

    const statusFn = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusFn).toHaveBeenCalledWith(400);
    const jsonArg = statusFn.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.errors).toEqual(['email must be valid', 'password too short']);
  });

  it('handles Prisma P2002 unique constraint as 409 Conflict', () => {
    const host = makeHost('POST');
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['email'] },
    });
    filter.catch(prismaError, host);

    const statusFn = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusFn).toHaveBeenCalledWith(409);
    const jsonArg = statusFn.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.message).toContain('email');
  });

  it('handles Prisma P2025 record not found as 409', () => {
    const host = makeHost();
    const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });
    filter.catch(prismaError, host);

    const statusFn = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusFn).toHaveBeenCalledWith(409);
    const jsonArg = statusFn.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.message).toBe('Record not found');
  });

  it('handles unknown errors as 500', () => {
    const host = makeHost();
    filter.catch(new Error('Unexpected crash'), host);

    const statusFn = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusFn).toHaveBeenCalledWith(500);
    const jsonArg = statusFn.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.data).toBeNull();
  });

  it('wraps all responses with { success: false, data: null, errors }', () => {
    const host = makeHost();
    filter.catch(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED), host);

    const statusFn = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    const jsonArg = statusFn.mock.results[0].value.json.mock.calls[0][0];
    expect(jsonArg).toMatchObject({ success: false, data: null });
  });
});
