import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

export const entityId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9]{1,32}$`));
