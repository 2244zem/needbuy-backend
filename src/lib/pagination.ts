import type { PaginationMeta } from "./response";

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export type PageParams = { page: number; limit: number };

export function toSkipTake({ page, limit }: PageParams): { skip: number; take: number } {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page, 1);
  return { skip: (safePage - 1) * safeLimit, take: safeLimit };
}

export function buildMeta(params: PageParams, total: number): PaginationMeta {
  const limit = Math.min(Math.max(params.limit, 1), MAX_PAGE_SIZE);
  const page = Math.max(params.page, 1);
  return { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 };
}
