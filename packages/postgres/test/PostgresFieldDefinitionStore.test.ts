import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import os from "os";
import path from "path";
import { PostgresFieldDefinitionStore } from "../src/PostgresFieldDefinitionStore.js";
import { createSchema } from "../src/schema.js";

describe("PostgresFieldDefinitionStore", () => {
  let pg: EmbeddedPostgres;
  let pool: Pool;

  beforeAll(async () => {
    pg = new EmbeddedPostgres({
      databaseDir: path.join(os.tmpdir(), `driftschema-pg-fielddefs-${Date.now()}`),
      port: 55434,
      persistent: false,
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("driftschema_test");
    pool = new Pool({
      port: 55434,
      host: "localhost",
      user: "postgres",
      password: "password",
      database: "driftschema_test",
    });
    await createSchema(pool);
  }, 120_000);

  afterAll(async () => {
    await pool.end();
    await pg.stop();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE records, field_definitions");
  });

  it("adds a field definition and retrieves it by entity type", async () => {
    const store = new PostgresFieldDefinitionStore(pool);

    const carat = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });

    const defs = await store.getByEntityType("diamonds");

    expect(defs).toEqual([carat]);
  });

  it("only returns definitions matching the given entity type", async () => {
    const store = new PostgresFieldDefinitionStore(pool);
    await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    await store.add({ entityType: "rings", name: "size", type: "number", required: true });

    const defs = await store.getByEntityType("diamonds");

    expect(defs).toHaveLength(1);
    expect(defs[0]?.name).toBe("caratWeight");
  });

  it("round-trips enum values and number formats", async () => {
    const store = new PostgresFieldDefinitionStore(pool);

    const color = await store.add({
      entityType: "diamonds",
      name: "color",
      type: "enum",
      values: ["D", "E", "F"],
      required: true,
    });
    const carat = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      format: "float",
      required: true,
    });

    const defs = await store.getByEntityType("diamonds");

    expect(defs).toEqual(expect.arrayContaining([color, carat]));
  });

  it("returns every definition across entity types via getAll", async () => {
    const store = new PostgresFieldDefinitionStore(pool);
    await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    await store.add({ entityType: "rings", name: "size", type: "number", required: true });

    const defs = await store.getAll();
    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.name).sort()).toEqual(["caratWeight", "size"]);
  });

  it("upsert inserts a definition under the given id when it doesn't exist yet", async () => {
    const store = new PostgresFieldDefinitionStore(pool);
    const def = {
      id: crypto.randomUUID(),
      entityType: "diamonds",
      name: "caratWeight",
      type: "number" as const,
      required: true,
    };

    const result = await store.upsert(def);

    expect(result).toEqual(def);
    expect(await store.getByEntityType("diamonds")).toEqual([def]);
  });

  it("upsert replaces the existing definition with the same id", async () => {
    const store = new PostgresFieldDefinitionStore(pool);
    const original = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });

    const updated = { ...original, required: false };
    await store.upsert(updated);

    const defs = await store.getByEntityType("diamonds");
    expect(defs).toEqual([updated]);
  });

  it("deletes a field definition", async () => {
    const store = new PostgresFieldDefinitionStore(pool);
    const carat = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });

    await store.delete(carat.id);

    const defs = await store.getByEntityType("diamonds");
    expect(defs).toEqual([]);
  });
});
