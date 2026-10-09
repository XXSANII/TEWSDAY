import { storage_files_file_category_enum } from '@prisma/client';
import { Transaction } from '../db';
import { guard, requireFound } from './errors';

export async function ownFile(
  tx: Transaction,
  id: string | null | undefined,
  actor: string,
  categories: storage_files_file_category_enum[],
) {
  if (!id) return;
  const file = requireFound(await tx.storage_files.findFirst({ where: { id, is_active: true } }));
  guard(file.created_by === actor, 403, 'FILE_FORBIDDEN', 'File must belong to you');
  guard(categories.includes(file.file_category), 422, 'FILE_CATEGORY', 'Incorrect file category');
}
