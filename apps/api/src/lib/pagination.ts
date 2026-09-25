import { z } from "@hono/zod-openapi";

/**
 * Cursor pagination — CLAUDE.md: "cursor pagination `{ data, nextCursor }`." The cursor is just
 * the last row's `id`, base64url-encoded: UUIDv7 ids are time-sortable (docs/CONTEXT.md section
 * 18 decision 6), so `ORDER BY id` is already the natural, stable order — no separate
 * `created_at` cursor column needed.
 */

export const paginationQuerySchema = z.object({
  cursor: z.string().optional().openapi({ description: "Opaque cursor from a previous page" }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    description: "Max items to return (1-100)",
  }),
});

export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, "base64url").toString("utf8");
}

/**
 * Call with `limit + 1` rows fetched from the DB (ordered by `id`) — this trims the lookahead
 * row back off and turns its presence into `nextCursor`, without a separate COUNT query.
 */
export function buildCursorPage<T extends { id: string }>(
  rowsWithLookahead: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = rowsWithLookahead.length > limit;
  const data = hasMore ? rowsWithLookahead.slice(0, limit) : rowsWithLookahead;
  const last = data.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.id) : null;
  return { data, nextCursor };
}
