import { describe, it, expect } from "vitest";
import type { FieldValue, FieldDefinition } from "driftschema";
import {
  fieldsToObject,
  fieldsToMap,
  toNewRow,
  fromRow,
  assertValidUuid,
  toPostgresFilter,
  buildPageClause,
} from "../src/mapping.js";

const SOME_UUID = "11111111-1111-1111-1111-111111111111";

describe("fields Map <-> object conversion", () => {
  it("round-trips a fields map through object form losslessly", () => {
    const original = new Map<string, FieldValue>([
      ["field-1", 1.5],
      ["field-2", "round"],
    ]);
    const roundTripped = fieldsToMap(fieldsToObject(original), []);

    expect(roundTripped).toEqual(original);
  });

  it("rehydrates a date-typed field back into a real Date instance", () => {
    const definitions: FieldDefinition[] = [
      {
        id: "date-field",
        entityType: "diamonds",
        name: "certifiedAt",
        type: "date",
        required: false,
      },
    ];
    const original = new Map<string, FieldValue>([
      ["date-field", new Date("2024-01-01T00:00:00Z")],
    ]);

    const roundTripped = fieldsToMap(fieldsToObject(original), definitions);
    const value = roundTripped.get("date-field");

    expect(value).toBeInstanceOf(Date);
    expect((value as Date).getTime()).toBe(new Date("2024-01-01T00:00:00Z").getTime());
  });
});

describe("toNewRow", () => {
  it("builds an insertable row", () => {
    const row = toNewRow(SOME_UUID, "diamonds", new Map([["field-1", 1.5]]));

    expect(row).toEqual({
      id: SOME_UUID,
      entity_type: "diamonds",
      fields: { "field-1": 1.5 },
    });
  });
});

describe("fromRow", () => {
  it("converts a Postgres row into a StoredRecord", () => {
    const record = fromRow(
      { id: SOME_UUID, entity_type: "diamonds", fields: { "field-1": 1.5 } },
      [],
    );

    expect(record.id).toBe(SOME_UUID);
    expect(record.entityType).toBe("diamonds");
    expect(record.fields.get("field-1")).toBe(1.5);
  });
});

describe("assertValidUuid", () => {
  it("returns a valid UUID unchanged", () => {
    expect(assertValidUuid(SOME_UUID)).toBe(SOME_UUID);
  });

  it("throws a clear error for an invalid id", () => {
    expect(() => assertValidUuid("not-a-real-id")).toThrow(/not a valid UUID/);
  });
});

describe("toPostgresFilter", () => {
  const definitions: FieldDefinition[] = [
    { id: "carats-id", entityType: "diamonds", name: "carats", type: "number", required: false },
    { id: "color-id", entityType: "diamonds", name: "color", type: "string", required: false },
  ];

  it("translates a field name to its internal field id, passing the value through as a param", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ carats: { $gte: 5 } }, definitions, params);

    expect(sql).toBe("(fields->>$1)::numeric >= $2::numeric");
    expect(params).toEqual(["carats-id", 5]);
  });

  it("translates multiple fields, ANDed together", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ carats: { $gte: 5 }, color: "D" }, definitions, params);

    expect(sql).toBe("(fields->>$1)::numeric >= $2::numeric AND (fields->>$3) = $4");
    expect(params).toEqual(["carats-id", 5, "color-id", "D"]);
  });

  it("translates id to a direct uuid comparison", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ id: SOME_UUID }, definitions, params);

    expect(sql).toBe("id = $1::uuid");
    expect(params).toEqual([SOME_UUID]);
  });

  it("throws when id is filtered with an operator", () => {
    expect(() => toPostgresFilter({ id: { $in: [SOME_UUID] } }, definitions, [])).toThrow(
      /Filtering "id" with an operator is not supported/,
    );
  });

  it("throws when filtering on an unknown field", () => {
    expect(() => toPostgresFilter({ clarity: "VS1" }, definitions, [])).toThrow(
      /Unknown field "clarity"/,
    );
  });

  it("throws when a range operator targets a non-numeric, non-date field", () => {
    expect(() => toPostgresFilter({ color: { $gt: "C" } }, definitions, [])).toThrow(
      /"\$gt" is only supported on number or date fields/,
    );
  });

  it("translates a direct null value to IS NULL, matching a wholly absent key", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ color: null }, definitions, params);

    expect(sql).toBe("fields->>$1 IS NULL");
    expect(params).toEqual(["color-id"]);
  });

  it("translates $ne to the NULL-safe IS DISTINCT FROM, not plain <>", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ color: { $ne: "D" } }, definitions, params);

    expect(sql).toContain("IS DISTINCT FROM");
    expect(sql).not.toMatch(/[^!<>]<>[^=]/);
    expect(params).toEqual(["color-id", "D"]);
  });

  it("translates $ne: null to IS NOT NULL", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ color: { $ne: null } }, definitions, params);

    expect(sql).toBe("fields->>$1 IS NOT NULL");
    expect(params).toEqual(["color-id"]);
  });

  it("splits $in with a null element into an IS NULL / = ANY(...) union", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ color: { $in: ["D", null] } }, definitions, params);

    expect(sql).toBe("(fields->>$1 IS NULL OR (fields->>$1) = ANY($2[]))");
    expect(params).toEqual(["color-id", ["D"]]);
  });

  it("translates an empty $in to a literal FALSE", () => {
    const params: unknown[] = [];
    const sql = toPostgresFilter({ color: { $in: [] } }, definitions, params);

    expect(sql).toBe("FALSE");
  });

  it("throws when $in is not an array", () => {
    expect(() => toPostgresFilter({ color: { $in: "D" } }, definitions, [])).toThrow(
      /"\$in" requires an array operand/,
    );
  });

  it("throws on an unsupported operator", () => {
    expect(() => toPostgresFilter({ color: { $regex: "D" } }, definitions, [])).toThrow(
      /Unsupported operator "\$regex"/,
    );
  });
});

describe("buildPageClause", () => {
  it("defaults to ordering by id with no limit/offset", () => {
    const params: unknown[] = [];
    expect(buildPageClause(undefined, params)).toEqual({
      extraWhereSql: "",
      orderLimitSql: "ORDER BY id",
    });
    expect(params).toEqual([]);
  });

  it("builds an offset + limit clause", () => {
    const params: unknown[] = [];
    const { extraWhereSql, orderLimitSql } = buildPageClause({ offset: 2, limit: 3 }, params);

    expect(extraWhereSql).toBe("");
    expect(orderLimitSql).toBe("ORDER BY id LIMIT $1 OFFSET $2");
    expect(params).toEqual([3, 2]);
  });

  it("builds an after + limit (cursor) clause", () => {
    const params: unknown[] = [];
    const { extraWhereSql, orderLimitSql } = buildPageClause(
      { after: SOME_UUID, limit: 2 },
      params,
    );

    expect(extraWhereSql).toBe(`AND id > $1::uuid`);
    expect(orderLimitSql).toBe("ORDER BY id LIMIT $2");
    expect(params).toEqual([SOME_UUID, 2]);
  });

  it("throws when both after and offset are given", () => {
    expect(() => buildPageClause({ after: SOME_UUID, offset: 1 }, [])).toThrow(
      /cannot specify both "after" and "offset"/,
    );
  });

  it("throws on non-object options", () => {
    expect(() => buildPageClause("page 2", [])).toThrow(
      /Pagination options must be a plain object/,
    );
  });

  it("throws when after is not a valid uuid", () => {
    expect(() => buildPageClause({ after: "not-a-uuid" }, [])).toThrow(/not a valid UUID/);
  });
});
