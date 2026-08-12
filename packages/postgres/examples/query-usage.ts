import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import os from "os";
import path from "path";
import { RecordStoreFactory } from "driftschema";
import { PostgresFieldDefinitionStore } from "../src/PostgresFieldDefinitionStore.js";
import { createSchema } from "../src/schema.js";
import type { PostgresRecordStoreConfig } from "../src/index.js";
import "../src/index.js"; // registers the "postgres" engine with RecordStoreFactory

// This example spins up an embedded Postgres server so it runs standalone,
// with no real database required. Point a `Pool` at a real Postgres
// connection string instead to use this against an actual deployment.
const pg = new EmbeddedPostgres({
  databaseDir: path.join(os.tmpdir(), `driftschema-example-query-${Date.now()}`),
  port: 54330,
  persistent: false,
  onLog: () => {},
});
await pg.initialise();
await pg.start();
await pg.createDatabase("driftschema_example");

const pool = new Pool({
  port: 54330,
  host: "localhost",
  user: "postgres",
  password: "password",
  database: "driftschema_example",
});
await createSchema(pool);

// 1. Define the schema for an entity type.
const fieldDefinitions = new PostgresFieldDefinitionStore(pool);

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
const config: PostgresRecordStoreConfig = { pool };
const recordStore = await RecordStoreFactory.create("postgres", fieldDefinitions, config);

await recordStore.createFlat("diamonds", { carats: 0.8, color: "G" });
await recordStore.createFlat("diamonds", { carats: 3.1, color: "D" });
const bigOne = await recordStore.createFlat("diamonds", { carats: 5.4, color: "D" });

// 3. query()/queryFlat() accept driftschema's baseline filter DSL — the same
// $eq/$ne/$gt/$gte/$lt/$lte/$in operators the in-memory engine implements.
// Unlike driftschema-mongo, there's no native driver filter object to pass
// straight through for Postgres, so this package translates the same shared
// syntax into a parameterized SQL WHERE clause instead of inventing its own.
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

// 4. "id" is special-cased to the record's uuid primary key, so you can
// combine a key lookup with field filters in the same query.
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

// 6. Pagination: { offset, limit } for page-N navigation, or { after, limit }
// for keyset/cursor pagination (sorted by id — a stable order, unrelated to
// insertion order).
const firstPage = await recordStore.getByEntityType("diamonds", { limit: 2 });
console.log("\nFirst page (limit 2):", firstPage);

const secondPage = await recordStore.getByEntityType("diamonds", {
  after: firstPage[firstPage.length - 1]!.id,
  limit: 2,
});
console.log("\nSecond page (after the first page's last id):", secondPage);

await pool.end();
await pg.stop();
