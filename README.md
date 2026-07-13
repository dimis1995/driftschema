# driftschema

A lightweight, dynamic schema library for TypeScript that defines and evolves entity fields at runtime, without migrations.

## Why driftschema?

Traditional ORMs bind you to a schema defined and compiled into your application code. Adding a field means writing and running a migration. driftschema treats field definitions as **data**: registering, deprecating, or evolving a field is a runtime operation against a store, not a code change or a migration script.

This makes it a good fit for domains where the shape of a record legitimately varies per use case, such as user-defined inventory attributes, configurable form fields, pluggable metadata, without maintaining a parallel rigid schema (or a database migration) for every variation.

## Core concepts

- **`FieldDefinition`** metadata describing one field: its name, type, whether it's required, and which entity type it belongs to. Stored and managed independently of any actual data.
- **`StoredRecord`** the low-level persisted shape of a record. Its `fields` map is keyed by field **id** (not name), so renaming a field never invalidates existing data.
- **`FlatRecord`** an ergonomic, flattened view of the same record, with fields addressable by **name** (e.g. `record.caratWeight`) instead of by id. Every `RecordStore` can produce and accept either shape — they're two views of the same underlying data, not two parallel systems.
- **`RecordStore`** the interface all storage backends implement. Ships with an in-memory implementation today; database-backed implementations are planned as separate packages.

## Installation

```bash
npm install driftschema
```

No runtime dependencies — driftschema's in-memory core relies only on built-in JavaScript/Node APIs.

## Usage

```ts
import { FieldDefinitionStore, RecordStoreFactory } from "driftschema";

// 1. Define the schema for an entity type.
const fieldDefinitions = new FieldDefinitionStore();

const caratWeight = fieldDefinitions.add({
  entityType: "diamonds",
  name: "caratWeight",
  type: "number",
  required: true,
});

const shape = fieldDefinitions.add({
  entityType: "diamonds",
  name: "shape",
  type: "string",
  required: false,
});

// 2. Get a record store. Defaults to the in-memory engine.
const store = await RecordStoreFactory.create("memory", fieldDefinitions);

// 3. Create a record using the high-level (flat) API — fields addressed by name.
const diamond = await store.createFlat("diamonds", {
  caratWeight: 1.5,
  shape: "round",
});

console.log(diamond);
// { id: "...", entityType: "diamonds", caratWeight: 1.5, shape: "round" }

// 4. Or use the low-level (stored) API — fields addressed by id, closer to persistence.
const storedDiamond = await store.create("diamonds", new Map([[caratWeight.id, 2.0]]));

// 5. Validation is enforced identically on both APIs.
import { ValidationError } from "driftschema";

try {
  await store.create("diamonds", new Map()); // missing required caratWeight
} catch (err) {
  if (err instanceof ValidationError) {
    console.log(err.issues); // ["caratWeight is missing"]
  }
}
```

See [`examples/basic-usage.ts`](./examples/basic-usage.ts) for a fuller runnable walkthrough.

## API

### `FieldDefinition`

| Field          | Type                                          | Description                                                                                  |
| -------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id`           | `string`                                      | Auto-generated unique identifier                                                             |
| `entityType`   | `string`                                      | Logical grouping (e.g. `"diamonds"`)                                                         |
| `name`         | `string`                                      | Field name, used in the flat API                                                             |
| `type`         | `"string" \| "number" \| "boolean" \| "date"` | Field data type                                                                              |
| `required`     | `boolean`                                     | Whether the field must be present on a record                                                |

### `FieldDefinitionStore`

- `add(def)` — registers a new field definition, returns it with a generated `id`
- `getByEntityType(entityType)` — returns all field definitions for a given entity type

### `RecordStore` (interface)

- `create(entityType, fields)` — creates a record from a `Map<fieldId, value>`, validated against the entity's field definitions
- `createFlat(entityType, flat)` — creates a record from a plain object keyed by field name
- `getById(id)` / `getByEntityType(entityType)` — retrieve `StoredRecord`(s)
- `getFlatById(id)` / `getFlatByEntityType(entityType)` — retrieve the same data as `FlatRecord`(s)
- `delete(id)` — removes a record

### `RecordStoreFactory`

- `RecordStoreFactory.create(engine, fieldDefinitionStore, config?)` — returns a `RecordStore` for the given engine.

## Design notes

A few deliberate scope decisions, in case they come up:

- **No record-level timestamps.** driftschema doesn't stamp `createdAt`/`updatedAt` on records. That's an application-level concern with varying semantics (created vs. modified vs. soft-deleted). Model it as an ordinary `FieldDefinition` if you need it.
- **Fields are keyed by id in storage, by name in the flat view.** This is the core mechanism that lets a field be renamed without breaking existing records.

## License

MIT — see [LICENSE](./LICENSE).
