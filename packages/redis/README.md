# driftschema-redis

A Redis-backed storage engine for [driftschema](https://www.npmjs.com/package/driftschema) — a lightweight, dynamic schema library for TypeScript that defines and evolves entity fields at runtime, without migrations.

This package currently provides:

- **`RedisFieldDefinitionStore`** — a `FieldDefinitionStore` implementation that persists field definitions to Redis.

There is no `RedisRecordStore` yet, so records themselves need a different `RecordStore` (e.g. driftschema's built-in `InMemoryRecordStore`, or `driftschema-mongo`'s `MongoRecordStore`) — see [Usage](#usage) below.

## Installation

```bash
npm install driftschema driftschema-redis redis
```

## Usage

`RedisFieldDefinitionStore` is constructed directly with a connected [node-redis](https://github.com/redis/node-redis) client — there's no `RecordStoreFactory` engine to register here, since this package doesn't provide a record store.

```ts
import { createClient } from "redis";
import { InMemoryRecordStore } from "driftschema";
import { RedisFieldDefinitionStore } from "driftschema-redis";

const client = createClient({ url: "redis://localhost:6379" });
await client.connect();

const fieldDefinitions = new RedisFieldDefinitionStore(client);

const caratWeight = await fieldDefinitions.add({
  entityType: "diamonds",
  name: "caratWeight",
  type: "number",
  required: true,
});

// Any FieldDefinitionStore can back InMemoryRecordStore — schema lives in
// Redis, records live in memory.
const recordStore = new InMemoryRecordStore(fieldDefinitions);

const diamond = await recordStore.createFlat("diamonds", { caratWeight: 1.5 });
```

See [`examples/basic-usage.ts`](./examples/basic-usage.ts) for a fuller runnable walkthrough (uses `redis-memory-server`, so it runs standalone with no real Redis deployment required — run it with `npm run example`).

## API

### `RedisFieldDefinitionStore`

`new RedisFieldDefinitionStore(client: RedisClientType)`

Implements driftschema's `FieldDefinitionStore` interface: `add`, `getByEntityType`, `delete`.

## Design notes

- **Field definition ids are plain GUIDs** (`crypto.randomUUID()`), not Redis-prefixed — the id is a domain concept shared with the other storage engines (e.g. `driftschema-mongo`), so it stays implementation-agnostic.
- **Redis-specific namespacing lives in the key, not the id.** Each definition is stored as JSON at `fielddef:<id>`, since a Redis instance is often shared with unrelated data and a bare id as the key would risk collisions.
- **`getByEntityType` is backed by a secondary index** — a Redis set at `fielddef:byEntityType:<entityType>` holding the ids for that type, kept in sync by `add` and `delete`. This avoids scanning the whole keyspace to filter by field.

## License

MIT — see the root [LICENSE](../../LICENSE).
