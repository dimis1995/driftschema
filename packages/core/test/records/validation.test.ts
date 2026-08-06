import { describe, it, expect } from "vitest";
import { validateFields, ValidationError } from "../../src/records/validation.js";
import { FieldDefinition } from "../../src/field-definitions/FieldDefinition.js";

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

  describe("enum fields", () => {
    const colorDef = def({ id: "field-3", name: "color", type: "enum", values: ["D", "E", "F"] });

    it("passes when the value is one of the allowed values", () => {
      expect(() => validateFields(new Map([["field-3", "E"]]), [colorDef])).not.toThrow();
    });

    it("throws when the value is not one of the allowed values", () => {
      expect(() => validateFields(new Map([["field-3", "Z"]]), [colorDef])).toThrow(
        /color invalid value: expected one of \[D, E, F\], got "Z"/,
      );
    });

    it("throws a type error when the value isn't a string at all", () => {
      expect(() => validateFields(new Map([["field-3", 1]]), [colorDef])).toThrow(
        /color invalid type: expected enum, got number/,
      );
    });
  });

  describe("number formats", () => {
    it("accepts a plain number when no format is set", () => {
      expect(() => validateFields(new Map([["field-1", 1.5]]), [def()])).not.toThrow();
    });

    it("accepts an integer for format int32 within range", () => {
      const int32Def = def({ format: "int32" });
      expect(() => validateFields(new Map([["field-1", 42]]), [int32Def])).not.toThrow();
    });

    it("rejects a non-integer for format int32", () => {
      const int32Def = def({ format: "int32" });
      expect(() => validateFields(new Map([["field-1", 1.5]]), [int32Def])).toThrow(
        /caratWeight invalid type: expected int32, got number/,
      );
    });

    it("rejects an integer outside the int32 range", () => {
      const int32Def = def({ format: "int32" });
      expect(() => validateFields(new Map([["field-1", 2147483648]]), [int32Def])).toThrow(
        /caratWeight invalid type: expected int32/,
      );
    });

    it("accepts a safe integer for format int64", () => {
      const int64Def = def({ format: "int64" });
      expect(() =>
        validateFields(new Map([["field-1", Number.MAX_SAFE_INTEGER]]), [int64Def]),
      ).not.toThrow();
    });

    it("rejects an integer beyond safe precision for format int64", () => {
      const int64Def = def({ format: "int64" });
      expect(() =>
        validateFields(new Map([["field-1", Number.MAX_SAFE_INTEGER + 2]]), [int64Def]),
      ).toThrow(/caratWeight invalid type: expected int64/);
    });

    it("accepts any finite number for format float or double", () => {
      const floatDef = def({ format: "float" });
      const doubleDef = def({ format: "double" });
      expect(() => validateFields(new Map([["field-1", 3.14159]]), [floatDef])).not.toThrow();
      expect(() => validateFields(new Map([["field-1", 3.14159]]), [doubleDef])).not.toThrow();
    });
  });
});
