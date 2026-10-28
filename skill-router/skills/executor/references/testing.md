# Testing card (Vitest, NestJS)

- Runner is Vitest: use `vi`, not `jest`.
- Unit tests mock the repository INTERFACE with `vi.fn()` objects, provided via `Test.createTestingModule` using the injection token. No real DB, network or S3.
- Assert on outcome (return value, thrown exception type + message/field). Assert on a repository call only where the call itself is the behavior (e.g. "does not call update when not owner").
- Error paths: `await expect(fn()).rejects.toThrow(NotFoundException)` (or the specific exception).
- Ownership/permission failure scenarios: assert the exception type AND that no write method was called.
- Control time and randomness: `vi.useFakeTimers()` or mocked helpers; restore in `afterEach`.
- DTO tests: instantiate with `plainToInstance`, run `validate`, assert on the failing property names.
