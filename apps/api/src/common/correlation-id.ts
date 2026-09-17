export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function readCorrelationId(headerValue: string | string[] | undefined): string | undefined {
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}
