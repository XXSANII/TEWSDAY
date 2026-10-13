// Tests must never pick up the dev .env (it points REDIS_URL at a Redis that is not running in CI/test).
// dotenv/config honours DOTENV_CONFIG_PATH, so point it at a file that does not exist.
process.env.DOTENV_CONFIG_PATH = '/nonexistent/.env.test-disabled';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://tewsday_owner:local_owner_only@localhost:55433/tewsday_test?schema=public';
process.env.JWT_SECRET ??= 'integration-test-secret-only-at-least-32-characters';
process.env.JWT_ISSUER = 'tewsday-api';
process.env.JWT_AUDIENCE = 'tewsday-web';
process.env.LOG_LEVEL = 'silent';
process.env.CORS_ORIGINS = 'http://localhost:5173';
// Leave REDIS_URL unset so no Redis connection is attempted (rate limiting is skipped in test anyway).
delete process.env.REDIS_URL;
// Storage tests mock the AWS SDK, but the router still needs a bucket name to be configured.
process.env.S3_BUCKET ??= 'tewsday-test-bucket';
delete process.env.S3_ENDPOINT;
