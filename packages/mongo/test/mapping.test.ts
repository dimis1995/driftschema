import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import {
  fieldsToObject,
  fieldsToMap,
  toNewMongoDocument,
  fromMongoDocument,
  toObjectId,
  toMongoFilter,
} from "../src/mapping.js";
import { FieldValue, FieldDefinition } from "driftschema";

describe("fields Map <-> object conversion", () => {
  it("round-trips a fields map through object form losslessly", () => {
    const original = new Map<string, FieldValue>([
      ["field-1", 1.5],
      ["field-2", "round"],
    ]);
    const roundTripped = fieldsToMap(fieldsToObject(original));

    expect(roundTripped).toEqual(original);
  });
});

describe("toNewMongoDocument", () => {
  it("builds an insertable document without an _id", () => {
    const doc = toNewMongoDocument("diamonds", new Map([["field-1", 1.5]]));

    expect(doc).toEqual({
      entityType: "diamonds",
      fields: { "field-1": 1.5 },
    });
    expect(doc).not.toHaveProperty("_id");
  });
});

describe("fromMongoDocument", () => {
  it("converts a Mongo document into a StoredRecord", () => {
    const objectId = new ObjectId();
    const record = fromMongoDocument({
      _id: objectId,
      entityType: "diamonds",
      fields: { "field-1": 1.5 },
    });

    expect(record.id).toBe(objectId.toString());
    expect(record.entityType).toBe("diamonds");
    expect(record.fields.get("field-1")).toBe(1.5);
  });
});

describe("toObjectId", () => {
  it("converts a valid ObjectId string", () => {
    const objectId = new ObjectId();
    expect(toObjectId(objectId.toString())).toEqual(objectId);
  });

  it("throws a clear error for an invalid id", () => {
    expect(() => toObjectId("not-a-real-id")).toThrow(/not a valid MongoDB ObjectId/);
  });
});

describe("toMongoFilter", () => {
  const definitions: FieldDefinition[] = [
    { id: "carats-id", entityType: "diamonds", name: "carats", type: "number", required: false },
    { id: "color-id", entityType: "diamonds", name: "color", type: "string", required: false },
  ];

  it("translates a field name to its internal field id, passing the value through untouched", () => {
    const filter = toMongoFilter({ carats: { $gte: 5 } }, definitions);
    expect(filter).toEqual({ "fields.carats-id": { $gte: 5 } });
  });

  it("translates multiple fields", () => {
    const filter = toMongoFilter({ carats: { $gte: 5 }, color: "D" }, definitions);
    expect(filter).toEqual({ "fields.carats-id": { $gte: 5 }, "fields.color-id": "D" });
  });

  it("translates id to _id as an ObjectId", () => {
    const objectId = new ObjectId();
    const filter = toMongoFilter({ id: objectId.toString() }, definitions);
    expect(filter).toEqual({ _id: objectId });
  });

  it("throws when id is filtered with an operator", () => {
    expect(() => toMongoFilter({ id: { $in: ["a", "b"] } }, definitions)).toThrow(
      /operator is not supported/,
    );
  });

  it("throws on a field name with no matching field definition", () => {
    expect(() => toMongoFilter({ clarity: "VS1" }, definitions)).toThrow(/Unknown field "clarity"/);
  });
});

describe("Date field round-trip", () => {
  it("preserves a Date instance through fieldsToObject/fieldsToMap", () => {
    const originalDate = new Date("2026-01-15T10:00:00.000Z");
    const original = new Map([["field-date", originalDate]]);

    const roundTripped = fieldsToMap(fieldsToObject(original));
    const value = roundTripped.get("field-date");

    expect(value).toBeInstanceOf(Date);
    expect((value as Date).getTime()).toBe(originalDate.getTime());
  });

  it("preserves a Date instance through a full toNewMongoDocument -> fromMongoDocument cycle", () => {
    const originalDate = new Date("2026-01-15T10:00:00.000Z");
    const newDoc = toNewMongoDocument("diamonds", new Map([["field-date", originalDate]]));

    // Simulate what Mongo would hand back after insert — same fields, plus an assigned _id.
    const insertedDoc = { _id: new ObjectId(), ...newDoc };
    const record = fromMongoDocument(insertedDoc);

    const value = record.fields.get("field-date");
    expect(value).toBeInstanceOf(Date);
    expect((value as Date).getTime()).toBe(originalDate.getTime());
  });
});
