import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Express } from 'express';
import { db } from '../../src/db';
import { newId } from '../../src/common/ids';
import { config } from '../../src/config';

export const subjectId = 'sbj_mathematics';
export const tutorBody = {
  first_name: 'Tutor',
  last_name: 'Example',
  gender: 'PREFER_NOT_TO_SAY',
  bio: 'Calculus and mathematics tutor',
  hourly_rate: 500,
  teaching_location_type: 'BOTH',
  location: { longitude: 100.5, latitude: 13.75 },
  service_radius_km: 25,
  promptpay_identifier: 'PRIVATE_PROMPTPAY',
  bank_code: 'BANK',
  bank_account_number: 'PRIVATE_BANK',
  bank_account_name: 'Private Name',
};
export const studentBody = {
  first_name: 'Student',
  last_name: 'Example',
  current_grade_level: 'M6',
  school_name: 'School',
  location: { longitude: 100.51, latitude: 13.76 },
};
export const jobBody = {
  subject_id: subjectId,
  target_grade_level: 'M6',
  target_topics: ['calculus'],
  learning_goal: 'Prepare for exam',
  budget_min: 200,
  budget_max: 800,
  location_type: 'ONLINE',
  frequency_per_week: 2,
  preferred_days: [1, 3],
};

export interface Person {
  userId: string;
  sessionId: string;
  token: string;
  tutorId?: string;
  studentId?: string;
}

export async function reset() {
  const url = new URL(config.DATABASE_URL);
  if (!url.pathname.endsWith('_test') || config.NODE_ENV !== 'test')
    throw new Error('Tests require a dedicated *_test database');
  // Fixed table list, dedicated test DB only; the owner can clear fixtures while the runtime role cannot.
  await db.$executeRawUnsafe(`TRUNCATE TABLE users, user_auth_providers, user_sessions, tutor_profiles, student_profiles,
    subjects, tutor_subjects, tutor_education, tutor_availability, profile_change_requests, storage_files,
    student_jobs, job_applications, bookings, class_sessions, invoices, conversations, messages, reviews,
    notifications, user_activity_logs, entity_audit_logs, student_questions, question_answers CASCADE`);
  await db.subjects.create({
    data: { id: subjectId, name_th: 'คณิตศาสตร์', name_en: 'Mathematics', category: 'Academic' },
  });
}

export async function person(
  app: Express,
  type: 'student' | 'tutor' | 'both' | 'none' = 'none',
): Promise<Person> {
  const userId = newId('usr');
  const sessionId = newId('uss');
  await db.users.create({ data: { id: userId, email: `${userId}@example.test` } });
  await db.user_sessions.create({
    data: {
      id: sessionId,
      user_id: userId,
      refresh_token_hash: newId('hash'),
      expires_at: new Date(Date.now() + 86400000),
      last_active_at: new Date(),
    },
  });
  const token = jwt.sign({ sid: sessionId }, config.JWT_SECRET, {
    subject: userId,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    algorithm: 'HS256',
    expiresIn: '15m',
  });
  const result: Person = { userId, sessionId, token };
  if (type === 'student' || type === 'both') {
    const response = await request(app)
      .post('/api/v1/profiles/student')
      .auth(token, { type: 'bearer' })
      .send(studentBody)
      .expect(201);
    result.studentId = response.body.data.id;
  }
  if (type === 'tutor' || type === 'both') {
    const response = await request(app)
      .post('/api/v1/profiles/tutor')
      .auth(token, { type: 'bearer' })
      .send(tutorBody)
      .expect(201);
    result.tutorId = response.body.data.id;
    await request(app)
      .put('/api/v1/tutors/me/subjects')
      .auth(token, { type: 'bearer' })
      .send({
        subjects: [
          {
            subject_id: subjectId,
            grade_levels: ['M6'],
            specialized_topics: ['calculus'],
            custom_rate: 450,
          },
        ],
      })
      .expect(200);
  }
  return result;
}

export async function createJob(app: Express, student: Person, overrides = {}) {
  const response = await request(app)
    .post('/api/v1/jobs')
    .auth(student.token, { type: 'bearer' })
    .send({ ...jobBody, ...overrides })
    .expect(201);
  return response.body.data.id as string;
}

export async function apply(app: Express, tutor: Person, jobId: string, rate = 375) {
  const response = await request(app)
    .post(`/api/v1/jobs/${jobId}/apply`)
    .auth(tutor.token, { type: 'bearer' })
    .send({ proposed_rate: rate, cover_message: 'I can teach this lesson' })
    .expect(201);
  return response.body.data.id as string;
}
