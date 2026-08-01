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
