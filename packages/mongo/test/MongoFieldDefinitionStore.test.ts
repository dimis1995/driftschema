import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId, type Collection } from "mongodb";
import { MongoFieldDefinitionStore } from "../src/MongoFieldDefinitionStore.js";

describe("MongoFieldDefinitionStore", () => {
  let mongoServer: MongoMemoryServer;
  let client: MongoClient;
  let collection: Collection<any>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    client = await MongoClient.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    collection = client.db("test").collection("fieldDefinitions");
    await collection.deleteMany({});
  });

  it("adds a field definition and retrieves it by entity type", async () => {
    const store = new MongoFieldDefinitionStore(collection);

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
    const store = new MongoFieldDefinitionStore(collection);
    await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    await store.add({ entityType: "rings", name: "size", type: "number", required: true });

    const defs = await store.getByEntityType("diamonds");

    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe("caratWeight");
  });

  it("round-trips enum values and number formats", async () => {
    const store = new MongoFieldDefinitionStore(collection);

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
    const store = new MongoFieldDefinitionStore(collection);
    await store.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    await store.add({ entityType: "rings", name: "size", type: "number", required: true });

    const defs = await store.getAll();
    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.name).sort()).toEqual(["caratWeight", "size"]);
  });

  it("upsert inserts a definition under the given id when it doesn't exist yet", async () => {
    const store = new MongoFieldDefinitionStore(collection);
    const def = {
      id: new ObjectId().toString(),
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
    const store = new MongoFieldDefinitionStore(collection);
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
    const store = new MongoFieldDefinitionStore(collection);
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
