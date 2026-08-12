import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import os from "os";
import path from "path";
import { RecordStoreFactory, ValidationError, type FieldValue } from "driftschema";
import { PostgresFieldDefinitionStore } from "../src/PostgresFieldDefinitionStore.js";
import { createSchema } from "../src/schema.js";
import type { PostgresRecordStoreConfig } from "../src/index.js";
import "../src/index.js"; // registers the "postgres" engine with RecordStoreFactory

// This example spins up an embedded Postgres server so it runs standalone,
// with no real database required. Point a `Pool` at a real Postgres
// connection string instead to use this against an actual deployment.
const pg = new EmbeddedPostgres({
  databaseDir: path.join(os.tmpdir(), `driftschema-example-basic-${Date.now()}`),
  port: 54329,
  persistent: false,
  onLog: () => {},
});
await pg.initialise();
await pg.start();
await pg.createDatabase("driftschema_example");

const pool = new Pool({
  port: 54329,
  host: "localhost",
  user: "postgres",
  password: "password",
  database: "driftschema_example",
});

// 0. The tables driftschema-postgres expects don't exist yet — createSchema()
// is a convenience for quick starts/tests. A real deployment should run this
// DDL (or the equivalent) through its own migration tool instead.
await createSchema(pool);

// 1. Define the schema for an entity type, backed by Postgres.
const fieldDefinitions = new PostgresFieldDefinitionStore(pool);

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

// 2. Get a record store through the engine registry, same as the "memory" and
// "mongo" engines — the only difference is the engine name and the
// Postgres-specific config.
const config: PostgresRecordStoreConfig = { pool };
const recordStore = await RecordStoreFactory.create("postgres", fieldDefinitions, config);

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

await pool.end();
await pg.stop();
