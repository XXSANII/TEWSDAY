import { Prisma } from '@prisma/client';
import { db } from '../../db';
import { requireFound } from '../../common/errors';
import { page } from '../../common/pagination';
import { SearchInput } from './schemas';
import { eligibleTutor, findTutors, publicTutorColumns, ratingJoin } from './repository';

export const search = async (input: SearchInput) => page(await findTutors(input), input.limit);

export async function publicAvailability(id: string) {
  requireFound(
    (
      await db.$queryRaw<
        { id: string }[]
      >`SELECT t.id FROM tutor_profiles t JOIN users u ON u.id=t.user_id WHERE t.id=${id} AND ${eligibleTutor}`
    )[0],
  );
  return db.$queryRaw`SELECT id, is_recurring, day_of_week, specific_date::text, start_time::text, end_time::text
    FROM tutor_availability WHERE tutor_id = ${id} AND is_active ORDER BY day_of_week, specific_date, start_time, id`;
}

export async function detail(id: string) {
  const tutor = requireFound(
    (
      await db.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT ${publicTutorColumns}, ratings.average_rating, ratings.review_count
    FROM tutor_profiles t JOIN users u ON u.id = t.user_id ${ratingJoin}
    WHERE t.id = ${id} AND ${eligibleTutor}
  `)
    )[0],
  );
  const [subjects, education, reviews] = await Promise.all([
    db.$queryRaw`SELECT s.id, s.name_th, s.name_en, s.category, ts.grade_levels, ts.specialized_topics, ts.custom_rate
      FROM tutor_subjects ts JOIN subjects s ON s.id = ts.subject_id AND s.is_active
      WHERE ts.tutor_id = ${id} AND ts.is_active ORDER BY s.id`,
    db.tutor_education.findMany({
      where: { tutor_id: id, is_active: true },
      select: {
        id: true,
        institution: true,
        degree: true,
        major: true,
        graduation_year: true,
        is_verified: true,
      },
      orderBy: { created_at: 'desc' },
    }),
    db.reviews.findMany({
      where: { tutor_id: id, review_type: 'STUDENT_TO_TUTOR', is_active: true, is_published: true },
      select: { id: true, rating_score: true, comment: true, created_at: true },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 20,
    }),
  ]);
  return { ...tutor, subjects, education, reviews };
}
