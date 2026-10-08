import { z } from 'zod';
import { ApiError } from './errors';

export const paginationSchema = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
};

const cursorSchema = z.object({ created_at: z.iso.datetime(), id: z.string().max(36) }).strict();
export function decodeCursor(value?: string) {
  if (!value) return null;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
  }
}

export function page<T extends { id: string; created_at: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    next_cursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({ created_at: last.created_at.toISOString(), id: last.id }),
          ).toString('base64url')
        : null,
  };
}
