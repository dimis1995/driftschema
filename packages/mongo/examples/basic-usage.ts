import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { RecordStoreFactory, ValidationError, type FieldValue } from "driftschema";
import { MongoFieldDefinitionStore } from "../src/MongoFieldDefinitionStore.js";
import type { MongoRecordStoreConfig } from "../src/index.js";
import "../src/index.js"; // registers the "mongo" engine with RecordStoreFactory

// This example spins up an in-memory MongoDB server so it runs standalone,
// with no real database required. Point `MongoClient.connect` at a real
// MongoDB URI instead to use this against an actual deployment.
const mongoServer = await MongoMemoryServer.create();
const client = await MongoClient.connect(mongoServer.getUri());
const db = client.db("driftschema-example");

// 1. Define the schema for an entity type, backed by a Mongo collection.
const fieldDefinitions = new MongoFieldDefinitionStore(db.collection("fieldDefinitions"));

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

// 2. Get a record store through the engine registry, same as the "memory" engine —
// the only difference is the engine name and the Mongo-specific config.
const config: MongoRecordStoreConfig = { collection: db.collection("records") };
const recordStore = await RecordStoreFactory.create("mongo", fieldDefinitions, config);

// 3. Create records using the low-level (StoredRecord) API — keyed by field id.
const storedDiamond = await recordStore.create(
  "diamonds",
  new Map<string, FieldValue>([
    [caratWeight.id, 1.5],
    [shape.id, "round"],
  ]),
);

console.log("\nStored (low-level) record:", storedDiamond);

// 4. Create records using the high-level (FlatRecord) API — keyed by field name.
const flatDiamond = await recordStore.createFlat("diamonds", {
  caratWeight: 2.0,
  shape: "oval",
});

console.log("\nFlat record (created via createFlat):", flatDiamond);

// 5. The two APIs are two views of the same data — read the low-level record back flat.
const flatView = await recordStore.getFlatById(storedDiamond.id);
console.log("\nSame record as above, read back via flat API:", flatView);

// 6. Validation in action — a missing required field is rejected.
try {
  await recordStore.create("diamonds", new Map([[shape.id, "pear"]])); // missing caratWeight
} catch (err) {
  if (err instanceof ValidationError) {
    console.log("\nValidation correctly rejected an invalid record:");
    console.log(err.issues);
  }
}

await client.close();
await mongoServer.stop();
