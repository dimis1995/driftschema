import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import os from "os";
import path from "path";
import { InMemoryFieldDefinitionStore, type FieldValue } from "driftschema";
import { PostgresRecordStore } from "../src/PostgresRecordStore.js";
import { createSchema } from "../src/schema.js";

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

describe("PostgresRecordStore", () => {
  let pg: EmbeddedPostgres;
  let pool: Pool;

  beforeAll(async () => {
    pg = new EmbeddedPostgres({
      databaseDir: path.join(os.tmpdir(), `driftschema-pg-recordstore-${Date.now()}`),
      port: 55433,
      persistent: false,
      onLog: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("driftschema_test");
    pool = new Pool({
      port: 55433,
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

  it("creates and retrieves a record via the low-level API", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new PostgresRecordStore(defs, pool);

    const created = await store.create("diamonds", new Map([[carat.id, 1.5]]));
    const fetched = await store.getById(created.id);

    expect(fetched?.fields.get(carat.id)).toBe(1.5);
  });

  it("creates and retrieves a record via the flat API", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const store = new PostgresRecordStore(defs, pool);

    const created = await store.createFlat("diamonds", { caratWeight: 2.0 });
    const fetched = await store.getFlatById(created.id);

    expect(fetched?.caratWeight).toBe(2.0);
  });

  it("queries records with a $gte filter on a field name", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "carats",
      type: "number",
      required: true,
    });
    const store = new PostgresRecordStore(defs, pool);

    await store.create("diamonds", new Map([[carat.id, 3]]));
    const big = await store.create("diamonds", new Map([[carat.id, 7]]));

    const results = await store.query("diamonds", { carats: { $gte: 5 } });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(big.id);
  });

  it("queries and flattens records via queryFlat", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "carats", type: "number", required: true });
    const store = new PostgresRecordStore(defs, pool);

    await store.createFlat("diamonds", { carats: 3 });
    await store.createFlat("diamonds", { carats: 7 });

    const results = await store.queryFlat("diamonds", { carats: { $gte: 5 } });

    expect(results).toHaveLength(1);
    expect(results[0]?.carats).toBe(7);
  });

  it("rejects a query that filters on an undefined field", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "carats", type: "number", required: true });
    const store = new PostgresRecordStore(defs, pool);

    await expect(store.query("diamonds", { clarity: "VS1" })).rejects.toThrow(
      /Unknown field "clarity"/,
    );
  });

  it("filters on a date field with $gte end-to-end", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const certifiedAt = await defs.add({
      entityType: "diamonds",
      name: "certifiedAt",
      type: "date",
      required: true,
    });
    const store = new PostgresRecordStore(defs, pool);

    await store.create("diamonds", new Map([[certifiedAt.id, new Date("2020-01-01T00:00:00Z")]]));
    const recent = await store.create(
      "diamonds",
      new Map([[certifiedAt.id, new Date("2024-06-01T00:00:00Z")]]),
    );

    const results = await store.query("diamonds", {
      certifiedAt: { $gte: new Date("2023-01-01T00:00:00Z") },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(recent.id);
    expect(results[0]?.fields.get(certifiedAt.id)).toBeInstanceOf(Date);
  });

  it("$ne on a field left unset on some records still returns those records", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const color = await defs.add({
      entityType: "diamonds",
      name: "color",
      type: "string",
      required: false,
    });
    const store = new PostgresRecordStore(defs, pool);

    const withoutColor = await store.create("diamonds", new Map());
    await store.create("diamonds", new Map([[color.id, "D"]]));

    const results = await store.query("diamonds", { color: { $ne: "D" } });

    expect(results.map((r) => r.id)).toEqual([withoutColor.id]);
  });

  it("partially updates a record via update", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const color = await defs.add({
      entityType: "diamonds",
      name: "color",
      type: "string",
      required: false,
    });
    const store = new PostgresRecordStore(defs, pool);

    const created = await store.create(
      "diamonds",
      new Map<string, FieldValue>([
        [carat.id, 1.5],
        [color.id, "D"],
      ]),
    );
    const updated = await store.update(created.id, new Map([[color.id, "E"]]));

    expect(updated?.fields.get(carat.id)).toBe(1.5);
    expect(updated?.fields.get(color.id)).toBe("E");

    const fetched = await store.getById(created.id);
    expect(fetched?.fields.get(color.id)).toBe("E");
  });

  it("sequential updates to two different fields on the same record both survive", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: false,
    });
    const color = await defs.add({
      entityType: "diamonds",
      name: "color",
      type: "string",
      required: false,
    });
    const store = new PostgresRecordStore(defs, pool);

    const created = await store.create("diamonds", new Map());

    await store.update(created.id, new Map([[carat.id, 2.0]]));
    await store.update(created.id, new Map([[color.id, "F"]]));

    const fetched = await store.getById(created.id);
    expect(fetched?.fields.get(carat.id)).toBe(2.0);
    expect(fetched?.fields.get(color.id)).toBe("F");
  });

  it("returns undefined when update targets a missing id", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const store = new PostgresRecordStore(defs, pool);

    expect(await store.update(MISSING_ID, new Map())).toBeUndefined();
  });

  it("fully replaces a record via replace, dropping fields not included", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: false,
    });
    const color = await defs.add({
      entityType: "diamonds",
      name: "color",
      type: "string",
      required: false,
    });
    const store = new PostgresRecordStore(defs, pool);

    const created = await store.create(
      "diamonds",
      new Map<string, FieldValue>([
        [carat.id, 1.5],
        [color.id, "D"],
      ]),
    );
    const replaced = await store.replace(created.id, new Map([[color.id, "E"]]));

    expect(replaced?.fields.has(carat.id)).toBe(false);
    expect(replaced?.fields.get(color.id)).toBe("E");

    const fetched = await store.getById(created.id);
    expect(fetched?.fields.has(carat.id)).toBe(false);
  });

  it("updates and reads back a record via the flat API", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    await defs.add({ entityType: "diamonds", name: "color", type: "string", required: false });
    const store = new PostgresRecordStore(defs, pool);

    const created = await store.createFlat("diamonds", { caratWeight: 2.0, color: "D" });
    const updated = await store.updateFlat(created.id, { color: "F" });

    expect(updated?.caratWeight).toBe(2.0);
    expect(updated?.color).toBe("F");
  });

  it("deletes a record", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new PostgresRecordStore(defs, pool);

    const created = await store.create("diamonds", new Map([[carat.id, 1.0]]));
    await store.delete(created.id);

    expect(await store.getById(created.id)).toBeUndefined();
  });

  it("paginates getByEntityType with offset and limit", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new PostgresRecordStore(defs, pool);

    for (let i = 0; i < 5; i++) {
      await store.create("diamonds", new Map([[carat.id, i]]));
    }

    const page = await store.getByEntityType("diamonds", { offset: 2, limit: 2 });

    expect(page).toHaveLength(2);
  });

  it("paginates query results after filtering", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "carats",
      type: "number",
      required: true,
    });
    const store = new PostgresRecordStore(defs, pool);

    for (let i = 0; i < 5; i++) {
      await store.create("diamonds", new Map([[carat.id, i]]));
    }

    const page = await store.query("diamonds", { carats: { $gte: 1 } }, { offset: 1, limit: 2 });

    expect(page).toHaveLength(2);
  });

  it("rejects pagination options that aren't a plain object", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const store = new PostgresRecordStore(defs, pool);

    await expect(store.getByEntityType("diamonds", "page 2")).rejects.toThrow(
      /Pagination options must be a plain object/,
    );
  });

  it("paginates with a keyset (after) cursor across two disjoint pages", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new PostgresRecordStore(defs, pool);

    for (let i = 0; i < 5; i++) {
      await store.create("diamonds", new Map([[carat.id, i]]));
    }

    const page1 = await store.getByEntityType("diamonds", { limit: 2 });
    const page2 = await store.getByEntityType("diamonds", {
      after: page1[page1.length - 1]!.id,
      limit: 2,
    });

    expect(page1).toHaveLength(2);
    expect(page2).toHaveLength(2);
    const page1Ids = new Set(page1.map((r) => r.id));
    for (const record of page2) {
      expect(page1Ids.has(record.id)).toBe(false);
    }
  });

  it("rejects pagination options combining after and offset", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const store = new PostgresRecordStore(defs, pool);

    await expect(
      store.getByEntityType("diamonds", { after: MISSING_ID, offset: 1 }),
    ).rejects.toThrow(/cannot specify both "after" and "offset"/);
  });

  it("rejects a malformed after cursor", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const store = new PostgresRecordStore(defs, pool);

    await expect(store.getByEntityType("diamonds", { after: "not-a-uuid" })).rejects.toThrow(
      /not a valid UUID/,
    );
  });
});
