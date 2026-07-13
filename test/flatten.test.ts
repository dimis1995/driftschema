import { describe, it, expect } from "vitest";
import { toFlatRecord, fromFlatRecord } from "../src/records/flatten.js";
import { FieldDefinition } from "../src/field-definitions/FieldDefinition.js";
import { FieldValue, FlatRecord, StoredRecord } from "../src/types.js";

const caratDef: FieldDefinition = {
  id: "field-carat",
  entityType: "diamonds",
  name: "caratWeight",
  type: "number",
  required: true,
};

const colorDef: FieldDefinition = {
  id: "field-color",
  entityType: "diamonds",
  name: "color",
  type: "string",
  required: false,
};

describe("toFlatRecord", () => {
  it("flattens a stored record's fields to their definition names", () => {
    const stored: StoredRecord = {
      id: "rec-1",
      entityType: "diamonds",
      fields: new Map<string, FieldValue>([
        ["field-carat", 1.5],
        ["field-color", "D"],
      ]),
    };

    const flat = toFlatRecord(stored, [caratDef, colorDef]);

    expect(flat).toEqual({
      id: "rec-1",
      entityType: "diamonds",
      caratWeight: 1.5,
      color: "D",
    });
  });

  it("skips fields with no matching definition", () => {
    const stored: StoredRecord = {
      id: "rec-1",
      entityType: "diamonds",
      fields: new Map([["orphaned-field", "value"]]),
    };

    const flat = toFlatRecord(stored, []);

    expect(flat).toEqual({ id: "rec-1", entityType: "diamonds" });
  });

  it("throws when a field name collides with a reserved system key", () => {
    const badDef: FieldDefinition = { ...caratDef, id: "field-id", name: "id" };
    const stored: StoredRecord = {
      id: "rec-1",
      entityType: "diamonds",
      fields: new Map([["field-id", 1]]),
    };

    expect(() => toFlatRecord(stored, [badDef])).toThrow(
      /Field name "id" collides with a reserved system key/,
    );
  });
});

describe("fromFlatRecord", () => {
  it("converts field names to field ids using the definitions", () => {
    const flat: FlatRecord = {
      id: "rec-1",
      entityType: "diamonds",
      caratWeight: 1.5,
      color: "D",
    };

    const stored = fromFlatRecord(flat, [caratDef, colorDef]);

    expect(stored.id).toBe("rec-1");
    expect(stored.entityType).toBe("diamonds");
    expect(stored.fields.get("field-carat")).toBe(1.5);
    expect(stored.fields.get("field-color")).toBe("D");
  });

  it("throws for a flat key with no matching field definition", () => {
    const flat: FlatRecord = { id: "rec-1", entityType: "diamonds", unknownField: "x" };
    expect(() => fromFlatRecord(flat, [])).toThrow(/Unknown field "unknownField"/);
  });

  it("round-trips through fromFlatRecord and toFlatRecord", () => {
    const flat: FlatRecord = {
      id: "rec-1",
      entityType: "diamonds",
      caratWeight: 1.5,
      color: "D",
    };

    const stored = fromFlatRecord(flat, [caratDef, colorDef]);
    const roundTripped = toFlatRecord(stored, [caratDef, colorDef]);

    expect(roundTripped).toEqual(flat);
  });
});
