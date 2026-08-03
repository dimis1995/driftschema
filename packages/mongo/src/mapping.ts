import { ObjectId, type Filter } from "mongodb";
import type { StoredRecord, FieldValue, FieldDefinition } from "driftschema";
import type { MongoRecordDocument, NewMongoRecordDocument } from "./types.js";

/**
 * Converts a Map<fieldId, value> to a plain object, for BSON storage
 */
export function fieldsToObject(fields: Map<string, FieldValue>): Record<string, FieldValue> {
  return Object.fromEntries(fields);
}

/**
 * Converts a plain object into a Map<fieldId, value>
 */
export function fieldsToMap(fields: Record<string, FieldValue>): Map<string, FieldValue> {
  return new Map(Object.entries(fields));
}

/**
 * Builds the document to insert. No _id - Mongo assigns one on insert.
 */
export function toNewMongoDocument(
  entityType: string,
  fields: Map<string, FieldValue>,
): NewMongoRecordDocument {
  return {
    entityType,
    fields: fieldsToObject(fields),
  };
}

/**
 * Converts a document read from Mongo into driftschema's Stored Record shape
 */
export function fromMongoDocument(doc: MongoRecordDocument): StoredRecord {
  return {
    id: doc._id.toString(),
    entityType: doc.entityType,
    fields: fieldsToMap(doc.fields),
  };
}

/**
 * Converts a driftschema record id (string) to an ObjectId
 */
export function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new Error(`"${id} is not a valid MongoDB ObjectId`);
  }
  return new ObjectId(id);
}

/**
 * Translates a native Mongo-style filter keyed by field name (e.g.
 * `{ carats: { $gte: 5 } }`) into a filter keyed by the internal field id
 * and nested under "fields" (e.g. `{ "fields.<id>": { $gte: 5 } }`), the
 * shape records are actually stored in. Mongo operators inside each value
 * are passed through untouched — only the key is translated.
 *
 * "id" is special-cased to the document's _id; every other key must match
 * a field defined for the entity type, or the filter is rejected outright
 * rather than silently dropped (a typo'd field name would otherwise widen
 * the query instead of erroring).
 */
export function toMongoFilter(
  filter: Record<string, unknown>,
  definitions: FieldDefinition[],
): Filter<MongoRecordDocument> {
  const defsByName = new Map(definitions.map((d) => [d.name, d]));
  const mongoFilter: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key === "id") {
      if (value !== null && typeof value === "object") {
        throw new Error('Filtering "id" with an operator is not supported — use a direct value.');
      }
      mongoFilter._id = toObjectId(value as string);
      continue;
    }

    const def = defsByName.get(key);
    if (!def) {
      throw new Error(`Unknown field "${key}" — no matching field definition to filter on`);
    }

    mongoFilter[`fields.${def.id}`] = value;
  }

  return mongoFilter as Filter<MongoRecordDocument>;
}
