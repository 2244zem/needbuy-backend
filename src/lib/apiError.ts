export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: { path: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: { path: string; message: string }[]
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message: string, code = "BAD_REQUEST") {
    return new AppError(400, code, message);
  }

  static unauthorized(message = "Autentikasi diperlukan.", code = "UNAUTHORIZED") {
    return new AppError(401, code, message);
  }

  static forbidden(message = "Kamu nggak boleh buka resource ini.", code = "FORBIDDEN") {
    return new AppError(403, code, message);
  }

  static notFound(message = "Resource nggak ketemu.", code = "NOT_FOUND") {
    return new AppError(404, code, message);
  }

  static conflict(message: string, code = "CONFLICT") {
    return new AppError(409, code, message);
  }

  static unprocessable(
    message: string,
    fields?: { path: string; message: string }[],
    code = "VALIDATION_ERROR"
  ) {
    return new AppError(422, code, message, fields);
  }

  static tooManyRequests(message = "Terlalu banyak permintaan.", code = "TOO_MANY_REQUESTS") {
    return new AppError(429, code, message);
  }

  static serviceUnavailable(
    message = "Layanan sedang nggak tersedia.",
    code = "SERVICE_UNAVAILABLE"
  ) {
    return new AppError(503, code, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}