import { Prisma } from '@prisma/client';
import { Transaction } from '../../db';
import { first, updateFields } from '../../common/sql';
import { guard } from '../../common/errors';
import { locationSchema } from '../../common/validation';
import { z } from 'zod';

export interface OwnedProfile {
  id: string;
  user_id: string;
  is_active: boolean;
  account_status?: string;
  [key: string]: unknown;
}
export type ProfileTable = 'tutor_profiles' | 'student_profiles';

export async function ownProfile(
  tx: Transaction,
  table: ProfileTable,
  actor: string,
  lock = false,
) {
  const row = await first<{ data: OwnedProfile }>(
    tx,
    Prisma.sql`
    SELECT to_jsonb(p) - 'location' || jsonb_build_object('location', ST_AsGeoJSON(p.location)::jsonb) AS data
    FROM ${Prisma.raw(table)} p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ${actor} AND p.is_active AND u.is_active
    ${lock ? Prisma.sql`FOR UPDATE OF p` : Prisma.empty}
  `,
  );
  return row.data;
}

export async function lockUser(tx: Transaction, actor: string) {
  const user = await first<{ is_active: boolean }>(
    tx,
    Prisma.sql`SELECT is_active FROM users WHERE id = ${actor} FOR NO KEY UPDATE`,
  );
  guard(user.is_active, 401, 'ACCOUNT_INACTIVE', 'Account is inactive');
}

export async function saveProfileFields(
  tx: Transaction,
  table: ProfileTable,
  id: string,
  actor: string,
  input: Record<string, unknown>,
) {
  const { location, ...fields } = input;
  await updateFields(tx, table, id, fields, actor);
  if (location) {
    const point = location as z.infer<typeof locationSchema>;
    await tx.$executeRaw(
      Prisma.sql`UPDATE ${Prisma.raw(table)} SET location = ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326) WHERE id = ${id}`,
    );
  }
}
