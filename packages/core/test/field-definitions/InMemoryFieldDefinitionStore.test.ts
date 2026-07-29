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
});
