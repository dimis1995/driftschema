# driftschema-mongo

A MongoDB-backed storage engine for [driftschema](https://www.npmjs.com/package/driftschema) — a lightweight, dynamic schema library for TypeScript that defines and evolves entity fields at runtime, without migrations.

This package provides:

- **`MongoRecordStore`** — a `RecordStore` implementation that persists records to a MongoDB collection.
- **`MongoFieldDefinitionStore`** — a `FieldDefinitionStore` implementation that persists field definitions to a MongoDB collection.

## Installation

```bash
npm install driftschema driftschema-mongo mongodb
```

## Usage

### Via `RecordStoreFactory` (recommended)

Importing `driftschema-mongo` registers the `"mongo"` engine with driftschema's `RecordStoreFactory` as a side effect, so you can create a Mongo-backed store the same way you'd create the in-memory one — just with a different engine name and config:

```ts
import { MongoClient } from "mongodb";
import { RecordStoreFactory } from "driftschema";
import { MongoFieldDefinitionStore, type MongoRecordDocument } from "driftschema-mongo";

const client = await MongoClient.connect("mongodb://localhost:27017");
const db = client.db("my-app");

const fieldDefinitions = new MongoFieldDefinitionStore(db.collection("fieldDefinitions"));

const caratWeight = await fieldDefinitions.add({
  entityType: "diamonds",
  name: "caratWeight",
  type: "number",
  required: true,
});

const recordStore = await RecordStoreFactory.create("mongo", fieldDefinitions, {
  collection: db.collection<MongoRecordDocument>("records"),
});

const diamond = await recordStore.createFlat("diamonds", { caratWeight: 1.5 });
```

`RecordStoreFactory.create("mongo", ...)` dynamically imports `driftschema-mongo` if it isn't already loaded, so this also works without an explicit import of this package — `RecordStoreFactory` finds it by its known engine-to-package mapping.

### Direct instantiation

You can also construct the stores directly, without going through the factory:

```ts
import { MongoClient } from "mongodb";
import {
  MongoFieldDefinitionStore,
  MongoRecordStore,
  type MongoRecordDocument,
} from "driftschema-mongo";

const client = await MongoClient.connect("mongodb://localhost:27017");
const db = client.db("my-app");

const fieldDefinitions = new MongoFieldDefinitionStore(db.collection("fieldDefinitions"));
const recordStore = new MongoRecordStore(
  fieldDefinitions,
  db.collection<MongoRecordDocument>("records"),
);
```

See [`examples/basic-usage.ts`](./examples/basic-usage.ts) for a fuller runnable walkthrough (uses `mongodb-memory-server`, so it runs standalone with no real database required — run it with `npm run example`).

## API

### `MongoFieldDefinitionStore`

`new MongoFieldDefinitionStore(collection: Collection<MongoFieldDefinitionDocument>)`

Implements driftschema's `FieldDefinitionStore` interface: `add`, `getByEntityType`, `delete`.

### `MongoRecordStore`

`new MongoRecordStore(fieldDefinitionStore: FieldDefinitionStore, collection: Collection<MongoRecordDocument>)`

Implements driftschema's `RecordStore` interface: `create`, `createFlat`, `getById`, `getByEntityType`, `getFlatById`, `getFlatByEntityType`, `delete`.

`getByEntityType`, `query`, and their flat counterparts accept a `{ skip?, limit? }` pagination option, applied directly to the underlying find cursor.

### `RecordStoreFactory` config

When creating the `"mongo"` engine via `RecordStoreFactory.create`, the `config` argument must be:

```ts
interface MongoRecordStoreConfig {
  collection: Collection<MongoRecordDocument>;
}
```

## Design notes

- **Record IDs are Mongo `ObjectId`s, stringified.** driftschema's `id` fields are always strings; this package converts to/from `ObjectId` at the boundary (see `mapping.ts`).
- **No index management yet.** This package doesn't create indexes (e.g. a uniqueness constraint on `entityType` + `name` for field definitions) — that's left as an operational concern for now.

## License

MIT — see the root [LICENSE](../../LICENSE).
