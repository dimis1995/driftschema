import { FieldDefinition } from "../field-definitions/FieldDefinition.js";
import { FieldValue, StoredRecord } from "../types.js";

const COMPARISON_OPERATORS = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in"] as const;
type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

function isOperatorObject(value: unknown): value is Partial<Record<ComparisonOperator, unknown>> {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)
  );
}

function valuesEqual(actual: FieldValue | undefined, expected: unknown): boolean {
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  return actual === expected;
}

function compare(
  actual: FieldValue | undefined,
  op: ComparisonOperator,
  operand: unknown,
): boolean {
  switch (op) {
    case "$eq":
      return valuesEqual(actual, operand);
    case "$ne":
      return !valuesEqual(actual, operand);
    case "$in":
      if (!Array.isArray(operand)) throw new Error('"$in" requires an array operand');
      return operand.some((candidate) => valuesEqual(actual, candidate));
    case "$gt":
    case "$gte":
    case "$lt":
    case "$lte": {
      if (actual === undefined || actual === null) return false;
      if (typeof actual !== "number" && !(actual instanceof Date)) {
        throw new Error(`"${op}" is only supported on number or date fields`);
      }
      const a = actual instanceof Date ? actual.getTime() : actual;
      const b = operand instanceof Date ? operand.getTime() : (operand as number);
      if (op === "$gt") return a > b;
      if (op === "$gte") return a >= b;
      if (op === "$lt") return a < b;
      return a <= b;
    }
  }
}

/**
 * Interprets driftschema's baseline filter syntax against a single record:
 * a plain object keyed by field name (or "id"), where each value is either
 * a direct value (implicit equality) or an operator object drawn from
 * $eq/$ne/$gt/$gte/$lt/$lte/$in. Unrecognized field names or operators
 * throw rather than being silently ignored.
 */
export function matchesFilter(
  record: StoredRecord,
  filter: unknown,
  definitions: FieldDefinition[],
): boolean {
  if (typeof filter !== "object" || filter === null || Array.isArray(filter)) {
    throw new Error("Filter must be a plain object keyed by field name");
  }

  const defsByName = new Map(definitions.map((d) => [d.name, d]));

  for (const [key, expected] of Object.entries(filter)) {
    if (key === "id") {
      if (isOperatorObject(expected)) {
        throw new Error('Filtering "id" with an operator is not supported — use a direct value.');
      }
      if (record.id !== expected) return false;
      continue;
    }

    const def = defsByName.get(key);
    if (!def) {
      throw new Error(`Unknown field "${key}" — no matching field definition to filter on`);
    }

    const actual = record.fields.get(def.id);

    if (isOperatorObject(expected)) {
      for (const [op, operand] of Object.entries(expected)) {
        if (!COMPARISON_OPERATORS.includes(op as ComparisonOperator)) {
          throw new Error(`Unsupported operator "${op}"`);
        }
        if (!compare(actual, op as ComparisonOperator, operand)) return false;
      }
    } else if (!valuesEqual(actual, expected)) {
      return false;
    }
  }

  return true;
}
