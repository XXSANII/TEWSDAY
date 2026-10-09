export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function requireFound<T>(value: T | null | undefined, message = 'Record not found'): T {
  if (!value) throw new ApiError(404, 'NOT_FOUND', message);
  return value;
}

export function guard(condition: unknown, status: number, code: string, message: string) {
  if (!condition) throw new ApiError(status, code, message);
}
