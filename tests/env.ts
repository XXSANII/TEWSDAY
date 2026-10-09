process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://tewsday_owner:local_owner_only@localhost:55433/tewsday_test?schema=public';
process.env.JWT_SECRET ??= 'integration-test-secret-only-at-least-32-characters';
process.env.JWT_ISSUER = 'tewsday-api';
process.env.JWT_AUDIENCE = 'tewsday-web';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:5173';
