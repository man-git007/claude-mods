# HTTP boundary card (controllers, DTOs, access control)

- Controllers: apply the permission decorator/guard, call ONE service method, return its result.
- Mandatory DTO fields have no `@IsOptional()`. Whitelist enums with `@IsIn`/`@IsEnum`.
- Path params that are ids: `ParseUUIDPipe`. Query DTOs: coerce numbers with `@Type(() => Number)` and bound them (`@Min`, `@Max`), e.g. `limit` max 100.
- Every route needs an explicit auth + permission guard/decorator. Never rely on context.
- Authorization = permission AND ownership. When a resource id is in the path, verify the caller may access THAT resource (IDOR). Return 404 (not 403) for "exists but not yours" when the plan says so.
- Take identity fields (`organization_id`, user id) from the authenticated user, never from the body, unless the plan names a privileged override.
- Omit sensitive or role-restricted fields (the plan says which) when mapping to the response DTO in the service, not in the controller.
- No stack traces or internal messages in responses.
- Success responses go through the existing envelope/interceptor (`<FILL: path>`); do not hand-build `{statusCode, message, data}`.
- File uploads: enforce max size and an allowlist of MIME types/extensions at the interceptor; never use client-provided file names as storage keys.
- Public or expensive endpoints (unauthenticated, external calls, heavy queries, file generation) get the throttler. If none is configured, flag it in the final message; do not add one.
- Auth/permission logic denies on unexpected state (fail closed). If a step touches a new auth flow, payment data, or upload validation the plan does not cover, stop and report.
- Stream large uploads and exports; never buffer them whole in memory. No sync `fs` calls or CPU-heavy loops on the request path.
