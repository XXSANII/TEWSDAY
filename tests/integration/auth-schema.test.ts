import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { db } from '../../src/db';
import { config } from '../../src/config';
import { newId } from '../../src/common/ids';
import schemaColumns from '../../docs/reference/v2-columns.json';
import { reset, person, subjectId } from './helpers';

const app = createApp();
beforeEach(reset);
afterAll(() => db.$disconnect());
const credentials = { email: 'student@example.test', password: 'secure-test-password-123' };

test('LOCAL register/login never exposes hashes, rotation rejects replay and logout revokes access immediately', async () => {
  const agent = request.agent(app);
  const registered = await agent.post('/api/v1/auth/register').send(credentials).expect(201);
  expect(registered.body.data.access_token).toBeTruthy();
  expect(registered.body.data.refreshToken).toBeUndefined();
  const firstCookie = String(registered.headers['set-cookie']?.[0] ?? '');
  expect(firstCookie).toContain('HttpOnly');
  expect(firstCookie).toContain('SameSite=Strict');
  expect(firstCookie).toContain('Path=/api/v1/auth');
  const originalSession = (await db.user_sessions.findMany())[0]!;
  expect(originalSession.refresh_token_hash).toMatch(/^[a-f0-9]{64}$/);
  const rotated = await agent.post('/api/v1/auth/refresh').send({}).expect(200);
  expect(
    (await db.user_sessions.findUnique({ where: { id: originalSession.id } }))!.refresh_token_hash,
  ).not.toBe(originalSession.refresh_token_hash);
  await request(app)
    .post('/api/v1/auth/refresh-token')
    .set('Cookie', firstCookie.split(';')[0]!)
    .send({})
    .expect(401);
  await agent
    .post('/api/v1/auth/logout')
    .auth(rotated.body.data.access_token, { type: 'bearer' })
    .send({})
    .expect(204);
  await request(app)
    .get('/api/v1/users/me')
    .auth(registered.body.data.access_token, { type: 'bearer' })
    .expect(401);
  const loggedIn = await request(app).post('/api/v1/auth/login').send(credentials).expect(200);
  await request(app)
    .get('/api/v1/users/me')
    .auth(loggedIn.body.data.access_token, { type: 'bearer' })
    .expect(200);
  await request(app)
    .post('/api/v1/auth/login')
    .send({ ...credentials, password: 'wrong-password' })
    .expect(401);
  await request(app)
    .post('/api/v1/auth/login')
    .send({ ...credentials, email: 'missing@example.test' })
    .expect(401);
  await request(app).post('/api/v1/auth/refresh').send({}).expect(401);
  const audit = await db.entity_audit_logs.findMany({
    where: { table_name: { in: ['user_sessions', 'user_auth_providers'] } },
  });
  expect(JSON.stringify(audit)).not.toContain('password_hash');
  expect(JSON.stringify(audit)).not.toContain('refresh_token_hash');
  const activity = await db.user_activity_logs.findMany();
  expect(activity.some((row) => row.event_name === 'POST /api/v1/auth/register')).toBe(true);
  expect(activity.some((row) => row.event_name === 'POST /api/v1/auth/logout')).toBe(true);
  expect(JSON.stringify(activity)).not.toContain(credentials.password);
});

test('concurrent registration reserves email with an application guard and does not grant ADMIN', async () => {
  const responses = await Promise.all(
    [1, 2].map(() => request(app).post('/api/v1/auth/register').send(credentials)),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  await request(app)
    .post('/api/v1/auth/register')
    .send({ ...credentials, email: 'admin@example.test', roles: ['ADMIN'] })
    .expect(400);
  expect((await db.users.findMany())[0]!.roles).toEqual(['STUDENT']);
});

test('refresh rotation is serialized, expiry/revocation/deactivation are durable DB decisions', async () => {
  const registered = await request(app).post('/api/v1/auth/register').send(credentials).expect(201);
  const cookie = String(registered.headers['set-cookie']?.[0] ?? '').split(';')[0]!;
  const responses = await Promise.all(
    [1, 2].map(() => request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({})),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([200, 401]);
  const nextCookie = String(
    responses.find((r) => r.status === 200)!.headers['set-cookie']?.[0] ?? '',
  ).split(';')[0]!;
  const session = (await db.user_sessions.findMany())[0]!;
  await db.user_sessions.update({
    where: { id: session.id },
    data: { expires_at: new Date(Date.now() - 1000) },
  });
  await request(app).post('/api/v1/auth/refresh').set('Cookie', nextCookie).send({}).expect(401);
  await db.user_sessions.update({
    where: { id: session.id },
    data: { expires_at: new Date(Date.now() + 100000) },
  });
  await db.users.update({ where: { id: session.user_id }, data: { is_active: false } });
  await request(app).post('/api/v1/auth/refresh').set('Cookie', nextCookie).send({}).expect(401);
});

test('JWT claims, signatures, expiry and role checks deny unauthorized access', async () => {
  const user = await person(app, 'student');
  await request(app).get('/api/v1/tutors/me').auth(user.token, { type: 'bearer' }).expect(403);
  await request(app).get('/api/v1/students/me').expect(401);
  await request(app).get('/api/v1/students/me').auth('malformed', { type: 'bearer' }).expect(401);
  const badClaim = jwt.sign({ sub: user.userId }, config.JWT_SECRET, {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  });
  await request(app).get('/api/v1/students/me').auth(badClaim, { type: 'bearer' }).expect(401);
  const expired = jwt.sign({ sub: user.userId, sid: user.sessionId }, config.JWT_SECRET, {
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    expiresIn: -1,
  });
  await request(app).get('/api/v1/students/me').auth(expired, { type: 'bearer' }).expect(401);
  await db.user_sessions.update({ where: { id: user.sessionId }, data: { is_revoked: true } });
  await request(app).get('/api/v1/students/me').auth(user.token, { type: 'bearer' }).expect(401);
});

test('database has exactly the 24 core V2 models and exact supplied columns; no AI tables in public', async () => {
  expect(Object.keys(schemaColumns)).toHaveLength(24);
  const actual = await db.$queryRaw<
    { table_name: string; column_name: string }[]
  >`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
  for (const [table, columns] of Object.entries(schemaColumns)) {
    const names = actual
      .filter((r) => r.table_name === table)
      .map((r) => r.column_name)
      .sort();
    expect(names).toEqual(columns.map((c) => c.name).sort());
  }
  expect(
    actual.some((r) =>
      /embeddings|invoice_items|session_enrollments|tutor_bids/.test(r.table_name),
    ),
  ).toBe(false);
  const geometry = await db.$queryRaw<
    { f_table_name: string; srid: number; type: string }[]
  >`SELECT f_table_name,srid,type FROM geometry_columns WHERE f_table_schema = 'public'`;
  expect(geometry).toHaveLength(3);
  geometry.forEach((g) => expect([g.srid, g.type]).toEqual([4326, 'POINT']));
});

test('audit and activity records remain immutable even under owner DB credentials', async () => {
  const tutor = await person(app, 'tutor');
  const audit = (
    await db.entity_audit_logs.findMany({
      where: { table_name: 'tutor_profiles', record_id: tutor.tutorId },
    })
  )[0]!;
  expect(audit.changed_by).toBe(tutor.userId);
  await expect(
    db.entity_audit_logs.update({ where: { id: audit.id }, data: { is_active: false } }),
  ).rejects.toThrow();
  const log = await db.user_activity_logs.create({
    data: {
      id: newId('ual'),
      user_id: tutor.userId,
      browser_session_id: tutor.sessionId,
      event_name: 'TEST_ACTIVITY',
      page_path: '/test',
    },
  });
  await expect(db.user_activity_logs.delete({ where: { id: log.id } })).rejects.toThrow();
  expect(await db.subjects.findUnique({ where: { id: subjectId } })).toBeTruthy();
});

test('health, API documentation, subjects, CORS and standardized errors are usable', async () => {
  await request(app).get('/health').expect(200);
  const doc = await request(app).get('/openapi.json').expect(200);
  expect(Object.keys(doc.body.paths).length).toBeGreaterThan(25);
  await request(app).get('/docs/').expect(200);
  expect((await request(app).get('/api/v1/subjects').expect(200)).body.data[0].id).toBe(subjectId);
  await request(app).get(`/api/v1/subjects/${subjectId}`).expect(200);
  await request(app).get('/api/v1/subjects/sbj_missing').expect(404);
  await request(app)
    .get('/api/v1/subjects')
    .set('Origin', 'https://untrusted.example.test')
    .expect(403);
  const valid = await request(app)
    .get('/api/v1/subjects')
    .set('Origin', 'http://localhost:5173')
    .expect(200);
  expect(valid.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  await request(app)
    .post('/api/v1/auth/login')
    .set('Content-Type', 'application/json')
    .send('{broken')
    .expect(400);
  await request(app)
    .post('/api/v1/auth/login')
    .send({ padding: 'a'.repeat(150000) })
    .expect(413);
  const error = await request(app).get('/api/v1/missing').expect(404);
  expect(error.body.error.requestId).toBe(error.headers['x-request-id']);
  expect(error.body.error.timestamp).toBeTruthy();
});
