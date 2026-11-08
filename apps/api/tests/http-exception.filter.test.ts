import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  type ArgumentsHost,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

function mockHost(headers: Record<string, string> = {}): {
  host: ArgumentsHost;
  send: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ headers }),
    }),
  } as unknown as ArgumentsHost;
  return { host, send, status };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps a validation BadRequestException to VALIDATION_FAILED with field_errors', () => {
    const { host, send, status } = mockHost();
    const exception = new BadRequestException({
      message: 'Validation failed.',
      field_errors: [{ field: 'email', code: 'isEmail' }],
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        field_errors: [{ field: 'email', code: 'isEmail' }],
        retryable: false,
      }),
    );
  });

  it('maps UnauthorizedException to UNAUTHENTICATED', () => {
    const { host, send, status } = mockHost();
    filter.catch(new UnauthorizedException('Not signed in.'), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'UNAUTHENTICATED', message: 'Not signed in.' }),
    );
  });

  it('maps ConflictException to CONFLICT', () => {
    const { host, send, status } = mockHost();
    filter.catch(new ConflictException('Already exists.'), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }));
  });

  it('maps an unknown thrown value to a generic 500 without leaking details', () => {
    const { host, send, status } = mockHost();
    filter.catch(new Error('boom — a secret stack trace detail'), host);

    expect(status).toHaveBeenCalledWith(500);
    const [payload] = send.mock.calls[0] as [{ code: string; message: string }];
    expect(payload.code).toBe('INTERNAL_ERROR');
    expect(payload.message).toBe('An unexpected error occurred.');
  });

  it('reuses an incoming correlation id instead of minting a new one', () => {
    const { host, send } = mockHost({ 'x-correlation-id': 'given-id-123' });
    filter.catch(new UnauthorizedException(), host);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ correlation_id: 'given-id-123' }));
  });
});
