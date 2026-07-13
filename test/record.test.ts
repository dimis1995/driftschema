import { describe, it, expect, beforeEach } from "vitest";
import { RecordStore } from "../src/record.js";
import { FieldDefinitionStore } from "../src/fieldDefinition.js";
import { ValidationError } from "../src/validation.js";

describe("RecordStore", () => {
  let fieldDefinitionStore: FieldDefinitionStore;
  let recordStore: RecordStore;
  let caratFieldId: string;

  beforeEach(() => {
    fieldDefinitionStore = new FieldDefinitionStore();
    recordStore = new RecordStore(fieldDefinitionStore);
    caratFieldId = fieldDefinitionStore.add({
      entityType: "diamonds",
      name: "caratWeight",
      type: "number",
      required: true,
    }).id;
  });

  describe("create", () => {
    it("creates a record with a generated id when fields are valid", () => {
      const record = recordStore.create("diamonds", new Map([[caratFieldId, 1.2]]));

      expect(record.id).toBeTruthy();
      expect(record.entityType).toBe("diamonds");
      expect(record.fields.get(caratFieldId)).toBe(1.2);
    });

    it("throws a ValidationError and does not store the record when fields are invalid", () => {
      expect(() => recordStore.create("diamonds", new Map())).toThrow(ValidationError);
      expect(recordStore.getByEntityType("diamonds")).toHaveLength(0);
    });

    it("assigns a unique id to each record", () => {
      const a = recordStore.create("diamonds", new Map([[caratFieldId, 1]]));
      const b = recordStore.create("diamonds", new Map([[caratFieldId, 2]]));
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("getByEntityType / getById", () => {
    it("filters records by entity type", () => {
      recordStore.create("diamonds", new Map([[caratFieldId, 1]]));
      fieldDefinitionStore.add({ entityType: "rings", name: "size", type: "number", required: false });
      recordStore.create("rings", new Map());

      expect(recordStore.getByEntityType("diamonds")).toHaveLength(1);
      expect(recordStore.getByEntityType("rings")).toHaveLength(1);
      expect(recordStore.getByEntityType("bracelets")).toHaveLength(0);
    });

    it("retrieves a record by id, or undefined if not found", () => {
      const created = recordStore.create("diamonds", new Map([[caratFieldId, 1]]));
      expect(recordStore.getById(created.id)).toEqual(created);
      expect(recordStore.getById("missing-id")).toBeUndefined();
    });
  });

  describe("createFlat", () => {
    it("accepts flat input and returns a flat record", () => {
      const flat = recordStore.createFlat("diamonds", { caratWeight: 2.1 });

      expect(flat.entityType).toBe("diamonds");
      expect(flat.caratWeight).toBe(2.1);
      expect(flat.id).toBeTruthy();
    });

    it("throws for an unknown field name", () => {
      expect(() => recordStore.createFlat("diamonds", { color: "D" } as any)).toThrow(
        /Unknown field "color"/,
      );
    });

    it("throws a ValidationError for missing required fields", () => {
      expect(() => recordStore.createFlat("diamonds", {})).toThrow(ValidationError);
    });
  });

  describe("getFlatByEntityType / getFlatById", () => {
    it("returns flat records keyed by field name", () => {
      recordStore.createFlat("diamonds", { caratWeight: 3 });

      const flatRecords = recordStore.getFlatByEntityType("diamonds");
      expect(flatRecords).toHaveLength(1);
      expect(flatRecords[0].caratWeight).toBe(3);
    });

    it("returns a flat record by id, or undefined if not found", () => {
      const created = recordStore.createFlat("diamonds", { caratWeight: 3 });

      expect(recordStore.getFlatById(created.id)).toEqual(created);
      expect(recordStore.getFlatById("missing-id")).toBeUndefined();
    });
  });
});
