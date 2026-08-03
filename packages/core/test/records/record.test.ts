import { describe, it, expect } from "vitest";
import { InMemoryFieldDefinitionStore } from "../../src/field-definitions/InMemoryFieldDefinitionStore.js";
import { InMemoryRecordStore } from "../../src/records/InMemoryRecordStore.js";
import { ValidationError } from "../../src/records/validation.js";
import type { FieldValue } from "../../src/types.js";

describe("InMemoryRecordStore", () => {
  it("creates and retrieves a record via the low-level API", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
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
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const store = new InMemoryRecordStore(defs);

    console.log(store);
    console.log(defs);

    const created = await store.createFlat("diamonds", { caratWeight: 2.0 });
    const fetched = await store.getFlatById(created.id);

    expect(fetched?.caratWeight).toBe(2.0);
  });

  it("rejects a record missing a required field", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const store = new InMemoryRecordStore(defs);

    await expect(store.create("diamonds", new Map())).rejects.toThrow(ValidationError);
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
    const store = new InMemoryRecordStore(defs);

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
  });

  it("returns undefined when update targets a missing id", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const store = new InMemoryRecordStore(defs);

    expect(await store.update("missing", new Map())).toBeUndefined();
  });

  it("rejects an update that violates a required field", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    });
    const store = new InMemoryRecordStore(defs);

    const created = await store.create("diamonds", new Map([[carat.id, 1.5]]));

    await expect(
      store.update(created.id, new Map([[carat.id, "not-a-number" as never]])),
    ).rejects.toThrow(ValidationError);
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
    const store = new InMemoryRecordStore(defs);

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
  });

  it("updates and reads back a record via the flat API", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    await defs.add({ entityType: "diamonds", name: "color", type: "string", required: false });
    const store = new InMemoryRecordStore(defs);

    const created = await store.createFlat("diamonds", { caratWeight: 2.0, color: "D" });
    const updated = await store.updateFlat(created.id, { color: "F" });

    expect(updated?.caratWeight).toBe(2.0);
    expect(updated?.color).toBe("F");
  });

  it("queries records with a filter on a field name", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
      entityType: "diamonds",
      name: "carats",
      type: "number",
      required: true,
    });
    const store = new InMemoryRecordStore(defs);

    await store.create("diamonds", new Map([[carat.id, 3]]));
    const big = await store.create("diamonds", new Map([[carat.id, 7]]));

    const results = await store.query("diamonds", { carats: { $gte: 5 } });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(big.id);
  });

  it("queries and flattens records via queryFlat", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    await defs.add({ entityType: "diamonds", name: "carats", type: "number", required: true });
    const store = new InMemoryRecordStore(defs);

    await store.createFlat("diamonds", { carats: 3 });
    await store.createFlat("diamonds", { carats: 7 });

    const results = await store.queryFlat("diamonds", { carats: { $gte: 5 } });

    expect(results).toHaveLength(1);
    expect(results[0]?.carats).toBe(7);
  });

  it("removes a record on delete", async () => {
    const defs = new InMemoryFieldDefinitionStore();
    const carat = await defs.add({
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
