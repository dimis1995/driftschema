import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Collection } from "mongodb";
import { InMemoryFieldDefinitionStore } from "driftschema";
import { MongoRecordStore } from "../src/MongoRecordStore.js";
import type { MongoRecordDocument } from "../src/types.js";

describe("MongoRecordStore", () => {
  let mongoServer: MongoMemoryServer;
  let client: MongoClient;
  let collection: Collection<MongoRecordDocument>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    collection = client.db("test").collection<MongoRecordDocument>("records");
    await collection.deleteMany({});
  });

  it("creates and retrieves a record via the low-level API", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new MongoRecordStore(defs, collection);

    const created = await store.create("diamonds", new Map([[carat.id, 1.5]]));
    const fetched = await store.getById(created.id);

    expect(fetched?.fields.get(carat.id)).toBe(1.5);
  });

  it("creates and retrieves a record via the flat API", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const store = new MongoRecordStore(defs, collection);

    const created = await store.createFlat("diamonds", { caratWeight: 2.0 });
    const fetched = await store.getFlatById(created.id);

    expect(fetched?.caratWeight).toBe(2.0);
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
    const store = new MongoRecordStore(defs, collection);

    const created = await store.create(
      "diamonds",
      new Map([
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

  it("returns undefined when update targets a missing id", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const store = new MongoRecordStore(defs, collection);

    expect(await store.update("507f1f77bcf86cd799439011", new Map())).toBeUndefined();
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
    const store = new MongoRecordStore(defs, collection);

    const created = await store.create(
      "diamonds",
      new Map([
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
    const store = new MongoRecordStore(defs, collection);

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
    const store = new MongoRecordStore(defs, collection);

    const created = await store.create("diamonds", new Map([[carat.id, 1.0]]));
    await store.delete(created.id);

    expect(await store.getById(created.id)).toBeUndefined();
  });
});
