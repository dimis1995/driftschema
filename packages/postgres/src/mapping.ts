import type { StoredRecord, FieldValue, FieldDefinition } from "driftschema";
import type { PostgresRecordRow } from "./types.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validates an id before it ever reaches SQL, mirroring driftschema-mongo's toObjectId. */
export function assertValidUuid(id: string): string {
  if (!UUID_RE.test(id)) {
    throw new Error(`"${id}" is not a valid UUID`);
  }
  return id;
}

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validates a SQL identifier (e.g. a configurable table name) that has to be
 * spliced into query text as-is, since Postgres has no way to bind an
 * identifier as a query parameter. Only ever call this on developer-supplied
 * configuration, never on request/user input.
 */
export function assertValidIdentifier(name: string): string {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`"${name}" is not a valid SQL identifier`);
  }
  return name;
}

/**
 * Converts a Map<fieldId, value> to a plain object, for JSONB storage.
 */
export function fieldsToObject(fields: Map<string, FieldValue>): Record<string, FieldValue> {
  return Object.fromEntries(fields);
}

/**
 * Converts a raw JSONB object back into a fields Map, rehydrating
 * `"date"`-typed fields into real `Date` instances — JSONB has no native
 * date type, so a Date field value round-trips through storage as a plain
 * ISO string otherwise.
 */
export function fieldsToMap(
  raw: Record<string, FieldValue>,
  definitions: FieldDefinition[],
): Map<string, FieldValue> {
  const dateFieldIds = new Set(definitions.filter((d) => d.type === "date").map((d) => d.id));
  return new Map(
    Object.entries(raw).map(([id, value]) => [
      id,
      dateFieldIds.has(id) && typeof value === "string" ? new Date(value) : value,
    ]),
  );
}

/**
 * Builds the row to insert. Unlike driftschema-mongo, the id is minted by the
 * caller before this is called (see PostgresRecordStore) rather than assigned
 * by the database, so there's no placeholder-id round trip.
 */
export function toNewRow(
  id: string,
  entityType: string,
  fields: Map<string, FieldValue>,
): { id: string; entity_type: string; fields: Record<string, FieldValue> } {
  return { id, entity_type: entityType, fields: fieldsToObject(fields) };
}

/**
 * Converts a row read from Postgres into driftschema's StoredRecord shape.
 */
export function fromRow(row: PostgresRecordRow, definitions: FieldDefinition[]): StoredRecord {
  return {
    id: row.id,
    entityType: row.entity_type,
    fields: fieldsToMap(row.fields, definitions),
  };
}

const COMPARISON_OPERATORS = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in"] as const;
type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

function isOperatorObject(value: unknown): value is Partial<Record<ComparisonOperator, unknown>> {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)
  );
}

function pushParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function sqlCast(type: FieldDefinition["type"]): string {
  switch (type) {
    case "number":
      return "::numeric";
    case "date":
      return "::timestamptz";
    case "boolean":
      return "::boolean";
    default:
      return "";
  }
}

function requireComparableType(op: ComparisonOperator, def: FieldDefinition): void {
  if (
    (op === "$gt" || op === "$gte" || op === "$lt" || op === "$lte") &&
    def.type !== "number" &&
    def.type !== "date"
  ) {
    throw new Error(`"${op}" is only supported on number or date fields`);
  }
}

/**
 * Builds the SQL predicate + bound params for one field's comparison,
 * handling JSONB's inability to distinguish "key absent" from "key present
 * with JSON null" (both extract as SQL NULL via `->>'`).
 */
function buildComparison(
  op: ComparisonOperator,
  column: string,
  cast: string,
  operand: unknown,
  params: unknown[],
): string {
  if (op === "$in") {
    if (!Array.isArray(operand)) throw new Error('"$in" requires an array operand');
    if (operand.length === 0) return "FALSE";

    const hasNull = operand.includes(null);
    const nonNull = operand.filter((v) => v !== null);
    const clauses: string[] = [];
    if (hasNull) clauses.push(`${column} IS NULL`);
    if (nonNull.length > 0) {
      clauses.push(`(${column})${cast} = ANY(${pushParam(params, nonNull)}${cast}[])`);
    }
    return `(${clauses.join(" OR ")})`;
  }

  if (operand === null) {
    if (op === "$eq") return `${column} IS NULL`;
    if (op === "$ne") return `${column} IS NOT NULL`;
    // $gt/$gte/$lt/$lte against null: SQL's own NULL-propagation already
    // yields "no match", matching in-memory's "missing/null actual => false".
  }

  const placeholder = pushParam(params, operand);
  switch (op) {
    case "$eq":
      return `(${column})${cast} = ${placeholder}${cast}`;
    case "$ne":
      // Not plain `<>`: against a NULL extraction that yields SQL NULL (row
      // excluded), which would wrongly drop "field absent" rows a $ne
      // against a real value should include. IS DISTINCT FROM is NULL-safe.
      return `(${column})${cast} IS DISTINCT FROM ${placeholder}${cast}`;
    case "$gt":
      return `(${column})${cast} > ${placeholder}${cast}`;
    case "$gte":
      return `(${column})${cast} >= ${placeholder}${cast}`;
    case "$lt":
      return `(${column})${cast} < ${placeholder}${cast}`;
    case "$lte":
      return `(${column})${cast} <= ${placeholder}${cast}`;
    default:
      throw new Error(`Unsupported operator "${op}"`);
  }
}

/**
 * Translates driftschema's baseline filter syntax — the same field-name-keyed
 * $eq/$ne/$gt/$gte/$lt/$lte/$in DSL implemented in packages/core against
 * in-memory records — into a parameterized SQL predicate against the
 * `fields` JSONB column. Unlike driftschema-mongo, there's no native
 * "pass a driver filter object straight through" option for Postgres, so
 * this package reuses core's operator vocabulary instead of inventing one.
 *
 * Every value — including the internal field id used as the JSONB key —
 * is bound as a parameter; only column names/operators/casts are literal
 * SQL text. Unrecognized field names or operators throw rather than being
 * silently ignored.
 */
export function toPostgresFilter(
  filter: Record<string, unknown>,
  definitions: FieldDefinition[],
  params: unknown[],
): string {
  const defsByName = new Map(definitions.map((d) => [d.name, d]));
  const clauses: string[] = [];

  for (const [key, expected] of Object.entries(filter)) {
    if (key === "id") {
      if (isOperatorObject(expected)) {
        throw new Error('Filtering "id" with an operator is not supported — use a direct value.');
      }
      clauses.push(`id = ${pushParam(params, assertValidUuid(expected as string))}::uuid`);
      continue;
    }

    const def = defsByName.get(key);
    if (!def) {
      throw new Error(`Unknown field "${key}" — no matching field definition to filter on`);
    }

    const keyPlaceholder = pushParam(params, def.id);
    const column = `fields->>${keyPlaceholder}`;
    const cast = sqlCast(def.type);

    if (!isOperatorObject(expected)) {
      clauses.push(buildComparison("$eq", column, cast, expected, params));
      continue;
    }

    for (const [op, operand] of Object.entries(expected)) {
      if (!COMPARISON_OPERATORS.includes(op as ComparisonOperator)) {
        throw new Error(`Unsupported operator "${op}"`);
      }
      requireComparableType(op as ComparisonOperator, def);
      clauses.push(buildComparison(op as ComparisonOperator, column, cast, operand, params));
    }
  }

  return clauses.length > 0 ? clauses.join(" AND ") : "TRUE";
}

/** Pagination options accepted by PostgresRecordStore's getByEntityType and query. */
export interface PostgresOffsetPageOptions {
  offset?: number;
  limit?: number;
}

/** Cursor mode always means "sorted by id" — ids are random UUIDs, so this is
 *  a stable total order with no relationship to insertion order. */
export interface PostgresCursorPageOptions {
  after?: string;
  limit?: number;
}

export type PostgresPageOptions = PostgresOffsetPageOptions | PostgresCursorPageOptions;

/**
 * Builds the extra WHERE predicate (for cursor mode) and the ORDER BY/LIMIT/
 * OFFSET clause for a query, appending any needed values to `params`. Always
 * orders by id, even with no options, so every result set is deterministic.
 */
export function buildPageClause(
  options: unknown,
  params: unknown[],
): { extraWhereSql: string; orderLimitSql: string } {
  if (options === undefined) {
    return { extraWhereSql: "", orderLimitSql: "ORDER BY id" };
  }
  if (typeof options !== "object" || options === null) {
    throw new Error(
      "Pagination options must be a plain object of the form { offset?, limit? } or { after?, limit? }",
    );
  }

  const opts = options as Record<string, unknown>;
  if (opts.after !== undefined && opts.offset !== undefined) {
    throw new Error('Pagination options cannot specify both "after" and "offset"');
  }

  let extraWhereSql = "";
  if (opts.after !== undefined) {
    extraWhereSql = `AND id > ${pushParam(params, assertValidUuid(opts.after as string))}::uuid`;
  }

  let orderLimitSql = "ORDER BY id";
  if (opts.limit !== undefined) {
    orderLimitSql += ` LIMIT ${pushParam(params, opts.limit)}`;
  }
  if (opts.after === undefined && opts.offset !== undefined) {
    orderLimitSql += ` OFFSET ${pushParam(params, opts.offset)}`;
  }

  return { extraWhereSql, orderLimitSql };
}
