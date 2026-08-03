import { describe, it, expect } from "vitest";
import { matchesFilter } from "../../src/records/matchesFilter.js";
import type { FieldDefinition } from "../../src/field-definitions/FieldDefinition.js";
import type { FieldValue, StoredRecord } from "../../src/types.js";

const definitions: FieldDefinition[] = [
  { id: "carats-id", entityType: "diamonds", name: "carats", type: "number", required: false },
  { id: "color-id", entityType: "diamonds", name: "color", type: "string", required: false },
  { id: "cut-at-id", entityType: "diamonds", name: "cutAt", type: "date", required: false },
];

function record(fields: Record<string, unknown>, id = "record-1"): StoredRecord {
  return {
    id,
    entityType: "diamonds",
    fields: new Map(Object.entries(fields)) as Map<string, FieldValue>,
  };
}

describe("matchesFilter", () => {
  it("matches direct equality on a field name", () => {
    expect(matchesFilter(record({ "color-id": "D" }), { color: "D" }, definitions)).toBe(true);
    expect(matchesFilter(record({ "color-id": "D" }), { color: "E" }, definitions)).toBe(false);
  });

  it("matches $gte/$lte on numbers", () => {
    const rec = record({ "carats-id": 5 });
    expect(matchesFilter(rec, { carats: { $gte: 5 } }, definitions)).toBe(true);
    expect(matchesFilter(rec, { carats: { $gte: 6 } }, definitions)).toBe(false);
    expect(matchesFilter(rec, { carats: { $lte: 5 } }, definitions)).toBe(true);
  });

  it("matches comparisons on dates", () => {
    const rec = record({ "cut-at-id": new Date("2026-01-01") });
    expect(matchesFilter(rec, { cutAt: { $gt: new Date("2025-01-01") } }, definitions)).toBe(true);
    expect(matchesFilter(rec, { cutAt: { $lt: new Date("2025-01-01") } }, definitions)).toBe(false);
  });

  it("matches $in", () => {
    const rec = record({ "color-id": "D" });
    expect(matchesFilter(rec, { color: { $in: ["D", "E"] } }, definitions)).toBe(true);
    expect(matchesFilter(rec, { color: { $in: ["F", "G"] } }, definitions)).toBe(false);
  });

  it("matches id by direct equality", () => {
    const rec = record({}, "record-42");
    expect(matchesFilter(rec, { id: "record-42" }, definitions)).toBe(true);
    expect(matchesFilter(rec, { id: "other" }, definitions)).toBe(false);
  });

  it("ANDs multiple conditions", () => {
    const rec = record({ "carats-id": 5, "color-id": "D" });
    expect(matchesFilter(rec, { carats: { $gte: 5 }, color: "D" }, definitions)).toBe(true);
    expect(matchesFilter(rec, { carats: { $gte: 5 }, color: "E" }, definitions)).toBe(false);
  });

  it("throws on an unknown field name", () => {
    expect(() => matchesFilter(record({}), { clarity: "VS1" }, definitions)).toThrow(
      /Unknown field "clarity"/,
    );
  });

  it("throws on an unsupported operator", () => {
    expect(() => matchesFilter(record({}), { color: { $regex: "^D" } }, definitions)).toThrow(
      /Unsupported operator "\$regex"/,
    );
  });

  it("throws when id is filtered with an operator", () => {
    expect(() => matchesFilter(record({}), { id: { $in: ["a", "b"] } }, definitions)).toThrow(
      /operator is not supported/,
    );
  });

  it("throws on a comparison operator against a non-numeric, non-date field", () => {
    expect(() =>
      matchesFilter(record({ "color-id": "D" }), { color: { $gte: "D" } }, definitions),
    ).toThrow(/only supported on number or date fields/);
  });
});
