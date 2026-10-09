import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/db';
import { reset, person, createJob, apply, jobBody, Person } from './helpers';

const app = createApp();
let student: Person;
let tutor: Person;
let other: Person;
beforeEach(async () => {
  await reset();
  student = await person(app, 'student');
  tutor = await person(app, 'tutor');
  other = await person(app, 'tutor');
});
afterAll(() => db.$disconnect());

test('job feed, detail, budget and cursor are consistent and exclude exact coordinates', async () => {
  const id = await createJob(app, student, {
    location_type: 'BOTH',
    location: { longitude: 100.5, latitude: 13.75 },
  });
  await createJob(app, student, { budget_min: 900, budget_max: 1000 });
  const feed = await request(app)
    .get('/api/v1/jobs')
    .query({ budget_min: 300, budget_max: 500, location_type: 'ONSITE' })
    .expect(200);
  expect(feed.body.data.items.map((j: { id: string }) => j.id)).toEqual([id]);
  const detail = await request(app).get(`/api/v1/jobs/${id}`).expect(200);
  expect(detail.body.data.location).toBeUndefined();
  expect(detail.body.data.learning_goal).toBe(jobBody.learning_goal);
  const page1 = await request(app).get('/api/v1/jobs').query({ limit: 1 }).expect(200);
  const page2 = await request(app)
    .get('/api/v1/jobs')
    .query({ limit: 1, cursor: page1.body.data.next_cursor })
    .expect(200);
  expect(page2.body.data.items[0].id).not.toBe(page1.body.data.items[0].id);
  await request(app).get('/api/v1/jobs').query({ cursor: 'invalid' }).expect(400);
});

test('job creation validates roles, subject, actor and onsite point', async () => {
  await request(app).post('/api/v1/jobs').send(jobBody).expect(401);
  await db.users.update({ where: { id: tutor.userId }, data: { roles: ['TUTOR'] } });
  await request(app)
    .post('/api/v1/jobs')
    .auth(tutor.token, { type: 'bearer' })
    .send(jobBody)
    .expect(403);
  await request(app)
    .post('/api/v1/jobs')
    .auth(student.token, { type: 'bearer' })
    .send({ ...jobBody, student_id: 'std_other' })
    .expect(400);
  await request(app)
    .post('/api/v1/jobs')
    .auth(student.token, { type: 'bearer' })
    .send({ ...jobBody, subject_id: 'sbj_missing' })
    .expect(422);
  await request(app)
    .post('/api/v1/jobs')
    .auth(student.token, { type: 'bearer' })
    .send({ ...jobBody, location_type: 'ONSITE' })
    .expect(400);
});

test('application eligibility, private application visibility and duplicate submissions', async () => {
  const id = await createJob(app, student);
  const appId = await apply(app, tutor, id);
  const owner = await request(app)
    .get(`/api/v1/jobs/${id}/applications`)
    .auth(student.token, { type: 'bearer' })
    .expect(200);
  expect(owner.body.data[0].id).toBe(appId);
  expect(
    (
      await request(app)
        .get(`/api/v1/jobs/${id}/applications`)
        .auth(tutor.token, { type: 'bearer' })
        .expect(200)
    ).body.data,
  ).toHaveLength(1);
  expect(
    (
      await request(app)
        .get(`/api/v1/jobs/${id}/applications`)
        .auth(other.token, { type: 'bearer' })
        .expect(200)
    ).body.data,
  ).toHaveLength(0);
  const stranger = await person(app, 'none');
  await request(app)
    .get(`/api/v1/jobs/${id}/applications`)
    .auth(stranger.token, { type: 'bearer' })
    .expect(403);
  await request(app)
    .post(`/api/v1/jobs/${id}/apply`)
    .auth(tutor.token, { type: 'bearer' })
    .send({ proposed_rate: 300, cover_message: 'Again' })
    .expect(409);
  await db.tutor_subjects.updateMany({
    where: { tutor_id: other.tutorId },
    data: { is_active: false },
  });
  await request(app)
    .post(`/api/v1/jobs/${id}/apply`)
    .auth(other.token, { type: 'bearer' })
    .send({ proposed_rate: 300, cover_message: 'No subject' })
    .expect(422);
});

test('self-application and restricted/deactivated tutor accounts are blocked', async () => {
  const both = await person(app, 'both');
  const id = await createJob(app, both);
  await request(app)
    .post(`/api/v1/jobs/${id}/apply`)
    .auth(both.token, { type: 'bearer' })
    .send({ proposed_rate: 300, cover_message: 'Self' })
    .expect(422);
  await db.tutor_profiles.update({
    where: { id: tutor.tutorId },
    data: { account_status: 'RESTRICTED' },
  });
  await request(app)
    .post(`/api/v1/jobs/${id}/apply`)
    .auth(tutor.token, { type: 'bearer' })
    .send({ proposed_rate: 300, cover_message: 'Blocked' })
    .expect(403);
  await db.users.update({ where: { id: other.userId }, data: { is_active: false } });
  await request(app)
    .post(`/api/v1/jobs/${id}/apply`)
    .auth(other.token, { type: 'bearer' })
    .send({ proposed_rate: 300, cover_message: 'Inactive' })
    .expect(401);
});

test('concurrent duplicate applications are serialized by the job row lock', async () => {
  const id = await createJob(app, student);
  const responses = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .post(`/api/v1/jobs/${id}/applications`)
        .auth(tutor.token, { type: 'bearer' })
        .send({ proposed_rate: 400, cover_message: 'Concurrent' }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await db.job_applications.count({ where: { job_id: id } })).toBe(1);
});

test('acceptance snapshots the proposed rate, rejects competitors, creates notifications and is replay safe', async () => {
  const id = await createJob(app, student);
  const appId = await apply(app, tutor, id, 375);
  const rejected = await apply(app, other, id, 425);
  const url = `/api/v1/jobs/${id}/applications/${appId}/accept`;
  const responses = await Promise.all(
    [1, 2].map(() => request(app).post(url).auth(student.token, { type: 'bearer' }).send({})),
  );
  const a = responses[0]!;
  const b = responses[1]!;
  expect([a.status, b.status]).toEqual([200, 200]);
  expect(a.body.data.id).toBe(b.body.data.id);
  expect(a.body.data.agreed_hourly_rate).toBe('375');
  expect(a.body.data.status).toBe('PENDING_CONFIRMATION');
  expect(await db.bookings.count({ where: { originating_job_id: id } })).toBe(1);
  expect((await db.student_jobs.findUnique({ where: { id } }))!.status).toBe('MATCHED');
  expect((await db.job_applications.findUnique({ where: { id: rejected } }))!.status).toBe(
    'REJECTED',
  );
  expect(
    await db.notifications.count({
      where: { user_id: tutor.userId, type: 'APPLICATION_ACCEPTED' },
    }),
  ).toBe(1);
  expect(
    await db.notifications.count({
      where: { user_id: other.userId, type: 'APPLICATION_REJECTED' },
    }),
  ).toBe(1);
});

test('concurrent acceptances for different tutors produce only one booking', async () => {
  const id = await createJob(app, student);
  const a = await apply(app, tutor, id);
  const b = await apply(app, other, id);
  const responses = await Promise.all(
    [a, b].map((appId) =>
      request(app)
        .patch(`/api/v1/applications/${appId}/status`)
        .auth(student.token, { type: 'bearer' })
        .send({ status: 'ACCEPTED' }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await db.bookings.count({ where: { originating_job_id: id } })).toBe(1);
  expect(await db.job_applications.count({ where: { job_id: id, status: 'ACCEPTED' } })).toBe(1);
});

test('acceptance rechecks eligibility and failed domain guards roll back all writes', async () => {
  const id = await createJob(app, student, {
    location_type: 'BOTH',
    location: { longitude: 100.5, latitude: 13.75 },
  });
  const appId = await apply(app, tutor, id);
  const url = `/api/v1/applications/${appId}/status`;
  await request(app)
    .patch(url)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'ACCEPTED' })
    .expect(422);
  await request(app)
    .patch(url)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'ACCEPTED', location_type: 'ONSITE' })
    .expect(422);
  await db.tutor_profiles.update({
    where: { id: tutor.tutorId },
    data: { account_status: 'SUSPENDED' },
  });
  await request(app)
    .patch(url)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'ACCEPTED', location_type: 'ONLINE' })
    .expect(403);
  expect((await db.job_applications.findUnique({ where: { id: appId } }))!.status).toBe('PENDING');
  expect((await db.student_jobs.findUnique({ where: { id } }))!.status).toBe('OPEN');
  expect(await db.bookings.count()).toBe(0);
  await db.tutor_profiles.update({
    where: { id: tutor.tutorId },
    data: { account_status: 'ACTIVE' },
  });
  const accepted = await request(app)
    .patch(url)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'ACCEPTED', location_type: 'ONSITE', meeting_location: 'Agreed venue' })
    .expect(200);
  expect(accepted.body.data.location_type).toBe('ONSITE');
});

test('application decisions enforce owner/applicant permissions and immutable terminal states', async () => {
  const id = await createJob(app, student);
  const appId = await apply(app, tutor, id);
  const url = `/api/v1/applications/${appId}/status`;
  await request(app)
    .patch(url)
    .auth(other.token, { type: 'bearer' })
    .send({ status: 'ACCEPTED' })
    .expect(403);
  await request(app)
    .patch(url)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'WITHDRAWN' })
    .expect(403);
  await request(app)
    .patch(url)
    .auth(tutor.token, { type: 'bearer' })
    .send({ status: 'WITHDRAWN' })
    .expect(200);
  await request(app)
    .patch(url)
    .auth(tutor.token, { type: 'bearer' })
    .send({ status: 'WITHDRAWN' })
    .expect(200);
  await request(app)
    .patch(url)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'ACCEPTED' })
    .expect(409);
  const second = await apply(app, other, id);
  await request(app)
    .patch(`/api/v1/applications/${second}/status`)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'REJECTED' })
    .expect(200);
  await request(app)
    .post(`/api/v1/jobs/job_other/applications/${second}/accept`)
    .auth(student.token, { type: 'bearer' })
    .send({})
    .expect(404);
});

test('closing/cancelling a job rejects pending applications and obeys ownership and transitions', async () => {
  const id = await createJob(app, student);
  const appId = await apply(app, tutor, id);
  const stranger = await person(app, 'student');
  await request(app)
    .patch(`/api/v1/jobs/${id}/status`)
    .auth(stranger.token, { type: 'bearer' })
    .send({ status: 'CLOSED' })
    .expect(403);
  await request(app)
    .patch(`/api/v1/jobs/${id}/status`)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'CLOSED' })
    .expect(200);
  await request(app)
    .patch(`/api/v1/jobs/${id}/status`)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'CLOSED' })
    .expect(200);
  await request(app)
    .patch(`/api/v1/jobs/${id}/status`)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'CANCELLED' })
    .expect(409);
  expect((await db.job_applications.findUnique({ where: { id: appId } }))!.status).toBe('REJECTED');
  await request(app)
    .post(`/api/v1/jobs/${id}/apply`)
    .auth(other.token, { type: 'bearer' })
    .send({ proposed_rate: 300, cover_message: 'Late' })
    .expect(409);
  const second = await createJob(app, student);
  await request(app)
    .patch(`/api/v1/jobs/${second}/status`)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'CANCELLED' })
    .expect(200);
});

test('atomic share increments survive concurrency and closed jobs reject sharing', async () => {
  const id = await createJob(app, student);
  await Promise.all(
    Array.from({ length: 8 }, () =>
      request(app)
        .post(`/api/v1/jobs/${id}/share`)
        .auth(tutor.token, { type: 'bearer' })
        .expect(200),
    ),
  );
  expect((await db.student_jobs.findUnique({ where: { id } }))!.share_count).toBe(8);
  await request(app)
    .patch(`/api/v1/jobs/${id}/status`)
    .auth(student.token, { type: 'bearer' })
    .send({ status: 'CLOSED' })
    .expect(200);
  await request(app)
    .post(`/api/v1/jobs/${id}/share`)
    .auth(tutor.token, { type: 'bearer' })
    .expect(409);
});
