import { FieldDefinitionStore } from "../src/field-definitions/FieldDefinitionStore.js";
import { FieldValue } from "../src/types.js";
import { RecordStoreFactory } from "../src/records/RecordStoreFactory.js";
import { InMemoryRecordStore } from "../src/records/InMemoryRecordStore.js";
import { ValidationError } from "../src/records/validation.js";

// 1. Define the schema for an entity type — this replaces a fixed DB schema.
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

console.log("Registered fields:", fieldDefinitions.getByEntityType("diamonds"));

// 2. Create records using the low-level (StoredRecord) API — keyed by field id.
const recordStore = await RecordStoreFactory.create("memory", fieldDefinitions);

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
