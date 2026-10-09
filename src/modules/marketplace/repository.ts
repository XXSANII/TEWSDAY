import { Prisma, student_jobs, tutor_profiles } from '@prisma/client';
import { Transaction, db } from '../../db';
import { first } from '../../common/sql';
import { guard } from '../../common/errors';
import { decodeCursor } from '../../common/pagination';
import { JobSearchInput } from './schemas';

export const jobPublicColumns = Prisma.sql`j.id, j.subject_id, j.target_grade_level, j.target_topics,
  j.learning_goal, j.budget_min, j.budget_max, j.location_type, j.frequency_per_week, j.preferred_days,
  j.status, j.share_count, j.created_at`;

export async function lockJob(tx: Transaction, id: string) {
  return first<student_jobs>(
    tx,
    Prisma.sql`SELECT id, student_id, subject_id, target_grade_level, location_type, status, is_active FROM student_jobs WHERE id = ${id} AND is_active FOR UPDATE`,
  );
}

export async function eligibleApplicant(tx: Transaction, tutorId: string, job: student_jobs) {
  const tutor = await first<tutor_profiles>(
    tx,
    Prisma.sql`
    SELECT t.id, t.user_id, t.account_status FROM tutor_profiles t JOIN users u ON u.id=t.user_id
    WHERE t.id = ${tutorId} AND t.is_active AND u.is_active AND 'TUTOR' = ANY(u.roles) FOR UPDATE OF t
  `,
  );
  guard(
    tutor.account_status === 'ACTIVE',
    403,
    'TUTOR_UNAVAILABLE',
    'Tutor cannot accept new work',
  );
  const subject = await tx.tutor_subjects.findFirst({
    where: { tutor_id: tutor.id, subject_id: job.subject_id, is_active: true },
  });
  const activeSubject = await tx.subjects.findFirst({
    where: { id: job.subject_id, is_active: true },
  });
  guard(
    subject && activeSubject && subject.grade_levels.includes(job.target_grade_level),
    422,
    'SUBJECT_UNSUPPORTED',
    'Tutor must teach this subject and grade',
  );
  const student = await tx.student_profiles.findFirst({
    where: { id: job.student_id, is_active: true },
  });
  const owner =
    student && (await tx.users.findFirst({ where: { id: student.user_id, is_active: true } }));
  guard(student && owner, 409, 'STUDENT_UNAVAILABLE', 'Student account is unavailable');
  guard(
    tutor.user_id !== student!.user_id,
    422,
    'SELF_APPLICATION',
    'Cannot apply to your own job',
  );
  return { tutor, student: student! };
}

export async function jobFeed(input: JobSearchInput) {
  const filters = [
    Prisma.sql`j.is_active AND j.status = 'OPEN' AND s.is_active AND u.is_active AND 'STUDENT' = ANY(u.roles) AND sb.is_active`,
  ];
  const cursor = decodeCursor(input.cursor);
  if (cursor)
    filters.push(Prisma.sql`(j.created_at, j.id) < (${new Date(cursor.created_at)}, ${cursor.id})`);
  if (input.subject_id) filters.push(Prisma.sql`j.subject_id = ${input.subject_id}`);
  if (input.location_type && input.location_type !== 'BOTH')
    filters.push(Prisma.sql`j.location_type::text IN (${input.location_type},'BOTH')`);
  if (input.location_type === 'BOTH') filters.push(Prisma.sql`j.location_type = 'BOTH'`);
  if (input.budget_min != null) filters.push(Prisma.sql`j.budget_max >= ${input.budget_min}`);
  if (input.budget_max != null) filters.push(Prisma.sql`j.budget_min <= ${input.budget_max}`);
  return db.$queryRaw<(student_jobs & { created_at: Date })[]>(Prisma.sql`
    SELECT ${jobPublicColumns} FROM student_jobs j JOIN student_profiles s ON s.id=j.student_id
    JOIN users u ON u.id=s.user_id JOIN subjects sb ON sb.id=j.subject_id
    WHERE ${Prisma.join(filters, ' AND ')} ORDER BY j.created_at DESC, j.id DESC LIMIT ${input.limit + 1}
  `);
}
