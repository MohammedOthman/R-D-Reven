import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';

/**
 * Turns class-validator's per-property `ValidationError[]` into the
 * `field_errors` shape from PRD §8.3/§8.4 — `HttpExceptionFilter` reads this
 * off the exception's response body and forwards it verbatim.
 */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  const field_errors = errors.map((error) => ({
    field: error.property,
    code: Object.keys(error.constraints ?? {})[0] ?? 'invalid',
  }));

  return new BadRequestException({
    message: 'Validation failed.',
    field_errors,
  });
}
