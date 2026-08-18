export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type SuccessBody<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
};

export type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: { path: string; message: string }[];
  };
  requestId?: string;
};

export function ok<T>(data: T, meta?: PaginationMeta): SuccessBody<T> {
  return meta ? { success: true, data, meta } : { success: true, data };
}

export function fail(
  code: string,
  message: string,
  fields?: { path: string; message: string }[],
  requestId?: string
): ErrorBody {
  const body: ErrorBody = { success: false, error: { code, message } };
  if (fields?.length) body.error.fields = fields;
  if (requestId) body.requestId = requestId;
  return body;
}
