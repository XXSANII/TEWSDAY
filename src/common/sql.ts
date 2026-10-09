import { Prisma } from '@prisma/client';
import { Transaction } from '../db';
import { requireFound } from './errors';

export async function first<T>(tx: Transaction, query: Prisma.Sql) {
  return requireFound((await tx.$queryRaw<T[]>(query))[0]);
}

// Table and column names are always service-owned constants, never request input.
export async function updateFields(
  tx: Transaction,
  table: string,
  id: string,
  fields: Record<string, unknown>,
  actor: string,
) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  const enumTypes: Record<string, string> = {
    'tutor_profiles.gender': 'tutor_profiles_gender_enum',
    'tutor_profiles.teaching_location_type': 'tutor_profiles_teaching_location_type_enum',
  };
  const assignments = entries.map(([key, value]) => {
    const enumType = enumTypes[`${table}.${key}`];
    const cast = enumType ? Prisma.sql`::${Prisma.raw(enumType)}` : Prisma.empty;
    return Prisma.sql`${Prisma.raw(`"${key}"`)} = ${value}${cast}`;
  });
  await tx.$executeRaw(Prisma.sql`
    UPDATE ${Prisma.raw(`"${table}"`)}
    SET ${Prisma.join(
      assignments.concat([
        Prisma.sql`updated_by = ${actor}`,
        Prisma.sql`updated_at = CURRENT_TIMESTAMP`,
      ]),
    )}
    WHERE id = ${id}
  `);
}
