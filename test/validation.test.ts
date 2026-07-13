import { describe, it, expect } from "vitest";
import { validateFields, ValidationError } from "../src/records/validation.js";
import { FieldDefinition } from "../src/field-definitions/FieldDefinitionStore.js";

function def(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: "field-1",
    entityType: "diamonds",
    name: "caratWeight",
    type: "number",
    required: true,
    ...overrides,
  };
}

describe("validateFields", () => {
  it("passes when all required fields are present with the correct type", () => {
    const fields = new Map([["field-1", 1.2]]);
    expect(() => validateFields(fields, [def()])).not.toThrow();
  });

  it("throws when a required field is missing", () => {
    const fields = new Map();
    expect(() => validateFields(fields, [def()])).toThrow(ValidationError);
    expect(() => validateFields(fields, [def()])).toThrow(/caratWeight is missing/);
  });

  it("treats an explicit null as missing", () => {
    const fields = new Map([["field-1", null]]);
    expect(() => validateFields(fields, [def()])).toThrow(/caratWeight is missing/);
  });

  it("allows an optional field to be missing", () => {
    const fields = new Map();
    expect(() => validateFields(fields, [def({ required: false })])).not.toThrow();
  });

  it("throws when a field has the wrong type", () => {
    const fields = new Map([["field-1", "not-a-number"]]);
    expect(() => validateFields(fields, [def()])).toThrow(
      /caratWeight invalid type: expected number, got string/,
    );
  });

  it("validates date fields using instanceof Date", () => {
    const dateDef = def({ id: "field-2", name: "certifiedAt", type: "date" });
    expect(() => validateFields(new Map([["field-2", new Date()]]), [dateDef])).not.toThrow();
    expect(() => validateFields(new Map([["field-2", "2024-01-01"]]), [dateDef])).toThrow(
      /certifiedAt invalid type: expected date, got string/,
    );
  });

  it("throws for a field id with no matching definition", () => {
    const fields = new Map([["ghost-field", "x"]]);
    expect(() => validateFields(fields, [])).toThrow(/Unknown field id "ghost-field"/);
  });

  it("collects multiple issues into a single ValidationError", () => {
    const fields = new Map([["ghost-field", "x"]]);
    try {
      validateFields(fields, [def()]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const validationError = err as ValidationError;
      expect(validationError.issues).toEqual([
        "caratWeight is missing",
        'Unknown field id "ghost-field" — no matching active field definition',
      ]);
    }
  });
});
