import { describe, it, expect } from "vitest";
import { InMemoryFieldDefinitionStore } from "../../src/field-definitions/InMemoryFieldDefinitionStore.js";

describe("InMemoryFieldDefinitionStore", () => {
  it("adds a field definition and retrieves it by entity type", async () => {
    const store = new InMemoryFieldDefinitionStore();
    await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const fields = await store.getByEntityType("diamonds");
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe("caratWeight");
  });

  it("assigns a unique id to each added definition", async () => {
    const store = new InMemoryFieldDefinitionStore();
    const a = await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const b = await store.add({
      entityType: "diamonds",
      name: "color",
      type: "string",
      required: false,
    });
    expect(a.id).not.toBe(b.id);
  });

  it("only returns definitions matching the requested entity type", async () => {
    const store = new InMemoryFieldDefinitionStore();
    await store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    await store.add({ entityType: "rings", name: "size", type: "number", required: true });

    expect(await store.getByEntityType("rings")).toHaveLength(1);
    expect((await store.getByEntityType("rings"))[0].name).toBe("size");
  });

  it("returns an empty array for an entity type with no definitions", async () => {
    const store = new InMemoryFieldDefinitionStore();
    expect(await store.getByEntityType("unknown")).toEqual([]);
  });

  it("returns every definition across entity types via getAll", async () => {
    const store = new InMemoryFieldDefinitionStore();
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
    const store = new InMemoryFieldDefinitionStore();
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
  });

  it("upsert replaces the existing definition with the same id", async () => {
    const store = new InMemoryFieldDefinitionStore();
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

  it("deletes an existing field based on the given id", async () => {
    const store = new InMemoryFieldDefinitionStore();
    expect(
      await store.add({
        entityType: "diamonds",
        name: "caratWeight",
        type: "number",
        required: false,
      }),
    );
    const defs = await store.getByEntityType("diamonds");
    expect(defs.length).toEqual(1);
    await store.delete(defs[0].id);
    expect(await store.getByEntityType("diamonds")).toEqual([]);
  });
});
