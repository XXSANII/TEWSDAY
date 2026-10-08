# AI/Embedding extension boundary

Core migrations in `prisma/migrations` implement only Database Schema V2. No vector tables,
pgvector indexes or AI feedback records belong to that schema.

When the separately owned matching module is implemented, put its migrations in an independent
AI schema/store and deployment pipeline. Refresh redacted semantic text only after core commits,
with content hashes/model versions and retry/reconciliation. Recheck active users, tutor roles,
account status and hard subject/grade/rate/location/availability filters at retrieval time.
Embedding outages must not block these four API modules or create bookings automatically.

This change implements deterministic filtered discovery, not semantic recommendations. No AI
provider key, vector dimension or unapproved persistence extension is assumed here.
