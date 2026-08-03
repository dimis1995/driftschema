import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Collection } from "mongodb";
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
