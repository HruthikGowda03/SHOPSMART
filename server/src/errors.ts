/**
 * Error type used by every route.
 * The error middleware turns it into { ok:false, error:{ code, message, details } }.
 */
export class ApiError extends Error {
  public status: number;
  public code: string;
  public details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new ApiError(400, 'BAD_REQUEST', message, details);

export const notFound = (message: string, details?: Record<string, unknown>) =>
  new ApiError(404, 'NOT_FOUND', message, details);

export const conflict = (message: string, details?: Record<string, unknown>) =>
  new ApiError(409, 'CONFLICT', message, details);