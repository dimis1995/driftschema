import type { ObjectId } from "mongodb";
import type { FieldValue } from "driftschema";

export interface MongoRecordDocument {
  _id: ObjectId;
  entityType: string;
  fields: Record<string, FieldValue>;
}

export type NewMongoRecordDocument = Omit<MongoRecordDocument, "_id">;
