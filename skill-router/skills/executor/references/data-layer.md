# Data layer card (NestJS + TypeORM + PostgreSQL)

- Queries: QueryBuilder/`find` with bound parameters. For `ILIKE`, escape `%`, `_` and `\` in the term and pass it as a parameter.
- Filtering through a one-to-many relation (e.g. project locations): use `EXISTS`/semi-join, not a plain JOIN, so rows are not duplicated and `COUNT` stays correct.
- Always paginate list queries (`take`/`skip` or `limit`/`offset`) with a deterministic `ORDER BY` that ends in a unique tiebreaker (`created_at DESC, id`). Return `[items, total]`.
- No N+1: load related rows with one joined/`IN` query, never a query inside a loop.
- Multi-table writes run in ONE transaction owned by the repository method (`dataSource.transaction(...)`). The service calls one repository method, not several.
- `numeric`/`decimal` columns come back from TypeORM as strings. Convert deliberately at the repository/mapper boundary; never do float math on money.
- Review generated migration SQL: names, enums, defaults, indexes.
- Add an index for every column used in a frequent `WHERE`, join or `ORDER BY` of the step's queries. No speculative indexes.
- Repository methods return `T | null` for "not found"; the service decides whether that is a 404.
