# Service logic card

- Validate cross-field and cross-entity rules in the service (e.g. `endDate >= startDate`, ownership, slug exists in the right category) and throw the appropriate Nest exception with a clear message.
- Log ownership and role denials at `warn` with user id and resource id before throwing.
- Re-validate rules against MERGED values on partial updates (stored values + patch), not just the patch.
- Time: use the shared helper (`<FILL: name and path, e.g. todayInNpt()>`), never inline `new Date()` in rules. This keeps tests deterministic.
- Inject external collaborators (storage, etc.) as interfaces through the constructor.
- Early returns and guard clauses; nesting ≤ 2 levels; functions do one thing and fit on a screen (~30 lines). Named constants/enums instead of magic values.
- No speculative abstraction: no new interface or strategy unless the step lists it or there are already two implementations.
- No empty `catch`. Catch specific exceptions; every caught error is handled, logged, or rethrown.
