import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db, transaction } from '../../db';
import { guard, requireFound } from '../../common/errors';
import { newId } from '../../common/ids';
import { ownFile } from '../../common/files';
import { ownProfile, lockUser, saveProfileFields, ProfileTable } from './repository';
import * as schemas from './schemas';

export const getOwn = (table: ProfileTable, actor: string) => ownProfile(db, table, actor);

export async function createStudent(actor: string, input: schemas.StudentInput) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    guard(
      !(await tx.student_profiles.findUnique({ where: { user_id: actor } })),
      409,
      'PROFILE_EXISTS',
      'A student profile already exists',
    );
    const id = newId('std');
    await tx.$executeRaw`INSERT INTO student_profiles(id, user_id, first_name, last_name, current_grade_level, school_name, location, created_by, updated_by)
      VALUES (${id}, ${actor}, ${input.first_name}, ${input.last_name}, ${input.current_grade_level}, ${input.school_name},
      ST_SetSRID(ST_MakePoint(${input.location.longitude}, ${input.location.latitude}),4326), ${actor}, ${actor})`;
    await tx.$executeRaw`UPDATE users SET roles = CASE WHEN 'STUDENT' = ANY(roles) THEN roles ELSE array_append(roles, 'STUDENT'::varchar) END, updated_by = ${actor}, updated_at = CURRENT_TIMESTAMP WHERE id = ${actor}`;
    return ownProfile(tx, 'student_profiles', actor);
  });
}

export async function createTutor(actor: string, input: schemas.TutorInput) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    guard(
      !(await tx.tutor_profiles.findUnique({ where: { user_id: actor } })),
      409,
      'PROFILE_EXISTS',
      'A tutor profile already exists',
    );
    const id = newId('tut');
    await tx.$executeRaw(Prisma.sql`INSERT INTO tutor_profiles(id, user_id, first_name, last_name, gender, bio, hourly_rate,
      teaching_location_type, location, service_radius_km, intro_video_status, verification_status, account_status, created_by, updated_by)
      VALUES (${id}, ${actor}, ${input.first_name}, ${input.last_name}, ${input.gender}::tutor_profiles_gender_enum, ${input.bio}, ${input.hourly_rate},
      ${input.teaching_location_type}::tutor_profiles_teaching_location_type_enum,
      ST_SetSRID(ST_MakePoint(${input.location.longitude}, ${input.location.latitude}),4326), ${input.service_radius_km},
      'PROCESSING', 'UNVERIFIED', 'ACTIVE', ${actor}, ${actor})`);
    await saveProfileFields(tx, 'tutor_profiles', id, actor, {
      promptpay_identifier: input.promptpay_identifier,
      bank_code: input.bank_code,
      bank_account_number: input.bank_account_number,
      bank_account_name: input.bank_account_name,
    });
    await tx.$executeRaw`UPDATE users SET roles = CASE WHEN 'TUTOR' = ANY(roles) THEN roles ELSE array_append(roles, 'TUTOR'::varchar) END, updated_by = ${actor}, updated_at = CURRENT_TIMESTAMP WHERE id = ${actor}`;
    return ownProfile(tx, 'tutor_profiles', actor);
  });
}

export async function updateOwn(
  table: ProfileTable,
  actor: string,
  input: Record<string, unknown>,
) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const profile = await ownProfile(tx, table, actor, true);
    if (table === 'tutor_profiles')
      guard(
        profile.account_status !== 'SUSPENDED',
        403,
        'TUTOR_SUSPENDED',
        'Tutor account is suspended',
      );
    await saveProfileFields(tx, table, profile.id, actor, input);
    return ownProfile(tx, table, actor);
  });
}

export async function addEducation(actor: string, input: z.infer<typeof schemas.educationSchema>) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const tutor = await ownProfile(tx, 'tutor_profiles', actor, true);
    guard(
      tutor.account_status !== 'SUSPENDED',
      403,
      'TUTOR_SUSPENDED',
      'Tutor account is suspended',
    );
    await ownFile(tx, input.verification_document_file_id, actor, ['VERIFICATION_DOC']);
    return tx.tutor_education.create({
      data: {
        id: newId('edu'),
        tutor_id: tutor.id,
        ...input,
        is_verified: false,
        created_by: actor,
        updated_by: actor,
      },
    });
  });
}

export async function removeEducation(actor: string, educationId: string) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const tutor = await ownProfile(tx, 'tutor_profiles', actor, true);
    guard(
      tutor.account_status !== 'SUSPENDED',
      403,
      'TUTOR_SUSPENDED',
      'Tutor account is suspended',
    );
    const edu = requireFound(
      await tx.tutor_education.findFirst({
        where: { id: educationId, tutor_id: tutor.id, is_active: true },
      }),
    );
    guard(
      !edu.is_verified,
      409,
      'CHANGE_REQUEST_REQUIRED',
      'Verified education must be changed through a change request',
    );
    await tx.tutor_education.update({
      where: { id: edu.id },
      data: { is_active: false, updated_by: actor, updated_at: new Date() },
    });
  });
}

export async function availability(actor: string) {
  const tutor = await ownProfile(db, 'tutor_profiles', actor);
  return db.$queryRaw(
    Prisma.sql`SELECT id, is_recurring, day_of_week, specific_date::text, start_time::text, end_time::text FROM tutor_availability WHERE tutor_id = ${tutor.id} AND is_active ORDER BY day_of_week, specific_date, start_time, id`,
  );
}

export async function replaceAvailability(
  actor: string,
  input: z.infer<typeof schemas.availabilitySchema>,
) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const tutor = await ownProfile(tx, 'tutor_profiles', actor, true);
    guard(
      tutor.account_status !== 'SUSPENDED',
      403,
      'TUTOR_SUSPENDED',
      'Tutor account is suspended',
    );
    await tx.tutor_availability.updateMany({
      where: { tutor_id: tutor.id, is_active: true },
      data: { is_active: false, updated_by: actor, updated_at: new Date() },
    });
    for (const slot of input.slots) {
      await tx.$executeRaw`INSERT INTO tutor_availability(id,tutor_id,is_recurring,day_of_week,specific_date,start_time,end_time,created_by,updated_by)
        VALUES (${newId('tav')},${tutor.id},${slot.is_recurring},${slot.day_of_week ?? null},${slot.specific_date ?? null}::date,${slot.start_time}::time,${slot.end_time}::time,${actor},${actor})`;
    }
    return { updated_slots: input.slots.length };
  });
}

export async function replaceSubjects(
  actor: string,
  input: z.infer<typeof schemas.subjectsSchema>,
) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const tutor = await ownProfile(tx, 'tutor_profiles', actor, true);
    guard(
      tutor.account_status !== 'SUSPENDED',
      403,
      'TUTOR_SUSPENDED',
      'Tutor account is suspended',
    );
    const ids = input.subjects.map((s) => s.subject_id);
    const count = await tx.subjects.count({ where: { id: { in: ids }, is_active: true } });
    guard(count === ids.length, 422, 'INVALID_SUBJECT', 'One or more subjects are unavailable');
    await tx.tutor_subjects.updateMany({
      where: { tutor_id: tutor.id, is_active: true },
      data: { is_active: false, updated_by: actor, updated_at: new Date() },
    });
    for (const subject of input.subjects) {
      await tx.tutor_subjects.upsert({
        where: { tutor_id_subject_id: { tutor_id: tutor.id, subject_id: subject.subject_id } },
        create: { tutor_id: tutor.id, ...subject, created_by: actor, updated_by: actor },
        update: { ...subject, is_active: true, updated_by: actor, updated_at: new Date() },
      });
    }
    return tx.tutor_subjects.findMany({ where: { tutor_id: tutor.id, is_active: true } });
  });
}

export async function changeRequest(
  actor: string,
  input: z.infer<typeof schemas.changeRequestSchema>,
) {
  return transaction(actor, async (tx) => {
    await lockUser(tx, actor);
    const tutor = await ownProfile(tx, 'tutor_profiles', actor, true);
    guard(
      tutor.account_status !== 'SUSPENDED',
      403,
      'TUTOR_SUSPENDED',
      'Tutor account is suspended',
    );
    await ownFile(tx, input.supporting_document_file_id, actor, ['CHANGE_REQUEST_DOC']);
    const existing = await tx.profile_change_requests.findFirst({
      where: {
        tutor_id: tutor.id,
        request_type: input.request_type,
        status: 'PENDING',
        is_active: true,
      },
    });
    guard(!existing, 409, 'REQUEST_PENDING', 'A request of this type is already pending');
    let currentData: Prisma.InputJsonValue = {
      first_name: tutor.first_name as string,
      last_name: tutor.last_name as string,
    };
    if (input.request_type === 'EDUCATION') {
      await ownFile(tx, input.requested_changes.verification_document_file_id, actor, [
        'VERIFICATION_DOC',
      ]);
      const id = input.requested_changes.education_id;
      const current = id
        ? requireFound(
            await tx.tutor_education.findFirst({
              where: { id, tutor_id: tutor.id, is_active: true },
            }),
          )
        : null;
      currentData = current
        ? {
            id: current.id,
            institution: current.institution,
            degree: current.degree,
            major: current.major,
            graduation_year: current.graduation_year,
          }
        : {};
    }
    return tx.profile_change_requests.create({
      data: {
        id: newId('pcr'),
        tutor_id: tutor.id,
        user_id: actor,
        request_type: input.request_type,
        current_data: currentData,
        requested_changes: input.requested_changes,
        supporting_document_file_id: input.supporting_document_file_id,
        created_by: actor,
        updated_by: actor,
      },
    });
  });
}
