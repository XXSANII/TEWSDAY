# V2/TRD implementation mapping

## Scope and precedence

The attached Notion board assigns Tutor Profile, Student Profile, Tutor Search and Marketplace to
Kong. Implement those complete route checklists, plus prerequisites required to exercise them.
Auth, User/Mode, Subjects, Bookings, Class Sessions, Invoices/Payments, Chat, Reviews, Storage and
Q&A have separate Notion ownership. Only explicitly listed prerequisites and the booking side
effect of application acceptance are supplied here.

The live TRD (read 2026-10-08) confirms Express/Node, modular services/repositories, durable V2
sessions and separate AI storage. The exported Python/SQLAlchemy/ARQ setup text conflicts with
that stack and is preserved as a legacy reference. The user explicitly confirmed Node.js +
Express + TypeScript + Prisma. V2 wins over Notion examples which assume additional constraints.

## Important implementation decisions

- **Duplicate guards:** V2 does not declare unique `(job_id,tutor_id)` applications, originating-job
  bookings or pending change-request types. Job/tutor row locks enforce those application guards;
  the second migration adds non-unique access-path indexes only. Acceptance locks job then
  application and eligible tutor; it snapshots the selected `proposed_rate`, rejects competitors,
  updates the job to MATCHED, writes notifications and creates one PENDING_CONFIRMATION booking
  in one transaction. Repeated acceptance returns the existing booking. Different selections
  racing for the same job produce one success and a conflict. Client idempotency-key persistence
  is not claimed because V2 has no such table.
- **Rate input:** Tutors can edit their advertised `hourly_rate` and submit `proposed_rate` as the
  explicit Notion routes require. Client input cannot set `agreed_hourly_rate`, gross amounts,
  account/verification states, actor IDs or audit fields. Booking money is copied server-side
  from the accepted application. Decimal outputs from Prisma serialize as strings; JSON profile
  snapshots expose advertised rates as numbers.
- **Account gating:** Discovery requires active user/profile, held TUTOR role and ACTIVE tutor
  account status. New applications/acceptance require ACTIVE status, active supported subject
  and target grade, with no self-application. Verification is displayed and can be filtered;
  Notion explicitly leaves mandatory VERIFIED gating undecided, so it is not silently imposed.
- **Private projections:** Public endpoints exclude exact tutor/job coordinates, payment/contact
  details, private evidence files and auth data. Only APPROVED video with an attached source file
  exposes a streaming URL; private download authorization remains owned by Storage. Clients must
  treat publicly authored bios/goals/comments as text, not HTML.
- **Legal/education changes:** Direct tutor updates cannot write legal names. New education is
  unverified; verified education cannot be directly removed. LEGAL_NAME/EDUCATION requests retain
  current-data snapshots without changing approved profile data, and serialize pending requests
  by tutor/type. IDENTIFICATION and OTHER requests are not accepted without an agreed field and
  review contract; V2 contains those enum values but no canonical identity-number field.
- **Availability:** Up to 100 slots, exclusive recurring-day/specific-date selection, valid time
  ranges, and no overlap within the same schedule type/day. Replacement soft-deactivates the old
  active set. Recurring and exceptional date slots may both apply to a date; this is availability,
  not a reservation or session-overlap guarantee. Booking/session scheduling is separate.
- **Onboarding:** Auth defaults to STUDENT. Creating an owned tutor profile grants TUTOR while
  preserving current_mode; authority always uses held roles and ownership. Geometry is required
  on profile creation as V2 specifies. New tutor video state is initialized to PROCESSING; absent
  a video file, no pipeline job or public video is claimed. The media module owns later states.
- **Auth handoff:** LOCAL register/login/refresh/logout are supplied as prerequisites. Access JWT
  is 15 minutes, refresh session 7 days. Every authenticated request checks V2 revocation/expiry
  and active users. Refresh rotation keeps the original absolute expiry and rejects stale hashes;
  logout invalidates existing access JWTs immediately. Google/other provider integrations remain
  with the Auth task. The provider enum is preserved without pretending those integrations exist.
- **Email guard:** V2 does not declare unique users.email. Registration serializes normalized
  email with a PostgreSQL transaction advisory lock and checks existing accounts, including
  inactive ones. This is a service guard, not an added unique constraint or automatic linking.
- **Audit:** DB triggers capture entity changes with an actor set by the service transaction.
  Successful authenticated mutations also append an activity event (HTTP method/path and request
  ID) in that transaction, correlated to the durable auth session. Failed transactions retain
  neither the mutation nor its success event; request bodies and secrets never enter activity metadata.
  Password hashes, refresh hashes and provider metadata are excluded from audit snapshots. Private
  profile snapshots remain access-controlled audit history; diagnostic logs never log bodies,
  headers or query strings. For composite tutor_subjects, record_id is the tutor ID and snapshots
  contain both key components, since concatenating the keys exceeds V2 VARCHAR(36). Log mutation
  triggers deny UPDATE/DELETE; runtime grants deny DELETE/TRUNCATE/DDL and audit inserts. A database
  owner can administer or disable triggers; production operator access must be controlled.
- **All 24 models:** Core SQL creates all V2 domains to preserve complete FKs and team integration.
  Models for other tasks do not imply implemented endpoints. PostGIS infrastructure (spatial_ref_sys)
  is not an additional business table. Geometry/check/expression-index limitations are handled in
  committed SQL, never through `prisma db push` or destructive auto-generated migrations.
- **Replay policies:** Closed/cancelled job updates and application reject/withdraw replays return
  the stored outcome. Re-applying after withdrawal is rejected until the business policy is
  resolved. Shares are increments per accepted request and have no per-user uniqueness claim.
- **Bounded lists:** Feeds use creation-time/ID keyset cursors (20 default, 100 maximum). Profile
  detail shows latest 20 published reviews; application lists cap at 100 and subjects at 500.
  Further pagination for these auxiliary lists is a future extension, not silently unbounded I/O.

## Traceability

| Requirement     | Module / verification                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| BR-001 / TR-003 | LOCAL foundation, JWT durable-session middleware, refresh/revocation tests             |
| BR-002 / TR-005 | Own tutor/student profiles, evidence ownership, pending sensitive changes              |
| BR-003 / TR-005 | Active public tutor projection, subject/grade/rate/rating/availability, PostGIS meters |
| BR-004 / TR-006 | V2 job fields, ownership, OPEN → CLOSED/CANCELLED, cursor feed                         |
| BR-005 / TR-006 | Eligible application, proposed rate, transactional manual acceptance → booking         |
| BR-012 / TR-012 | Immutable entity audit, actor capture, retained soft-deleted history                   |
| TR-014          | Exact V2-column schema test, FK-preserving migration, separate extension directory     |

BR-006 semantic ranking and TR-013 AI extension are separate future modules. BR-007–BR-011 session,
payment, commission and full review flows are preserved requirements outside these four tasks.
Monthly invoice consolidation/group-class gaps documented in TRD remain unresolved; no API here
asserts those capabilities are Done. Expiry policy is configurable in BRD but no approved expiry
setting is supplied to this task; explicit owner closing/cancellation is implemented, with no
invented expires_at or EXPIRED state.

## Existing main Auth integration

Merged main commit `4e61a92` and preserved the team's register/login/refresh-token/logout,
sessions and OAuth route names. Auth now shares the Prisma connection, transactional registration,
15-minute JWTs, absolute 7-day refresh expiry, HttpOnly cookies and per-request DB revocation checks.
The `pg`-based duplicate connection/repositories and unchecked token middleware were consolidated.
Session DELETE now returns a complete response, checks ownership, and revokes both access and refresh
use. Registration accepts and validates optional `confirm_password`; existing bcrypt hashes are
supported, while newly created credentials use Argon2id. No real legacy database was migrated.
JSON refresh tokens and prior 1-hour/30-day lifetimes are intentionally replaced by the supplied TRD
contract. OAuth remains a 501 placeholder, as on main. Normalized LF text is enforced across platforms.
