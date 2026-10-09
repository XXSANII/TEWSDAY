import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/db';
import { newId } from '../../src/common/ids';
import { reset, person, subjectId, tutorBody, studentBody } from './helpers';

const app = createApp();
beforeEach(reset);
afterAll(() => db.$disconnect());

test('onboarding creates one profile per user, grants role and preserves UI-mode authorization boundary', async () => {
  const user = await person(app, 'both');
  const me = await request(app)
    .get('/api/v1/users/me')
    .auth(user.token, { type: 'bearer' })
    .expect(200);
  expect(me.body.data.roles).toEqual(['STUDENT', 'TUTOR']);
  expect(me.body.data.current_mode).toBe('STUDENT');
  await request(app)
    .post('/api/v1/profiles/tutor')
    .auth(user.token, { type: 'bearer' })
    .send(tutorBody)
    .expect(409);
  await request(app)
    .post('/api/v1/profiles/student')
    .auth(user.token, { type: 'bearer' })
    .send(studentBody)
    .expect(409);
  await request(app)
    .patch('/api/v1/users/me/mode')
    .auth(user.token, { type: 'bearer' })
    .send({ current_mode: 'TUTOR' })
    .expect(200);
  await request(app).get('/api/v1/students/me').auth(user.token, { type: 'bearer' }).expect(200);
  await request(app)
    .patch('/api/v1/users/me/mode')
    .auth(user.token, { type: 'bearer' })
    .send({ current_mode: 'ADMIN' })
    .expect(403);
});

test('owner profile updates validate fields, geometry and sensitive-field exclusions', async () => {
  const user = await person(app, 'both');
  await request(app)
    .put('/api/v1/tutors/me')
    .auth(user.token, { type: 'bearer' })
    .send({ first_name: 'Unapproved' })
    .expect(400);
  await request(app)
    .put('/api/v1/tutors/me')
    .auth(user.token, { type: 'bearer' })
    .send({ verification_status: 'VERIFIED' })
    .expect(400);
  await request(app)
    .patch('/api/v1/tutors/me')
    .auth(user.token, { type: 'bearer' })
    .send({
      bio: 'New bio',
      gender: 'OTHER',
      teaching_location_type: 'ONSITE',
      hourly_rate: 650.5,
      promptpay_identifier: null,
      location: { longitude: 101, latitude: 14 },
    })
    .expect(200);
  const own = await request(app)
    .get('/api/v1/tutors/me')
    .auth(user.token, { type: 'bearer' })
    .expect(200);
  expect(own.body.data.bio).toBe('New bio');
  expect(own.body.data.gender).toBe('OTHER');
  expect(own.body.data.teaching_location_type).toBe('ONSITE');
  expect(own.body.data.location.coordinates).toEqual([101, 14]);
  expect(own.body.data.bank_account_number).toBe('PRIVATE_BANK');
  await request(app)
    .put('/api/v1/students/me')
    .auth(user.token, { type: 'bearer' })
    .send({ school_name: 'Updated school', location: { longitude: 100, latitude: 13 } })
    .expect(200);
  await request(app)
    .put('/api/v1/students/me/emergency-contact')
    .auth(user.token, { type: 'bearer' })
    .send({
      parent_name: 'Parent',
      parent_phone_number: 'PRIVATE_PHONE',
      emergency_contact_name: 'Emergency',
      emergency_contact_phone: 'PRIVATE_EMERGENCY',
    })
    .expect(200);
  const student = await request(app)
    .get('/api/v1/students/me')
    .auth(user.token, { type: 'bearer' })
    .expect(200);
  expect(student.body.data.parent_phone_number).toBe('PRIVATE_PHONE');
  await request(app)
    .put('/api/v1/students/me')
    .auth(user.token, { type: 'bearer' })
    .send({ user_id: newId('usr') })
    .expect(400);
  await request(app)
    .put('/api/v1/tutors/me')
    .auth(user.token, { type: 'bearer' })
    .send({})
    .expect(400);
});

test('public tutor projection omits private location, banking, file references and unpublished video', async () => {
  const tutor = await person(app, 'tutor');
  await db.tutor_profiles.update({
    where: { id: tutor.tutorId },
    data: {
      intro_video_hls_url: 'https://private.example.test/raw.m3u8',
      intro_video_status: 'FLAGGED',
    },
  });
  const response = await request(app).get(`/api/v1/tutors/${tutor.tutorId}`).expect(200);
  expect(response.body.data.subjects[0].id).toBe(subjectId);
  expect(response.body.data.intro_video_hls_url).toBeNull();
  const json = JSON.stringify(response.body);
  for (const field of [
    'location"',
    'bank_account',
    'promptpay',
    'verification_document_file',
    'user_id',
    'PRIVATE_',
  ])
    expect(json).not.toContain(field);
});

test('education ownership, soft deletion, verified education guard and file validation', async () => {
  const tutor = await person(app, 'tutor');
  const other = await person(app, 'tutor');
  const body = {
    institution: 'University',
    degree: 'Bachelor',
    major: 'Math',
    graduation_year: 2025,
  };
  const created = await request(app)
    .post('/api/v1/tutors/me/education')
    .auth(tutor.token, { type: 'bearer' })
    .send(body)
    .expect(201);
  const eduId = created.body.data.id;
  expect(created.body.data.is_verified).toBe(false);
  await request(app)
    .delete(`/api/v1/tutors/me/education/${eduId}`)
    .auth(other.token, { type: 'bearer' })
    .expect(404);
  await db.tutor_education.update({ where: { id: eduId }, data: { is_verified: true } });
  await request(app)
    .delete(`/api/v1/tutors/me/education/${eduId}`)
    .auth(tutor.token, { type: 'bearer' })
    .expect(409);
  await db.tutor_education.update({ where: { id: eduId }, data: { is_verified: false } });
  await request(app)
    .delete(`/api/v1/tutors/me/education/${eduId}`)
    .auth(tutor.token, { type: 'bearer' })
    .expect(204);
  expect((await db.tutor_education.findUnique({ where: { id: eduId } }))!.is_active).toBe(false);
  const fileId = newId('fil');
  await db.storage_files.create({
    data: {
      id: fileId,
      bucket_name: 'private',
      file_key: fileId,
      file_name: 'degree.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 100,
      file_category: 'VERIFICATION_DOC',
      created_by: other.userId,
    },
  });
  await request(app)
    .post('/api/v1/tutors/me/education')
    .auth(tutor.token, { type: 'bearer' })
    .send({ ...body, verification_document_file_id: fileId })
    .expect(403);
  await db.storage_files.update({
    where: { id: fileId },
    data: { created_by: tutor.userId, file_category: 'AVATAR' },
  });
  await request(app)
    .post('/api/v1/tutors/me/education')
    .auth(tutor.token, { type: 'bearer' })
    .send({ ...body, verification_document_file_id: fileId })
    .expect(422);
  await db.storage_files.update({
    where: { id: fileId },
    data: { file_category: 'VERIFICATION_DOC' },
  });
  await request(app)
    .post('/api/v1/tutors/me/education')
    .auth(tutor.token, { type: 'bearer' })
    .send({ ...body, verification_document_file_id: fileId })
    .expect(201);
  await request(app)
    .post('/api/v1/tutors/me/education')
    .auth(tutor.token, { type: 'bearer' })
    .send({ ...body, verification_document_file_id: 'fil_missing' })
    .expect(404);
});

test('availability replace is atomic and retains inactive rows, including empty replacement', async () => {
  const tutor = await person(app, 'tutor');
  const slot = { is_recurring: true, day_of_week: 5, start_time: '09:00', end_time: '12:00' };
  await request(app)
    .put('/api/v1/tutors/me/availability')
    .auth(tutor.token, { type: 'bearer' })
    .send({
      slots: [
        slot,
        {
          is_recurring: false,
          specific_date: '2026-10-09',
          start_time: '13:00',
          end_time: '15:00',
        },
      ],
    })
    .expect(200);
  const own = await request(app)
    .get('/api/v1/tutors/me/availability')
    .auth(tutor.token, { type: 'bearer' })
    .expect(200);
  expect(own.body.data).toHaveLength(2);
  const publicResult = await request(app)
    .get(`/api/v1/tutors/${tutor.tutorId}/availability`)
    .expect(200);
  expect(publicResult.body.data).toHaveLength(2);
  await request(app)
    .put('/api/v1/tutors/me/availability')
    .auth(tutor.token, { type: 'bearer' })
    .send({ slots: [{ ...slot, end_time: '08:00' }] })
    .expect(400);
  expect(await db.tutor_availability.count({ where: { is_active: true } })).toBe(2);
  await request(app)
    .put('/api/v1/tutors/me/availability')
    .auth(tutor.token, { type: 'bearer' })
    .send({ slots: [] })
    .expect(200);
  expect(await db.tutor_availability.count()).toBe(2);
  expect(await db.tutor_availability.count({ where: { is_active: true } })).toBe(0);
});

test('subject replacement preserves composite PK history and refuses inactive subjects', async () => {
  const tutor = await person(app, 'tutor');
  await request(app)
    .put('/api/v1/tutors/me/subjects')
    .auth(tutor.token, { type: 'bearer' })
    .send({ subjects: [] })
    .expect(200);
  expect(await db.tutor_subjects.count({ where: { tutor_id: tutor.tutorId } })).toBe(1);
  const body = {
    subjects: [{ subject_id: subjectId, grade_levels: ['M6'], specialized_topics: [] }],
  };
  await request(app)
    .put('/api/v1/tutors/me/subjects')
    .auth(tutor.token, { type: 'bearer' })
    .send(body)
    .expect(200);
  expect(await db.tutor_subjects.count({ where: { tutor_id: tutor.tutorId } })).toBe(1);
  await db.subjects.update({ where: { id: subjectId }, data: { is_active: false } });
  await request(app)
    .put('/api/v1/tutors/me/subjects')
    .auth(tutor.token, { type: 'bearer' })
    .send(body)
    .expect(422);
});

test('legal-name requests snapshot the old data and concurrency prevents duplicate pending requests', async () => {
  const tutor = await person(app, 'tutor');
  const body = { request_type: 'LEGAL_NAME', requested_changes: { first_name: 'Reviewed name' } };
  const responses = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post('/api/v1/tutors/me/change-requests')
        .auth(tutor.token, { type: 'bearer' })
        .send(body),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  const record = (await db.profile_change_requests.findMany())[0]!;
  expect(record.current_data).toEqual({ first_name: 'Tutor', last_name: 'Example' });
  expect(record.status).toBe('PENDING');
  expect((await db.tutor_profiles.findUnique({ where: { id: tutor.tutorId } }))!.first_name).toBe(
    'Tutor',
  );
});

test('education requests snapshot only owned education and allow new education proposals', async () => {
  const tutor = await person(app, 'tutor');
  const edu = await db.tutor_education.create({
    data: {
      id: newId('edu'),
      tutor_id: tutor.tutorId!,
      institution: 'Old University',
      degree: 'BSc',
      major: 'Math',
      graduation_year: 2020,
      is_verified: true,
    },
  });
  const body = {
    request_type: 'EDUCATION',
    requested_changes: {
      education_id: edu.id,
      institution: 'New University',
      degree: 'BSc',
      major: 'Math',
      graduation_year: 2021,
    },
  };
  const response = await request(app)
    .post('/api/v1/tutors/me/change-requests')
    .auth(tutor.token, { type: 'bearer' })
    .send(body)
    .expect(201);
  expect(response.body.data.current_data.institution).toBe('Old University');
  await db.profile_change_requests.update({
    where: { id: response.body.data.id },
    data: { status: 'REJECTED' },
  });
  await request(app)
    .post('/api/v1/tutors/me/change-requests')
    .auth(tutor.token, { type: 'bearer' })
    .send({ ...body, requested_changes: { ...body.requested_changes, education_id: 'edu_other' } })
    .expect(404);
  const changes = {
    institution: 'New University',
    degree: 'BSc',
    major: 'Math',
    graduation_year: 2021,
  };
  await request(app)
    .post('/api/v1/tutors/me/change-requests')
    .auth(tutor.token, { type: 'bearer' })
    .send({ request_type: 'EDUCATION', requested_changes: changes })
    .expect(201);
});

test('search hard filters use subject-specific rates, grade, mode, keyset and active accounts', async () => {
  const a = await person(app, 'tutor');
  const b = await person(app, 'tutor');
  await db.tutor_profiles.update({
    where: { id: a.tutorId },
    data: { verification_status: 'VERIFIED' },
  });
  const first = await request(app)
    .get('/api/v1/tutors')
    .query({
      subject_id: subjectId,
      grade_level: 'M6',
      min_rate: 400,
      max_rate: 460,
      location_type: 'ONLINE',
      limit: 1,
    })
    .expect(200);
  expect(first.body.data.items).toHaveLength(1);
  expect(first.body.data.next_cursor).toBeTruthy();
  const second = await request(app)
    .get('/api/v1/tutors')
    .query({
      subject_id: subjectId,
      grade_level: 'M6',
      limit: 1,
      cursor: first.body.data.next_cursor,
    })
    .expect(200);
  expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
  const verified = await request(app)
    .get('/api/v1/tutors')
    .query({ verification_status: 'VERIFIED', location_type: 'BOTH' })
    .expect(200);
  expect(verified.body.data.items.map((t: { id: string }) => t.id)).toEqual([a.tutorId]);
  expect(
    (await request(app).get('/api/v1/tutors').query({ grade_level: 'Other' }).expect(200)).body.data
      .items,
  ).toHaveLength(0);
  await db.tutor_profiles.update({
    where: { id: a.tutorId },
    data: { account_status: 'RESTRICTED' },
  });
  await db.users.update({ where: { id: b.userId }, data: { is_active: false } });
  expect((await request(app).get('/api/v1/tutors').expect(200)).body.data.items).toHaveLength(0);
  await request(app).get(`/api/v1/tutors/${a.tutorId}`).expect(404);
  await request(app).get(`/api/v1/tutors/${b.tutorId}/availability`).expect(404);
  await request(app).get('/api/v1/tutors').query({ cursor: 'invalid' }).expect(400);
  await request(app).get('/api/v1/tutors').query({ max_rate: 100, min_rate: 101 }).expect(400);
});

test('PostGIS radius is measured in meters and recurring/date availability filters operate in local wall time', async () => {
  const tutor = await person(app, 'tutor');
  await request(app)
    .put('/api/v1/tutors/me/availability')
    .auth(tutor.token, { type: 'bearer' })
    .send({
      slots: [
        { is_recurring: true, day_of_week: 5, start_time: '09:00', end_time: '12:00' },
        {
          is_recurring: false,
          specific_date: '2026-10-10',
          start_time: '13:00',
          end_time: '15:00',
        },
      ],
    })
    .expect(200);
  const near = await request(app)
    .get('/api/v1/tutors')
    .query({
      longitude: 100.51,
      latitude: 13.76,
      radius_km: 5,
      available_date: '2026-10-09',
      start_time: '10:00',
      end_time: '11:00',
      location_type: 'ONSITE',
    })
    .expect(200);
  expect(near.body.data.items).toHaveLength(1);
  expect(near.body.data.items[0].distance_km).toBeGreaterThan(1);
  expect(near.body.data.items[0].distance_km).toBeLessThan(2);
  expect(
    (
      await request(app)
        .get('/api/v1/tutors')
        .query({ longitude: 101.5, latitude: 14.75, radius_km: 5 })
        .expect(200)
    ).body.data.items,
  ).toHaveLength(0);
  expect(
    (
      await request(app)
        .get('/api/v1/tutors')
        .query({ available_date: '2026-10-10', start_time: '13:00', end_time: '14:00' })
        .expect(200)
    ).body.data.items,
  ).toHaveLength(1);
  expect(
    (
      await request(app)
        .get('/api/v1/tutors')
        .query({ available_date: '2026-10-10', start_time: '12:00', end_time: '14:00' })
        .expect(200)
    ).body.data.items,
  ).toHaveLength(0);
});

test('suspended tutors cannot edit or add profile content', async () => {
  const tutor = await person(app, 'tutor');
  await db.tutor_profiles.update({
    where: { id: tutor.tutorId },
    data: { account_status: 'SUSPENDED' },
  });
  await request(app)
    .put('/api/v1/tutors/me')
    .auth(tutor.token, { type: 'bearer' })
    .send({ bio: 'Change' })
    .expect(403);
  await request(app)
    .put('/api/v1/tutors/me/availability')
    .auth(tutor.token, { type: 'bearer' })
    .send({ slots: [] })
    .expect(403);
  await request(app)
    .put('/api/v1/tutors/me/subjects')
    .auth(tutor.token, { type: 'bearer' })
    .send({ subjects: [] })
    .expect(403);
});
