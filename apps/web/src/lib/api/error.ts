export interface FieldError {
  field: string;
  code: string;
}

/** Mirrors the API's error shape (PRD §8.3/§8.4) — apps/api/src/common/filters/http-exception.filter.ts. */
export interface ApiErrorBody {
  code: string;
  message: string;
  field_errors?: FieldError[];
  correlation_id: string;
  retryable: boolean;
}

export class ApiError extends Error {
  readonly body: ApiErrorBody;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.body = body;
  }

  fieldError(field: string): string | undefined {
    return this.body.field_errors?.find((e) => e.field === field)?.code;
  }
}
