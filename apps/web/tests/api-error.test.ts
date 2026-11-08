import { describe, expect, it } from 'vitest';
import { ApiError } from '@/src/lib/api/error';

describe('ApiError', () => {
  it('exposes the message and correlation id from the API response body', () => {
    const error = new ApiError({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed.',
      correlation_id: 'abc-123',
      retryable: false,
      field_errors: [{ field: 'email', code: 'isEmail' }],
    });

    expect(error.message).toBe('Validation failed.');
    expect(error.body.correlation_id).toBe('abc-123');
  });

  it('finds a field-level error code by field name', () => {
    const error = new ApiError({
      code: 'VALIDATION_FAILED',
      message: 'Validation failed.',
      correlation_id: 'abc-123',
      retryable: false,
      field_errors: [
        { field: 'email', code: 'isEmail' },
        { field: 'password', code: 'minLength' },
      ],
    });

    expect(error.fieldError('email')).toBe('isEmail');
    expect(error.fieldError('password')).toBe('minLength');
    expect(error.fieldError('name')).toBeUndefined();
  });

  it('returns undefined for any field when there are no field_errors', () => {
    const error = new ApiError({
      code: 'CONFLICT',
      message: 'Already exists.',
      correlation_id: 'abc-123',
      retryable: false,
    });

    expect(error.fieldError('email')).toBeUndefined();
  });
});
