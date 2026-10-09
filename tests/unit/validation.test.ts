import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { newId, entityId } from '../../src/common/ids';
import { decodeCursor, page } from '../../src/common/pagination';
import { guard, requireFound, ApiError } from '../../src/common/errors';
import { money, locationSchema } from '../../src/common/validation';
import {
  availabilitySchema,
  changeRequestSchema,
  subjectsSchema,
} from '../../src/modules/profiles/schemas';
import { tutorSearchSchema } from '../../src/modules/search/schemas';
import { jobSchema } from '../../src/modules/marketplace/schemas';
import { errorHandler } from '../../src/middleware/errors';

test('prefixed server IDs are unique and exactly VARCHAR(36)', () => {
  const ids = Array.from({ length: 100 }, () => newId('usr'));
  expect(new Set(ids).size).toBe(100);
  ids.forEach((id) => expect(entityId('usr').parse(id).length).toBe(36));
  expect(() => entityId('tut').parse(ids[0])).toThrow();
});
test.each([0, 0.01, 499.99, 99999999.99])('money accepts %s', (value) =>
  expect(money.parse(value)).toBe(value),
);
test.each([-1, 1.001, Infinity, 100000000])('money rejects %s', (value) =>
  expect(() => money.parse(value)).toThrow(),
);
test('geometry validates longitude/latitude bounds', () => {
  expect(locationSchema.parse({ longitude: -180, latitude: 90 })).toBeDefined();
  expect(() => locationSchema.parse({ longitude: 181, latitude: 0 })).toThrow();
});
test('keyset cursor uses timestamp plus ID and rejects malformed input', () => {
  const rows = [
    { id: 'tut_a', created_at: new Date('2026-10-08T00:00:00Z') },
    { id: 'tut_b', created_at: new Date('2026-10-07T00:00:00Z') },
  ];
  const result = page(rows, 1);
  expect(decodeCursor(result.next_cursor!)).toEqual({
    id: 'tut_a',
    created_at: rows[0]!.created_at.toISOString(),
  });
  expect(page(rows, 2).next_cursor).toBeNull();
  expect(page([], 2).items).toEqual([]);
  expect(decodeCursor()).toBeNull();
  expect(() => decodeCursor('invalid')).toThrow(ApiError);
});
test('domain guards and not-found assertions', () => {
  guard(true, 403, 'OK', 'ok');
  expect(requireFound({ id: 1 })).toEqual({ id: 1 });
  expect(() => requireFound(null)).toThrow(ApiError);
  expect(() => guard(false, 409, 'CONFLICT', 'conflict')).toThrow(ApiError);
});
test.each([
  { slots: [{ is_recurring: true, start_time: '09:00', end_time: '10:00' }] },
  { slots: [{ is_recurring: false, day_of_week: 1, start_time: '09:00', end_time: '10:00' }] },
  { slots: [{ is_recurring: true, day_of_week: 1, start_time: '11:00', end_time: '10:00' }] },
  {
    slots: [
      { is_recurring: false, specific_date: '2026-02-30', start_time: '09:00', end_time: '10:00' },
    ],
  },
  {
    slots: [
      { is_recurring: true, day_of_week: 1, start_time: '09:00', end_time: '11:00' },
      { is_recurring: true, day_of_week: 1, start_time: '10:00', end_time: '12:00' },
    ],
  },
])('invalid availability fails validation: %j', (value) =>
  expect(() => availabilitySchema.parse(value)).toThrow(),
);
test.each([
  { radius_km: 10 },
  { min_rate: 500, max_rate: 300 },
  { available_date: '2026-10-09' },
  { available_date: '2026-10-09', start_time: '11:00', end_time: '10:00' },
  { latitude: 13, longitude: 100, radius_km: 10, location_type: 'ONLINE' },
])('invalid search fails: %j', (value) => expect(() => tutorSearchSchema.parse(value)).toThrow());
test('change requests and subjects reject unrestricted payloads', () => {
  expect(() =>
    changeRequestSchema.parse({
      request_type: 'IDENTIFICATION',
      requested_changes: { account_status: 'ACTIVE' },
    }),
  ).toThrow();
  expect(() =>
    changeRequestSchema.parse({
      request_type: 'LEGAL_NAME',
      requested_changes: { roles: ['ADMIN'] },
    }),
  ).toThrow();
  expect(() =>
    subjectsSchema.parse({
      subjects: [
        { subject_id: 'sbj_a', grade_levels: [], specialized_topics: [] },
        { subject_id: 'sbj_a', grade_levels: [], specialized_topics: [] },
      ],
    }),
  ).toThrow();
});
test('job rejects duplicate preferred days, reversed budget and missing onsite point', () => {
  const body = {
    subject_id: 'sbj_a',
    target_grade_level: 'M6',
    learning_goal: 'Math',
    budget_min: 1,
    budget_max: 2,
    location_type: 'ONSITE',
    frequency_per_week: 1,
    preferred_days: [1, 1],
  };
  expect(() => jobSchema.parse(body)).toThrow();
  expect(() =>
    jobSchema.parse({ ...body, location_type: 'ONLINE', budget_min: 5, preferred_days: [1] }),
  ).toThrow();
});
test('error responses hide internal details and handle known input/conflict errors', () => {
  const cases: [unknown, number, string][] = [
    [new Error('SECRET_DATABASE_PASSWORD'), 500, 'INTERNAL_ERROR'],
    [new ApiError(403, 'FORBIDDEN', 'Forbidden'), 403, 'FORBIDDEN'],
    [
      new Prisma.PrismaClientKnownRequestError('timeout', { code: 'P2028', clientVersion: '6' }),
      503,
      'DATABASE_BUSY',
    ],
    [
      new z.ZodError([{ code: 'custom', path: ['field'], message: 'Invalid field' }]),
      400,
      'VALIDATION_ERROR',
    ],
    [
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: '6' }),
      409,
      'DATA_CONFLICT',
    ],
    [Object.assign(new SyntaxError('json'), { body: '{' }), 400, 'INVALID_JSON'],
    [{ type: 'entity.too.large' }, 413, 'BODY_TOO_LARGE'],
  ];
  for (const [error, status, code] of cases) {
    const json = jest.fn();
    const statusFn = jest.fn(() => ({ json }));
    errorHandler(
      error,
      { requestId: 'req_test', log: { error: jest.fn() } } as never,
      { status: statusFn } as never,
      jest.fn(),
    );
    expect(statusFn).toHaveBeenCalledWith(status);
    expect(json.mock.calls[0]![0].error.code).toBe(code);
    expect(JSON.stringify(json.mock.calls)).not.toContain('SECRET_DATABASE_PASSWORD');
  }
});
