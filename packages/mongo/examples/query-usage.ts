import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { RecordStoreFactory } from "driftschema";
import { MongoFieldDefinitionStore } from "../src/MongoFieldDefinitionStore.js";
import type { MongoRecordStoreConfig } from "../src/index.js";
import "../src/index.js"; // registers the "mongo" engine with RecordStoreFactory

// This example spins up an in-memory MongoDB server so it runs standalone,
// with no real database required. Point `MongoClient.connect` at a real
// MongoDB URI instead to use this against an actual deployment.
const mongoServer = await MongoMemoryServer.create();
const client = await MongoClient.connect(mongoServer.getUri());
const db = client.db("driftschema-example");

// 1. Define the schema for an entity type.
const fieldDefinitions = new MongoFieldDefinitionStore(db.collection("fieldDefinitions"));

await fieldDefinitions.add({
  entityType: "diamonds",
  name: "carats",
  type: "number",
  required: true,
});
await fieldDefinitions.add({
  entityType: "diamonds",
  name: "color",
  type: "string",
  required: true,
});

// 2. Get a record store and seed a few records via the flat API.
const config: MongoRecordStoreConfig = { collection: db.collection("records") };
const recordStore = await RecordStoreFactory.create("mongo", fieldDefinitions, config);

await recordStore.createFlat("diamonds", { carats: 0.8, color: "G" });
await recordStore.createFlat("diamonds", { carats: 3.1, color: "D" });
const bigOne = await recordStore.createFlat("diamonds", { carats: 5.4, color: "D" });

// 3. query()/queryFlat() take a native Mongo-style filter keyed by field
// name — the same operators ($gte, $in, $and, ...) you'd already use
// against any other Mongo collection. driftschema translates the field
// name to its internal field id and runs the filter as-is; it does not
// invent its own query syntax.
const largeStones = await recordStore.queryFlat("diamonds", { carats: { $gte: 3 } });
console.log("\nDiamonds >= 3 carats:", largeStones);

const largeAndColorless = await recordStore.query("diamonds", {
  carats: { $gte: 3 },
  color: "D",
});
console.log(
  "\nDiamonds >= 3 carats AND color D (low-level, keyed by internal field id):",
  largeAndColorless,
);

// 4. "id" is special-cased to Mongo's _id, so you can combine a key lookup
// with field filters in the same query.
const byIdAndCarats = await recordStore.query("diamonds", {
  id: bigOne.id,
  carats: { $gte: 5 },
});
console.log("\nSpecific record, filtered by id + carats:", byIdAndCarats);

// 5. Filtering on a field with no matching FieldDefinition is rejected
// outright rather than silently ignored — a typo'd field name would
// otherwise widen the query instead of erroring.
try {
  await recordStore.query("diamonds", { claritty: "VS1" });
} catch (err) {
  console.log("\nUnknown field correctly rejected:", (err as Error).message);
}

await client.close();
await mongoServer.stop();
