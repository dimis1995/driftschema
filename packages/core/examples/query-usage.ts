import { InMemoryFieldDefinitionStore } from "../src/field-definitions/InMemoryFieldDefinitionStore.js";
import { RecordStoreFactory } from "../src/records/RecordStoreFactory.js";

// 1. Define the schema for an entity type.
const fieldDefinitions = new InMemoryFieldDefinitionStore();

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
const recordStore = await RecordStoreFactory.create("memory", fieldDefinitions);

await recordStore.createFlat("diamonds", { carats: 0.8, color: "G" });
await recordStore.createFlat("diamonds", { carats: 3.1, color: "D" });
const bigOne = await recordStore.createFlat("diamonds", { carats: 5.4, color: "D" });

// 3. query()/queryFlat() take a filter keyed by field name. InMemoryRecordStore
// interprets driftschema's baseline operator set ($eq/$ne/$gt/$gte/$lt/$lte/$in) —
// note this is InMemoryRecordStore's own implementation choice, not a
// universal contract: a Mongo-backed store accepts whatever Mongo supports,
// which is a superset of this.
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

// 4. $in matches against a set of values.
const graded = await recordStore.queryFlat("diamonds", { color: { $in: ["D", "E"] } });
console.log("\nDiamonds graded D or E:", graded);

// 5. "id" is special-cased, so a specific record can be combined with field filters.
const byIdAndCarats = await recordStore.query("diamonds", {
  id: bigOne.id,
  carats: { $gte: 5 },
});
console.log("\nSpecific record, filtered by id + carats:", byIdAndCarats);

// 6. Filtering on a field with no matching FieldDefinition is rejected
// outright rather than silently ignored — a typo'd field name would
// otherwise widen the query instead of erroring.
try {
  await recordStore.query("diamonds", { claritty: "VS1" });
} catch (err) {
  console.log("\nUnknown field correctly rejected:", (err as Error).message);
}

// 7. Same for unsupported operators — InMemoryRecordStore only understands
// its baseline set, so anything else (e.g. Mongo's $regex) throws rather
// than silently matching nothing.
try {
  await recordStore.query("diamonds", { color: { $regex: "^D" } });
} catch (err) {
  console.log("\nUnsupported operator correctly rejected:", (err as Error).message);
}
