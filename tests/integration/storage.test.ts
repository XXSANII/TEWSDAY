import request from 'supertest';
import { createApp } from '../../src/app';
import { db } from '../../src/db';
import { config } from '../../src/config';
import { reset, person, Person } from './helpers';

// S3 is mocked: no network or bucket is needed. `send` is dereferenced lazily so the
// router can construct its client while this module is still being imported.
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: (...args: unknown[]) => mockSend(...args) })),
  PutObjectCommand: jest.fn((input: unknown) => ({ input })),
  HeadObjectCommand: jest.fn((input: unknown) => ({ input })),
  GetObjectCommand: jest.fn((input: unknown) => ({ input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://s3.example.test/signed-url'),
}));

const app = createApp();
beforeEach(async () => {
  await reset();
  mockSend.mockReset();
});
afterAll(() => db.$disconnect());

const upload = {
  file_name: 'degree.pdf',
  mime_type: 'application/pdf',
  file_size_bytes: 1000,
  file_category: 'VERIFICATION_DOC',
};

function headFor(user: Person, overrides: Record<string, unknown> = {}) {
  mockSend.mockResolvedValue({
    ContentLength: 1000,
    ContentType: 'application/pdf',
    Metadata: { owner: user.userId, category: 'VERIFICATION_DOC' },
    ...overrides,
  });
}

function confirmBody(user: Person, overrides: Record<string, unknown> = {}) {
  return {
    file_key: `users/${user.userId}/some-object`,
    file_name: 'degree.pdf',
    mime_type: 'application/pdf',
    file_category: 'VERIFICATION_DOC',
    ...overrides,
  };
}

async function confirmed(user: Person): Promise<string> {
  headFor(user);
  const res = await request(app)
    .post('/api/v1/storage/confirm-upload')
    .auth(user.token, { type: 'bearer' })
    .send(confirmBody(user))
    .expect(201);
  return res.body.data.id as string;
}

test('all storage endpoints require authentication', async () => {
  await request(app).post('/api/v1/storage/presigned-upload').send(upload).expect(401);
  await request(app).post('/api/v1/storage/confirm-upload').send({}).expect(401);
  await request(app).get('/api/v1/storage/files/fil_x/view-url').expect(401);
});

test('presigned-upload returns a user-scoped key and validates type, category and size', async () => {
  const user = await person(app, 'none');
  const ok = await request(app)
    .post('/api/v1/storage/presigned-upload')
    .auth(user.token, { type: 'bearer' })
    .send(upload)
    .expect(201);
  expect(ok.body.data.method).toBe('PUT');
  expect(ok.body.data.upload_url).toBe('https://s3.example.test/signed-url');
  expect(ok.body.data.file_key).toMatch(new RegExp(`^users/${user.userId}/`));

  const post = (body: object) =>
    request(app)
      .post('/api/v1/storage/presigned-upload')
      .auth(user.token, { type: 'bearer' })
      .send(body);
  await post({ ...upload, mime_type: 'text/html' }).expect(422);
  await post({ ...upload, file_category: 'AVATAR' }).expect(422); // AVATAR must be an image
  await post({ ...upload, file_size_bytes: 15 * 1024 * 1024 + 1 }).expect(400);
  await post({ ...upload, file_category: 'NOT_A_CATEGORY' }).expect(400);
  await post({ ...upload, owner: 'someone-else' }).expect(400); // strict schema
});

test('returns 503 when S3_BUCKET is not configured instead of crashing the API', async () => {
  const user = await person(app, 'none');
  const mutable = config as { S3_BUCKET?: string };
  const original = mutable.S3_BUCKET;
  mutable.S3_BUCKET = undefined;
  try {
    const res = await request(app)
      .post('/api/v1/storage/presigned-upload')
      .auth(user.token, { type: 'bearer' })
      .send(upload)
      .expect(503);
    expect(res.body.error.code).toBe('STORAGE_NOT_CONFIGURED');
  } finally {
    mutable.S3_BUCKET = original;
  }
});

test('confirm-upload records the file once and is idempotent for the owner', async () => {
  const user = await person(app, 'none');
  const first = await confirmed(user);
  const second = await confirmed(user);
  expect(second).toBe(first);
  expect(await db.storage_files.count({ where: { created_by: user.userId } })).toBe(1);
  const row = (await db.storage_files.findUnique({ where: { id: first } }))!;
  expect(row.file_category).toBe('VERIFICATION_DOC');
  expect(Number(row.file_size_bytes)).toBe(1000);
});

test('confirm-upload rejects foreign keys, bad metadata, wrong type and invalid size', async () => {
  const user = await person(app, 'none');
  const other = await person(app, 'none');
  const post = (body: object) =>
    request(app)
      .post('/api/v1/storage/confirm-upload')
      .auth(user.token, { type: 'bearer' })
      .send(body);

  await post(confirmBody(other)).expect(403);
  expect(mockSend).not.toHaveBeenCalled(); // rejected before touching S3

  headFor(user, { Metadata: { owner: other.userId, category: 'VERIFICATION_DOC' } });
  await post(confirmBody(user)).expect(403);

  headFor(user, { ContentType: 'image/png' });
  await post(confirmBody(user)).expect(422);

  headFor(user, { ContentLength: 0 });
  await post(confirmBody(user)).expect(422);

  headFor(user, { ContentLength: 15 * 1024 * 1024 + 1 });
  await post(confirmBody(user)).expect(422);

  await post(confirmBody(user, { mime_type: 'text/html' })).expect(422);
  expect(await db.storage_files.count()).toBe(0);
});

test('view-url is limited to the owner and admins and ignores inactive files', async () => {
  const owner = await person(app, 'none');
  const other = await person(app, 'none');
  const admin = await person(app, 'none');
  await db.users.update({ where: { id: admin.userId }, data: { roles: ['ADMIN'] } });
  const fileId = await confirmed(owner);
  const get = (token: string, id = fileId) =>
    request(app).get(`/api/v1/storage/files/${id}/view-url`).auth(token, { type: 'bearer' });

  const own = await get(owner.token).expect(200);
  expect(own.body.data).toEqual({
    view_url: 'https://s3.example.test/signed-url',
    expires_in: 120,
  });
  await get(admin.token).expect(200);
  await get(other.token).expect(403);
  await get(owner.token, 'fil_missing').expect(404);

  await db.storage_files.update({ where: { id: fileId }, data: { is_active: false } });
  await get(owner.token).expect(404);
});
