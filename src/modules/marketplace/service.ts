import { Prisma, job_applications } from '@prisma/client';
import { db, Transaction, transaction } from '../../db';
import { newId } from '../../common/ids';
import { guard, requireFound } from '../../common/errors';
import { first } from '../../common/sql';
import { page } from '../../common/pagination';
import { lockUser, ownProfile } from '../profiles/repository';
import { AcceptanceInput, JobInput, JobSearchInput } from './schemas';
import { eligibleApplicant, jobFeed, jobPublicColumns, lockJob } from './repository';

async function notify(
  tx: Transaction,
  actor: string,
  userId: string,
  type: string,
  ref: string,
  priority: 'NORMAL' | 'HIGH',
) {
  await tx.notifications.create({
    data: {
      id: newId('ntf'),
      user_id: userId,
      title: type,
      body: 'A marketplace action requires your attention.',
      type,
      priority_tier: priority,
      reference_type: 'JOB_APPLICATION',
      reference_id: ref,
      created_by: actor,
      updated_by: actor,
    },
  });
}

export const list = async (input: JobSearchInput) => page(await jobFeed(input), input.limit);
export async function detail(id: string) {
  return first(
    db,
    Prisma.sql`SELECT ${jobPublicColumns} FROM student_jobs j JOIN student_profiles s ON s.id=j.student_id
    JOIN users u ON u.id=s.user_id WHERE j.id = ${id} AND j.is_active AND s.is_active AND u.is_active`,
  );
}

export async function create(actor: string, input: JobInput) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const student = await ownProfile(tx, 'student_profiles', actor, true);
    guard(
      await tx.subjects.findFirst({ where: { id: input.subject_id, is_active: true } }),
      422,
      'INVALID_SUBJECT',
      'Subject is unavailable',
    );
    const id = newId('job');
    const location = input.location
      ? Prisma.sql`ST_SetSRID(ST_MakePoint(${input.location.longitude},${input.location.latitude}),4326)`
      : Prisma.sql`NULL`;
    await tx.$executeRaw(Prisma.sql`INSERT INTO student_jobs(id,student_id,subject_id,target_grade_level,target_topics,learning_goal,budget_min,budget_max,location_type,location,frequency_per_week,preferred_days,status,created_by,updated_by)
      VALUES (${id},${student.id},${input.subject_id},${input.target_grade_level},${input.target_topics}::text[],${input.learning_goal},${input.budget_min},${input.budget_max},
      ${input.location_type}::student_jobs_location_type_enum,${location},${input.frequency_per_week},${input.preferred_days}::smallint[],'OPEN',${actor},${actor})`);
    return first(tx, Prisma.sql`SELECT ${jobPublicColumns} FROM student_jobs j WHERE j.id = ${id}`);
  });
}

export async function setStatus(actor: string, jobId: string, status: 'CLOSED' | 'CANCELLED') {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const job = await lockJob(tx, jobId);
    const student = await ownProfile(tx, 'student_profiles', actor);
    guard(
      job.student_id === student.id,
      403,
      'JOB_FORBIDDEN',
      'Only the job owner may change its status',
    );
    if (job.status === status) return detailInTransaction(tx, jobId);
    guard(
      job.status === 'OPEN',
      409,
      'INVALID_JOB_STATE',
      'Only open jobs may be closed or cancelled',
    );
    const applications = await tx.job_applications.findMany({
      where: { job_id: job.id, status: 'PENDING', is_active: true },
    });
    await tx.student_jobs.update({
      where: { id: job.id },
      data: { status, updated_by: actor, updated_at: new Date() },
    });
    await tx.job_applications.updateMany({
      where: { job_id: job.id, status: 'PENDING', is_active: true },
      data: { status: 'REJECTED', updated_by: actor, updated_at: new Date() },
    });
    for (const app of applications) {
      const tutor = requireFound(
        await tx.tutor_profiles.findUnique({ where: { id: app.tutor_id } }),
      );
      await notify(tx, actor, tutor.user_id, 'APPLICATION_REJECTED', app.id, 'NORMAL');
    }
    return detailInTransaction(tx, jobId);
  });
}

const detailInTransaction = (tx: Transaction, id: string) =>
  first(tx, Prisma.sql`SELECT ${jobPublicColumns} FROM student_jobs j WHERE j.id=${id}`);

export async function share(actor: string, jobId: string) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const job = await lockJob(tx, jobId);
    guard(job.status === 'OPEN', 409, 'INVALID_JOB_STATE', 'Only open jobs may be shared');
    const owner = await tx.student_profiles.findFirst({
      where: { id: job.student_id, is_active: true },
    });
    guard(
      owner && (await tx.users.findFirst({ where: { id: owner.user_id, is_active: true } })),
      404,
      'NOT_FOUND',
      'Job not found',
    );
    return tx.student_jobs.update({
      where: { id: job.id },
      data: { share_count: { increment: 1 }, updated_by: actor, updated_at: new Date() },
      select: { id: true, share_count: true },
    });
  });
}

export async function apply(
  actor: string,
  jobId: string,
  proposedRate: number,
  coverMessage: string,
) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const job = await lockJob(tx, jobId);
    guard(job.status === 'OPEN', 409, 'INVALID_JOB_STATE', 'Job is no longer open');
    const profile = await ownProfile(tx, 'tutor_profiles', actor);
    const { tutor, student } = await eligibleApplicant(tx, profile.id, job);
    const existing = await tx.job_applications.findFirst({
      where: { job_id: job.id, tutor_id: tutor.id },
    });
    guard(
      !existing,
      409,
      'ALREADY_APPLIED',
      'Tutor already applied to this job; resubmission policy is unresolved',
    );
    const application = await tx.job_applications.create({
      data: {
        id: newId('app'),
        job_id: job.id,
        tutor_id: tutor.id,
        proposed_rate: proposedRate,
        cover_message: coverMessage,
        status: 'PENDING',
        created_by: actor,
        updated_by: actor,
      },
    });
    await notify(tx, actor, student.user_id, 'APPLICATION_RECEIVED', application.id, 'NORMAL');
    return application;
  });
}

export async function applications(actor: string, jobId: string) {
  const job = requireFound(
    await db.student_jobs.findFirst({ where: { id: jobId, is_active: true } }),
  );
  const student = await db.student_profiles.findFirst({
    where: { id: job.student_id, user_id: actor, is_active: true },
  });
  const tutor = await db.tutor_profiles.findFirst({ where: { user_id: actor, is_active: true } });
  guard(
    student || tutor,
    403,
    'APPLICATIONS_FORBIDDEN',
    'Only the owner or an applicant can view applications',
  );
  return db.job_applications.findMany({
    where: { job_id: job.id, is_active: true, ...(student ? {} : { tutor_id: tutor!.id }) },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: 100,
  });
}

export async function decide(
  actor: string,
  applicationId: string,
  status: 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN',
  input: AcceptanceInput,
  requiredJobId?: string,
) {
  const initial = requireFound(
    await db.job_applications.findFirst({ where: { id: applicationId, is_active: true } }),
  );
  guard(
    !requiredJobId || requiredJobId === initial.job_id,
    404,
    'NOT_FOUND',
    'Application not found for this job',
  );
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const job = await lockJob(tx, initial.job_id);
    const app = await first<job_applications>(
      tx,
      Prisma.sql`SELECT * FROM job_applications WHERE id=${applicationId} AND is_active FOR UPDATE`,
    );
    const student = requireFound(
      await tx.student_profiles.findFirst({ where: { id: job.student_id, is_active: true } }),
    );
    const tutor = requireFound(
      await tx.tutor_profiles.findFirst({ where: { id: app.tutor_id, is_active: true } }),
    );
    if (status === 'WITHDRAWN')
      guard(
        tutor.user_id === actor,
        403,
        'APPLICATION_FORBIDDEN',
        'Only the applicant may withdraw',
      );
    else
      guard(
        student.user_id === actor,
        403,
        'APPLICATION_FORBIDDEN',
        'Only the job owner may decide',
      );
    if (status === 'ACCEPTED' && app.status === 'ACCEPTED') {
      return requireFound(
        await tx.bookings.findFirst({
          where: {
            originating_job_id: job.id,
            tutor_id: app.tutor_id,
            student_id: job.student_id,
            is_active: true,
          },
        }),
      );
    }
    if (status !== 'ACCEPTED' && status === app.status) return app;
    guard(
      job.status === 'OPEN' && app.status === 'PENDING',
      409,
      'INVALID_APPLICATION_STATE',
      'Only pending applications on open jobs may change',
    );
    if (status !== 'ACCEPTED') {
      const changed = await tx.job_applications.update({
        where: { id: app.id },
        data: { status, updated_by: actor, updated_at: new Date() },
      });
      await notify(
        tx,
        actor,
        status === 'WITHDRAWN' ? student.user_id : tutor.user_id,
        `APPLICATION_${status}`,
        app.id,
        'NORMAL',
      );
      return changed;
    }
    await eligibleApplicant(tx, tutor.id, job);
    const locationType =
      input.location_type ?? (job.location_type === 'BOTH' ? undefined : job.location_type);
    guard(
      locationType,
      422,
      'LOCATION_REQUIRED',
      'Choose ONLINE or ONSITE when the job supports BOTH',
    );
    guard(
      job.location_type === 'BOTH' || locationType === job.location_type,
      422,
      'LOCATION_MISMATCH',
      'Booking must use the job teaching mode',
    );
    guard(
      tutor.teaching_location_type === 'BOTH' || tutor.teaching_location_type === locationType,
      422,
      'LOCATION_MISMATCH',
      'Tutor does not support this teaching mode',
    );
    if (locationType === 'ONSITE')
      guard(
        input.meeting_location,
        422,
        'LOCATION_REQUIRED',
        'Onsite booking requires meeting_location',
      );
    const booking = await tx.bookings.create({
      data: {
        id: newId('bkg'),
        student_id: job.student_id,
        tutor_id: tutor.id,
        subject_id: job.subject_id,
        originating_job_id: job.id,
        agreed_hourly_rate: app.proposed_rate,
        location_type: locationType!,
        meeting_location: locationType === 'ONSITE' ? input.meeting_location : null,
        meeting_url: locationType === 'ONLINE' ? input.meeting_url : null,
        status: 'PENDING_CONFIRMATION',
        created_by: actor,
        updated_by: actor,
      },
    });
    await tx.student_jobs.update({
      where: { id: job.id },
      data: { status: 'MATCHED', updated_by: actor, updated_at: new Date() },
    });
    await tx.job_applications.update({
      where: { id: app.id },
      data: { status: 'ACCEPTED', updated_by: actor, updated_at: new Date() },
    });
    const otherApps = await tx.job_applications.findMany({
      where: { job_id: job.id, id: { not: app.id }, status: 'PENDING', is_active: true },
    });
    await tx.job_applications.updateMany({
      where: { job_id: job.id, id: { not: app.id }, status: 'PENDING', is_active: true },
      data: { status: 'REJECTED', updated_by: actor, updated_at: new Date() },
    });
    await notify(tx, actor, tutor.user_id, 'APPLICATION_ACCEPTED', app.id, 'HIGH');
    for (const other of otherApps) {
      const owner = requireFound(
        await tx.tutor_profiles.findUnique({ where: { id: other.tutor_id } }),
      );
      await notify(tx, actor, owner.user_id, 'APPLICATION_REJECTED', other.id, 'NORMAL');
    }
    return booking;
  });
}
