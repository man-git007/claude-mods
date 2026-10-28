# Ops hardening card (load only for steps with external calls or after-commit side effects)

- Every external call (S3, HTTP, queue) has an explicit timeout. Retry only transient failures (timeouts, 5xx/503), max 3 attempts, exponential backoff with jitter. Never retry non-idempotent writes without an idempotency key.
- Irreversible side effects (S3 delete, emails, events) run in the service AFTER the DB commit. If they fail, log at `error` with context and do NOT fail the already-committed request unless the plan says so.
- Clean up resources in `finally` (streams, temp files, query runners).
- Use Nest `Logger` with structured context (`{ projectId, userId }`). Also never log presigned URLs or auth headers.
- Presigned URLs: short expiry (minutes), generated per request, never stored.
