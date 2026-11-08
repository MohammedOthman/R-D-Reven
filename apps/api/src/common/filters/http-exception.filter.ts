import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CORRELATION_ID_HEADER, readCorrelationId } from '../correlation-id';

interface FieldError {
  field: string;
  code: string;
}

interface ErrorResponseBody {
  code: string;
  message: string;
  field_errors?: FieldError[];
  correlation_id: string;
  retryable: boolean;
}

const RETRYABLE_STATUSES = new Set([
  HttpStatus.REQUEST_TIMEOUT,
  HttpStatus.TOO_MANY_REQUESTS,
  HttpStatus.BAD_GATEWAY,
  HttpStatus.SERVICE_UNAVAILABLE,
  HttpStatus.GATEWAY_TIMEOUT,
]);

// Known statuses get a stable, specific code regardless of what NestJS's
// default exception labels the response `error` (e.g. plain "Bad Request").
const CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

/**
 * Normalizes every thrown error into the response shape from PRD §8.3/§8.4:
 * a stable `code`, a human message, optional per-field errors, the request's
 * correlation id and whether the caller may safely retry.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const correlationId =
      readCorrelationId(request.headers[CORRELATION_ID_HEADER]) ?? crypto.randomUUID();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorResponseBody = {
      code: errorCodeFor(exception, status),
      message: messageFor(exception, status),
      correlation_id: correlationId,
      retryable: RETRYABLE_STATUSES.has(status),
    };

    const fieldErrors = fieldErrorsFor(exception);
    if (fieldErrors) {
      body.field_errors = fieldErrors;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${correlationId}] Unhandled exception`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).send(body);
  }
}

function errorCodeFor(exception: unknown, status: number): string {
  const knownCode = CODE_BY_STATUS[status];
  if (knownCode) return knownCode;

  if (exception instanceof HttpException) {
    const responseBody = exception.getResponse();
    if (typeof responseBody === 'object' && responseBody && 'error' in responseBody) {
      return String((responseBody as { error?: unknown }).error)
        .toUpperCase()
        .replace(/\s+/g, '_');
    }
  }
  return 'INTERNAL_ERROR';
}

function messageFor(exception: unknown, status: number): string {
  if (exception instanceof HttpException) {
    const responseBody = exception.getResponse();
    if (typeof responseBody === 'string') return responseBody;
    if (typeof responseBody === 'object' && responseBody && 'message' in responseBody) {
      const message = (responseBody as { message?: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }
    return exception.message;
  }
  return status === HttpStatus.INTERNAL_SERVER_ERROR
    ? 'An unexpected error occurred.'
    : 'Request failed.';
}

// Populated when the global ValidationPipe's `exceptionFactory` (main.ts)
// attaches structured field_errors to a BadRequestException's response body.
function fieldErrorsFor(exception: unknown): FieldError[] | undefined {
  if (!(exception instanceof HttpException)) return undefined;
  const responseBody = exception.getResponse();
  if (typeof responseBody !== 'object' || !responseBody || !('field_errors' in responseBody)) {
    return undefined;
  }
  const fieldErrors = (responseBody as { field_errors?: unknown }).field_errors;
  return Array.isArray(fieldErrors) ? (fieldErrors as FieldError[]) : undefined;
}
