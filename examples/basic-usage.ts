import { FieldDefinitionStore } from "../src/fieldDefinition.js";
import { FieldValue, RecordStore } from "../src/record.js";
import { ValidationError } from "../src/validation.js";

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
const recordStore = new RecordStore(fieldDefinitions);

const storedDiamond = recordStore.create(
  "diamonds",
  new Map<string, FieldValue>([
    [caratWeight.id, 1.5],
    [shape.id, "round"],
  ]),
);

console.log("\nStored (low-level) record:", storedDiamond);

// 3. Create records using the high-level (FlatRecord) API — keyed by field name.
const flatDiamond = recordStore.createFlat("diamonds", {
  caratWeight: 2.0,
  shape: "oval",
});

console.log("\nFlat record (created via createFlat):", flatDiamond);

// 4. The two APIs are two views of the same data — read the low-level record back flat.
const flatView = recordStore.getFlatById(storedDiamond.id);
console.log("\nSame record as above, read back via flat API:", flatView);

// 5. Validation in action — a missing required field is rejected.
try {
  recordStore.create("diamonds", new Map([[shape.id, "pear"]])); // missing caratWeight
} catch (err) {
  if (err instanceof ValidationError) {
    console.log("\nValidation correctly rejected an invalid record:");
    console.log(err.issues);
  }
}
