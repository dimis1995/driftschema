# driftschema-postgres

A PostgreSQL-backed storage engine for [driftschema](https://www.npmjs.com/package/driftschema) — a lightweight, dynamic schema library for TypeScript that defines and evolves entity fields at runtime, without migrations.

This package provides:

- **`PostgresRecordStore`** — a `RecordStore` implementation that persists records as JSONB rows in a Postgres table.
- **`PostgresFieldDefinitionStore`** — a `FieldDefinitionStore` implementation that persists field definitions in a Postgres table.

## Installation

```bash
npm install driftschema driftschema-postgres pg
```

## Schema setup

Unlike Mongo's schemaless collections, Postgres needs the `records` and `field_definitions` tables to exist before use. This package exports the DDL as a plain string, plus a convenience helper — **neither store runs this automatically**; a real deployment should own schema changes through its own migration tool instead.

```ts
import { Pool } from "pg";
import { createSchema, POSTGRES_SCHEMA_SQL } from "driftschema-postgres";

const pool = new Pool({ connectionString: "postgres://localhost/my-app" });
await createSchema(pool); // runs POSTGRES_SCHEMA_SQL — idempotent (CREATE ... IF NOT EXISTS)
```

`POSTGRES_SCHEMA_SQL` is the copy-pasteable source of truth if you'd rather commit it as a migration in your own tool (Flyway, Prisma, knex, raw `psql`, ...).

## Usage

### Via `RecordStoreFactory` (recommended)

Importing `driftschema-postgres` registers the `"postgres"` engine with driftschema's `RecordStoreFactory` as a side effect, so you can create a Postgres-backed store the same way you'd create the in-memory or Mongo ones — just with a different engine name and config:

```ts
import { Pool } from "pg";
import { RecordStoreFactory } from "driftschema";
import { PostgresFieldDefinitionStore } from "driftschema-postgres";

const pool = new Pool({ connectionString: "postgres://localhost/my-app" });

const fieldDefinitions = new PostgresFieldDefinitionStore(pool);

const caratWeight = await fieldDefinitions.add({
  entityType: "diamonds",
  name: "caratWeight",
  type: "number",
  required: true,
});

const recordStore = await RecordStoreFactory.create("postgres", fieldDefinitions, { pool });

const diamond = await recordStore.createFlat("diamonds", { caratWeight: 1.5 });
```

`RecordStoreFactory.create("postgres", ...)` dynamically imports `driftschema-postgres` if it isn't already loaded, so this also works without an explicit import of this package — `RecordStoreFactory` finds it by its known engine-to-package mapping.

### Direct instantiation

```ts
import { Pool } from "pg";
import { PostgresFieldDefinitionStore, PostgresRecordStore } from "driftschema-postgres";

const pool = new Pool({ connectionString: "postgres://localhost/my-app" });

const fieldDefinitions = new PostgresFieldDefinitionStore(pool);
const recordStore = new PostgresRecordStore(fieldDefinitions, pool);
```

See [`examples/basic-usage.ts`](./examples/basic-usage.ts) and [`examples/query-usage.ts`](./examples/query-usage.ts) for fuller runnable walkthroughs (both use `embedded-postgres`, so they run standalone with no real database required — run them with `npm run example`).

## API

### `PostgresFieldDefinitionStore`

`new PostgresFieldDefinitionStore(pool: Pool, tableName = "field_definitions")`

Implements driftschema's `FieldDefinitionStore` interface: `add`, `getByEntityType`, `getAll`, `upsert`, `delete`.

### `PostgresRecordStore`

`new PostgresRecordStore(fieldDefinitionStore: FieldDefinitionStore, pool: Pool, tableName = "records")`

Implements driftschema's `RecordStore` interface in full.

**Filtering** — `query`/`queryFlat` accept driftschema's baseline filter DSL: a plain object keyed by field name, where each value is either a direct value (implicit equality) or an operator object drawn from `$eq`/`$ne`/`$gt`/`$gte`/`$lt`/`$lte`/`$in` — the same syntax `packages/core`'s in-memory engine implements. **This is not a native SQL/driver passthrough** the way `driftschema-mongo`'s filters are native Mongo operators; there's no `$and`/`$or`/`$regex`/raw SQL fragment support. Each filter is translated into a parameterized predicate against the underlying `fields` JSONB column.

**Pagination** — `getByEntityType`, `query`, and their flat counterparts accept either:

- `{ offset?, limit? }` — page-N navigation.
- `{ after?, limit? }` — keyset/cursor pagination, sorted by `id`. This is a stable total order but has **no relationship to insertion order** (ids are random UUIDs) — it exists to make paging through large result sets cheap and stable under concurrent inserts, not to convey recency.

Specifying both `after` and `offset` throws.

### `RecordStoreFactory` config

When creating the `"postgres"` engine via `RecordStoreFactory.create`, the `config` argument must be:

```ts
interface PostgresRecordStoreConfig {
  pool: Pool;
  tableName?: string;
}
```

## Design notes

- **Record and field-definition IDs are app-generated UUIDs** (`crypto.randomUUID()`), not database-generated defaults — matching how `packages/core`'s in-memory store already mints ids (only `driftschema-mongo` differs, since it's forced to use Mongo's own `ObjectId`). Knowing the id before insert also means `createFlat` doesn't need the placeholder-id round trip Mongo's version does.
- **Records are stored as a single JSONB blob column** (`fields`, keyed by field id), mirroring `driftschema-mongo`'s document shape almost exactly — not a normalized table with one column per field. Indexing individual fields is left as an operational, per-deployment concern (a GIN index on the whole `fields` column is created by `createSchema` as a cheap default; expression indexes on specific `fields->>'<id>'` paths are your call).
- **`{ field: null }` matches a wholly absent field, not just an explicit JSON `null`.** JSONB's `->>'key'` extraction can't distinguish "key absent" from "key present with value `null`" — both read as SQL `NULL`. This matches `driftschema-mongo`'s own `{ field: null }` semantics, but differs from the in-memory engine, which — backed by real JS `Map`s — can tell the two apart.
- **`update()` closes one race, not every race.** Mongo's `update()` reads the record, merges the patch into it in application code, and writes the whole merged object back — a concurrent writer's change to a field this call never touched can get silently overwritten. Postgres's `update()` instead runs `fields = fields || $patch::jsonb` as a single atomic statement, so a concurrent change to an untouched field survives. What's _not_ eliminated: this call's `validateFields` check still runs against a read that could go stale if field definitions change between the read and the write — closing that fully would need a serializable transaction around the whole read-validate-write sequence, which is out of scope here. `replace()` has no equivalent race, since it's a full overwrite rather than a merge.

## License

MIT — see the root [LICENSE](../../LICENSE).
