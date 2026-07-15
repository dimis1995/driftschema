import { ObjectId } from "mongodb";
import type { StoredRecord, FieldValue } from "driftschema";
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
