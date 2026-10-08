# TewsDay API

Node.js + Express + TypeScript + Prisma modular monolith, backed by PostgreSQL 16 / PostGIS and Redis 7.

This implementation covers the four **Kong-owned Notion tasks**: Tutor Profile, Student Profile,
Tutor Search and Marketplace. It includes LOCAL authentication, profile onboarding, subject reads
and mode switching so those APIs can run and be tested. The other team-owned modules are not
claimed complete.

## Run locally

Use Node **20.19+** (20.x) or **22.13+**, npm and Docker. PowerShell example:

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d db redis --wait
$env:DATABASE_URL='postgresql://tewsday_owner:local_owner_only@localhost:55432/tewsday?schema=public'
npm run db:migrate
npm run db:seed
Get-Content scripts/local-runtime-role.sql -Raw | docker compose exec -T db psql -U tewsday_owner -d tewsday -v ON_ERROR_STOP=1
Remove-Item Env:DATABASE_URL
npm run dev
```

Replace the sample JWT secret in `.env` with a random secret before deployment. The sample database
passwords are for local development only. Migrations and seed use the schema-owner connection;
the application uses the restricted `tewsday_app` connection from `.env`. Production must provision
equivalent grants and unique credentials. Runtime has no DELETE/TRUNCATE/DDL or audit-write grants.

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs/`
- OpenAPI: `http://localhost:3000/openapi.json`
- Health: `http://localhost:3000/health`

On Linux/macOS, use `cp .env.example .env`, `export DATABASE_URL=...`, `cat scripts/local-runtime-role.sql | docker compose exec -T db psql -U tewsday_owner -d tewsday -v ON_ERROR_STOP=1`, then `unset DATABASE_URL`.

## Verify

The integration suite requires a **dedicated database ending in `_test`**. It clears only fixtures
in that database and fails before clearing a database with any other name.

```powershell
docker compose --profile test up -d test-db --wait
$env:DATABASE_URL='postgresql://tewsday_owner:local_owner_only@localhost:55433/tewsday_test?schema=public'
$env:NODE_ENV='test'
npm run db:migrate
npm run check
npm audit --omit=dev
Remove-Item Env:DATABASE_URL
Remove-Item Env:NODE_ENV
```

`check` generates Prisma Client, checks types, lint and formatting, runs Jest/Supertest with
at least 80% statements/lines/functions coverage, then builds TypeScript. CI repeats this against
real PostGIS and builds the Docker image. Database integration tests cover concurrency, rollback,
private projections, geometry distances, refresh rotation/revocation and immutable audit history.

## API modules

| Module          | Routes                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutor Profile   | GET/PUT/PATCH `/tutors/me`; POST `/tutors/me/education`; DELETE `/tutors/me/education/{id}`; GET/PUT `/tutors/me/availability`; PUT `/tutors/me/subjects`; POST `/tutors/me/change-requests`   |
| Student Profile | GET/PUT `/students/me`; PUT `/students/me/emergency-contact`                                                                                                                                   |
| Tutor Search    | GET `/tutors`, `/tutors/{id}`, `/tutors/{id}/availability`                                                                                                                                     |
| Marketplace     | GET/POST `/jobs`; GET `/jobs/{id}`; PATCH `/jobs/{id}/status`; POST `/jobs/{id}/share`; GET `/jobs/{id}/applications`; POST `/jobs/{id}/apply`; PATCH `/applications/{id}/status`              |
| Prerequisites   | POST `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; GET `/users/me`; PATCH `/users/me/mode`; POST `/profiles/student`, `/profiles/tutor`; GET `/subjects`, `/subjects/{id}` |

All paths have `/api/v1` prefix. TRD-compatible aliases: POST `/jobs/{id}/applications`,
POST `/jobs/{jobId}/applications/{id}/accept`, POST `/auth/refresh-token`.
See Swagger for exact request fields and filters. Requests use snake_case V2 names, strict validation
and server-generated IDs. JSON responses use `{ data: ... }`; errors use `{ error: { code, message,
requestId, timestamp } }`. Access tokens carry `sub = users.id`, `sid = user_sessions.id`. Refresh
tokens are HttpOnly/SameSite cookies and only SHA-256 hashes persist in V2.

PUT on an individual profile changes only supplied fields. PUT availability/subjects replaces the
whole active collection atomically while retaining inactive history. Parent/emergency contacts
belong to the student profile and never grant a PARENT role.

Public tutor/job reads do not return exact coordinates, contacts, bank/PromptPay details or private
file keys. Tutor search rechecks active users, held tutor roles and account status on every request.
Search uses subject-specific rates, published student-to-tutor ratings, local availability and
PostGIS geography casts for kilometer filters. Availability is local wall time (Asia/Bangkok);
audit/session timestamps are UTC. Paginated feeds sort by creation time and ID, newest first.

## Source authority and boundaries

- [Updated TRD](https://docs.google.com/document/d/12ZN41mn84vj8Ajf1gxLqUKhfcUKfos1PThFcdH7Wqoc/edit): backend stack and architectural decisions.
- Supplied [Database Schema V2](docs/reference/Database-Schema-ForAllTutor-V2.md): all 24 core tables,
  exact columns, prefixed IDs, foreign keys, declared unique/check constraints and enum values.
- Exported Notion API checklists: four assigned modules and their route names. [Mapping and decisions](docs/implementation-notes.md).
- The original Python setup README is retained in [legacy guide](docs/legacy-python-setup.md) for
  provenance. It is superseded by this runnable Node.js guide.

No `tutor_bids`, Match entity, group-enrollment tables or invoice-items schema is invented.
AI/Embedding stays in a [separate extension](prisma/ai-extension/README.md) with independent
migrations. This work implements filtered discovery, not semantic AI recommendations.

Monthly consolidated commission billing, group classes, Google OAuth, storage upload/transcoding,
admin review of change requests and the rest of the booking/session/payment lifecycle belong to
separate tasks. Existing BRD requirements remain intact and are not asserted to be supported by V2
where persistence gaps exist. Media/evidence references require active owned `storage_files`
records supplied by the storage module; clients cannot register arbitrary keys through these APIs.

## Deployment

```powershell
npm run build
npm start
docker build -t tewsday-api .
```

Run migrations as a separate owner-credential deployment job, then run the non-root Docker image
with the restricted runtime DB credentials, a strong JWT secret and Redis. Terminate HTTPS at the
company reverse proxy and set `TRUST_PROXY_HOPS` to the exact trusted proxy count. Configure
`CORS_ORIGINS` explicitly; production refuses wildcard origins, the example secret or absent Redis.
Use separate test/staging/production databases and rotate credentials through your secret manager.

PostGIS columns are `Unsupported` in Prisma and use parameterized Prisma SQL for geometry writes
and meter-based spatial queries, following [Prisma's raw-query guidance](https://docs.prisma.io/docs/orm/prisma-client/using-raw-sql/safeql).
Prisma is pinned to the compatible stable 6.12 line; upgrades require migration and integration
verification. Commit the lockfile and run dependency audits in CI.
