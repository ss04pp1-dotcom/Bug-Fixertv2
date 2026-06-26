import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ApiErrorResponse {
  success: false;
  message: string;
  data: null;
  errors: Record<string, string[]> | string[] | null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Record<string, string[]> | string[] | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const bodyObj = body as Record<string, unknown>;
        message = typeof bodyObj['message'] === 'string'
          ? bodyObj['message']
          : Array.isArray(bodyObj['message'])
            ? (bodyObj['message'] as string[]).join('; ')
            : message;
        if (Array.isArray(bodyObj['message'])) {
          errors = bodyObj['message'] as string[];
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
      } else if (exception.code === 'P2025' || exception.code === 'P2003' || exception.code === 'P2001') {
        status = HttpStatus.NOT_FOUND;
      } else if (exception.code === 'P2021' || exception.code === 'P2022') {
        status  = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database schema is out of sync — please contact support';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
      }
      if (status !== HttpStatus.SERVICE_UNAVAILABLE) {
        message = this.parsePrismaError(exception);
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status  = HttpStatus.BAD_REQUEST;
      message = 'Invalid query parameters';
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status  = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection failed — please try again later';
      this.logger.error(
        `DB init error: ${exception.message}`,
        exception.stack,
      );
    } else if (exception instanceof Error) {
      message = 'Internal server error';
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    }

    if (status >= 500) {
      this.logger.error(
        `[${status}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${status}] ${request.method} ${request.url} — ${message}`,
      );
    }

    const body: ApiErrorResponse = { success: false, message, data: null, errors };
    response.status(status).json(body);
  }

  private parsePrismaError(e: Prisma.PrismaClientKnownRequestError): string {
    switch (e.code) {
      case 'P2002': return `A record with that ${(e.meta?.['target'] as string[] | undefined)?.[0] ?? 'value'} already exists`;
      case 'P2025': return 'Record not found';
      case 'P2003': return 'Related record not found';
      case 'P2014': return 'The change would violate a required relation';
      default:      return 'Database operation failed';
    }
  }
}
