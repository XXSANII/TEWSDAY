import { Prisma } from '@prisma/client';
import { db } from '../../db';
import { decodeCursor } from '../../common/pagination';
import { SearchInput } from './schemas';

export const eligibleTutor = Prisma.sql`t.is_active AND u.is_active AND 'TUTOR' = ANY(u.roles) AND t.account_status = 'ACTIVE'`;
export const publicTutorColumns = Prisma.sql`t.id, t.first_name, t.last_name, t.bio, t.hourly_rate,
  t.teaching_location_type, t.service_radius_km, t.verification_status, t.created_at,
  CASE WHEN t.intro_video_file_id IS NOT NULL AND t.intro_video_status = 'APPROVED'
    THEN t.intro_video_hls_url ELSE NULL END AS intro_video_hls_url`;
export const ratingJoin = Prisma.sql`LEFT JOIN LATERAL (
  SELECT avg(r.rating_score)::float8 AS average_rating, count(*)::int AS review_count
  FROM reviews r WHERE r.tutor_id = t.id AND r.review_type = 'STUDENT_TO_TUTOR' AND r.is_active AND r.is_published
) ratings ON true`;

export interface TutorResult {
  id: string;
  created_at: Date;
  [key: string]: unknown;
}

export async function findTutors(input: SearchInput) {
  const filters: Prisma.Sql[] = [eligibleTutor];
  const cursor = decodeCursor(input.cursor);
  if (cursor)
    filters.push(Prisma.sql`(t.created_at, t.id) < (${new Date(cursor.created_at)}, ${cursor.id})`);
  if (input.subject_id || input.grade_level)
    filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM tutor_subjects ts JOIN subjects s ON s.id = ts.subject_id AND s.is_active
    WHERE ts.tutor_id = t.id AND ts.is_active
    ${input.subject_id ? Prisma.sql`AND ts.subject_id = ${input.subject_id}` : Prisma.empty}
    ${input.grade_level ? Prisma.sql`AND ${input.grade_level} = ANY(ts.grade_levels)` : Prisma.empty}
  )`);
  if (input.location_type && input.location_type !== 'BOTH')
    filters.push(Prisma.sql`t.teaching_location_type::text IN (${input.location_type}, 'BOTH')`);
  if (input.location_type === 'BOTH') filters.push(Prisma.sql`t.teaching_location_type = 'BOTH'`);
  const effectiveRate = input.subject_id
    ? Prisma.sql`COALESCE((SELECT ts.custom_rate FROM tutor_subjects ts WHERE ts.tutor_id = t.id AND ts.subject_id = ${input.subject_id} AND ts.is_active), t.hourly_rate)`
    : Prisma.sql`t.hourly_rate`;
  if (input.min_rate != null) filters.push(Prisma.sql`${effectiveRate} >= ${input.min_rate}`);
  if (input.max_rate != null) filters.push(Prisma.sql`${effectiveRate} <= ${input.max_rate}`);
  if (input.min_rating != null)
    filters.push(Prisma.sql`ratings.average_rating >= ${input.min_rating}`);
  if (input.verification_status)
    filters.push(Prisma.sql`t.verification_status::text = ${input.verification_status}`);
  let distance = Prisma.sql`NULL::float8`;
  if (input.radius_km != null) {
    const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${input.longitude}, ${input.latitude}), 4326)::geography`;
    filters.push(Prisma.sql`t.teaching_location_type IN ('ONSITE','BOTH')`);
    filters.push(
      Prisma.sql`ST_DWithin(t.location::geography, ${point}, ${input.radius_km * 1000})`,
    );
    filters.push(
      Prisma.sql`ST_DWithin(t.location::geography, ${point}, t.service_radius_km * 1000)`,
    );
    distance = Prisma.sql`ST_Distance(t.location::geography, ${point}) / 1000`;
  }
  if (input.available_date)
    filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM tutor_availability a WHERE a.tutor_id = t.id AND a.is_active
    AND ((a.is_recurring AND a.day_of_week = extract(dow FROM ${input.available_date}::date)) OR (NOT a.is_recurring AND a.specific_date = ${input.available_date}::date))
    AND a.start_time <= ${input.start_time}::time AND a.end_time >= ${input.end_time}::time
  )`);
  return db.$queryRaw<TutorResult[]>(Prisma.sql`
    SELECT ${publicTutorColumns}, ${effectiveRate} AS effective_hourly_rate,
      ratings.average_rating, ratings.review_count, ${distance} AS distance_km
    FROM tutor_profiles t JOIN users u ON u.id = t.user_id ${ratingJoin}
    WHERE ${Prisma.join(filters, ' AND ')}
    ORDER BY t.created_at DESC, t.id DESC LIMIT ${input.limit + 1}
  `);
}
