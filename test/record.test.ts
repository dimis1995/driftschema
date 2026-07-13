import { describe, it, expect } from "vitest";
import { FieldDefinitionStore } from "../src/field-definitions/FieldDefinitionStore.js";
import { InMemoryRecordStore } from "../src/records/InMemoryRecordStore.js";
import { ValidationError } from "../src/records/validation.js";

describe("InMemoryRecordStore", () => {
  it("creates and retrieves a record via the low-level API", async () => {
    const defs = new FieldDefinitionStore();
    const carat = defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new InMemoryRecordStore(defs);

    const created = await store.create("diamonds", new Map([[carat.id, 1.5]]));
    const fetched = await store.getById(created.id);

    expect(fetched?.fields.get(carat.id)).toBe(1.5);
  });

  it("creates and retrieves a record via the flat API", async () => {
    const defs = new FieldDefinitionStore();
    defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const store = new InMemoryRecordStore(defs);

    const created = await store.createFlat("diamonds", { caratWeight: 2.0 });
    const fetched = await store.getFlatById(created.id);

    expect(fetched?.caratWeight).toBe(2.0);
  });

  it("rejects a record missing a required field", async () => {
    const defs = new FieldDefinitionStore();
    defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const store = new InMemoryRecordStore(defs);

    await expect(store.create("diamonds", new Map())).rejects.toThrow(ValidationError);
  });

  it("removes a record on delete", async () => {
    const defs = new FieldDefinitionStore();
    const carat = defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new InMemoryRecordStore(defs);

    const created = await store.create("diamonds", new Map([[carat.id, 1.5]]));
    await store.delete(created.id);

    expect(await store.getById(created.id)).toBeUndefined();
  });
});
