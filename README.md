# driftschema

A lightweight, dynamic schema library for TypeScript that defines and evolves entity fields at runtime, without migrations.

## Why driftschema?

Traditional ORMs bind you to a schema defined and compiled into your application code. Adding a field means writing and running a migration. driftschema treats field definitions as **data**: registering, deprecating, or evolving a field is a runtime operation against a store, not a code change or a migration script.

This makes it a good fit for domains where the shape of a record legitimately varies per use case, such as user-defined inventory attributes, configurable form fields, pluggable metadata, without maintaining a parallel rigid schema (or a database migration) for every variation.

## Core concepts

- **`FieldDefinition`** metadata describing one field: its name, type, whether it's required, and which entity type it belongs to. Stored and managed independently of any actual data.
- **`StoredRecord`** the low-level persisted shape of a record. Its `fields` map is keyed by field **id** (not name), so renaming a field never invalidates existing data.
- **`FlatRecord`** an ergonomic, flattened view of the same record, with fields addressable by **name** (e.g. `record.caratWeight`) instead of by id. Every `RecordStore` can produce and accept either shape — they're two views of the same underlying data, not two parallel systems.
- **`RecordStore`** the interface all storage backends implement.

## Packages

This is a monorepo containing driftschema and its official storage engines:

- [`driftschema`](./packages/core) — the core library: `FieldDefinition`, `RecordStore`, and an in-memory storage engine. Start here.
- [`driftschema-mongo`](./packages/mongo) — a MongoDB-backed storage engine for driftschema.
- [`driftschema-postgres`](./packages/postgres) — a PostgreSQL-backed storage engine for driftschema.
- [`driftschema-redis`](./packages/redis) - a Redis-backed fields definition store for driftschema.

## Quick start

```bash
npm install driftschema
```

```ts
import { FieldDefinitionStore, RecordStoreFactory } from "driftschema";

const fieldDefinitions = new FieldDefinitionStore();

fieldDefinitions.add({
  entityType: "diamonds",
  name: "caratWeight",
  type: "number",
  required: true,
});

const store = await RecordStoreFactory.create("memory", fieldDefinitions);

const diamond = await store.createFlat("diamonds", { caratWeight: 1.5 });
```

## License

MIT — see [LICENSE](./LICENSE).
