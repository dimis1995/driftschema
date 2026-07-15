import { describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import {
  fieldsToObject,
  fieldsToMap,
  toNewMongoDocument,
  fromMongoDocument,
  toObjectId,
} from "../src/mapping.js";
import { FieldValue } from "driftschema";

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
