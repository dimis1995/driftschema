import { RedisMemoryServer } from "redis-memory-server";
import { createClient } from "redis";
import { InMemoryRecordStore, ValidationError, type FieldValue } from "driftschema";
import { RedisFieldDefinitionStore } from "../src/RedisFieldDefinitionStore.js";

// This example spins up an in-memory Redis server so it runs standalone,
// with no real Redis deployment required. Point `createClient` at a real
// Redis URL instead to use this against an actual deployment.
const redisServer = await RedisMemoryServer.create();
const client = createClient({
  url: `redis://${await redisServer.getHost()}:${await redisServer.getPort()}`,
});
await client.connect();

// 1. Define the schema for an entity type, persisted in Redis.
const fieldDefinitions = new RedisFieldDefinitionStore(client);

const caratWeight = await fieldDefinitions.add({
  entityType: "diamonds",
  name: "caratWeight",
  type: "number",
  required: true,
});

const shape = await fieldDefinitions.add({
  entityType: "diamonds",
  name: "shape",
  type: "string",
  required: false,
});

console.log("Registered fields:", await fieldDefinitions.getByEntityType("diamonds"));

// 2. Records themselves are kept in memory — only the schema is persisted to Redis.
// Any FieldDefinitionStore can back InMemoryRecordStore, so the two are mixed here directly.
const recordStore = new InMemoryRecordStore(fieldDefinitions);

const storedDiamond = await recordStore.create(
  "diamonds",
  new Map<string, FieldValue>([
    [caratWeight.id, 1.5],
    [shape.id, "round"],
  ]),
);

console.log("\nStored (low-level) record:", storedDiamond);

// 3. Create records using the high-level (FlatRecord) API — keyed by field name.
const flatDiamond = await recordStore.createFlat("diamonds", {
  caratWeight: 2.0,
  shape: "oval",
});

console.log("\nFlat record (created via createFlat):", flatDiamond);

// 4. The two APIs are two views of the same data — read the low-level record back flat.
const flatView = await recordStore.getFlatById(storedDiamond.id);
console.log("\nSame record as above, read back via flat API:", flatView);

// 5. Validation in action — a missing required field is rejected.
try {
  await recordStore.create("diamonds", new Map([[shape.id, "pear"]])); // missing caratWeight
} catch (err) {
  if (err instanceof ValidationError) {
    console.log("\nValidation correctly rejected an invalid record:");
    console.log(err.issues);
  }
}

await client.quit();
await redisServer.stop();
