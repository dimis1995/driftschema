import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { RedisMemoryServer } from "redis-memory-server";
import { createClient, type RedisClientType } from "redis";
import { RedisFieldDefinitionStore } from "../src/RedisFieldDefinitionStore.js";

describe("RedisFieldDefinitionStore", () => {
  let redisServer: RedisMemoryServer;
  let client: RedisClientType;

  beforeAll(async () => {
    redisServer = await RedisMemoryServer.create();
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    client = createClient({ url: `redis://${host}:${port}` });
    await client.connect();
  });

  afterAll(async () => {
    await client.quit();
    await redisServer.stop();
  });

  beforeEach(async () => {
    await client.flushAll();
  });

  it("adds a field definition and retrieves it by entity type", async () => {
    const store = new RedisFieldDefinitionStore(client);

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
    const store = new RedisFieldDefinitionStore(client);
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
    const store = new RedisFieldDefinitionStore(client);

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
      format: "int32",
      required: true,
    });

    const defs = await store.getByEntityType("diamonds");

    expect(defs).toEqual(expect.arrayContaining([color, carat]));
  });

  it("returns every definition across entity types via getAll", async () => {
    const store = new RedisFieldDefinitionStore(client);
    await store.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    await store.add({ entityType: "rings", name: "size", type: "number", required: true });

    const defs = await store.getAll();
    expect(defs).toHaveLength(2);
    expect(defs.map((d) => d.name).sort()).toEqual(["caratWeight", "size"]);
  });

  it("upsert inserts a definition under the given id when it doesn't exist yet", async () => {
    const store = new RedisFieldDefinitionStore(client);
    const def = {
      id: "fixed-id",
      entityType: "diamonds",
      name: "caratWeight",
      type: "number" as const,
      required: true,
    };

    const result = await store.upsert(def);

    expect(result).toEqual(def);
    expect(await store.getByEntityType("diamonds")).toEqual([def]);
    expect(await store.getAll()).toEqual([def]);
  });

  it("upsert replaces the existing definition with the same id", async () => {
    const store = new RedisFieldDefinitionStore(client);
    const original = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });

    const updated = { ...original, required: false };
    await store.upsert(updated);

    expect(await store.getByEntityType("diamonds")).toEqual([updated]);
  });

  it("upsert moves the definition to the new entity type's index when it changes", async () => {
    const store = new RedisFieldDefinitionStore(client);
    const original = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });

    const moved = { ...original, entityType: "rings" };
    await store.upsert(moved);

    expect(await store.getByEntityType("diamonds")).toEqual([]);
    expect(await store.getByEntityType("rings")).toEqual([moved]);
    expect(await store.getAll()).toEqual([moved]);
  });

  it("getAll no longer includes a definition after it's deleted", async () => {
    const store = new RedisFieldDefinitionStore(client);
    const carat = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });

    await store.delete(carat.id);

    expect(await store.getAll()).toEqual([]);
  });

  it("deletes a field definition", async () => {
    const store = new RedisFieldDefinitionStore(client);
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

  it("does nothing when deleting an id that doesn't exist", async () => {
    const store = new RedisFieldDefinitionStore(client);

    await expect(store.delete("nonexistent-id")).resolves.toBeUndefined();
  });
});
