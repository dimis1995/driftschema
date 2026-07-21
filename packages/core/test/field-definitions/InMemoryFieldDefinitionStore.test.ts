import { describe, it, expect } from "vitest";
import { InMemoryFieldDefinitionStore } from "../../src/field-definitions/InMemoryFieldDefinitionStore.js";

describe("InMemoryFieldDefinitionStore", () => {
  it("adds a field definition and retrieves it by entity type", () => {
    const store = new InMemoryFieldDefinitionStore();
    store.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const fields = store.getByEntityType("diamonds");
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe("caratWeight");
  });

  it("assigns a unique id to each added definition", () => {
    const store = new InMemoryFieldDefinitionStore();
    const a = store.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const b = store.add({ entityType: "diamonds", name: "color", type: "string", required: false });
    expect(a.id).not.toBe(b.id);
  });

  it("only returns definitions matching the requested entity type", () => {
    const store = new InMemoryFieldDefinitionStore();
    store.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    store.add({ entityType: "rings", name: "size", type: "number", required: true });

    expect(store.getByEntityType("rings")).toHaveLength(1);
    expect(store.getByEntityType("rings")[0].name).toBe("size");
  });

  it("returns an empty array for an entity type with no definitions", () => {
    const store = new InMemoryFieldDefinitionStore();
    expect(store.getByEntityType("unknown")).toEqual([]);
  });
});
