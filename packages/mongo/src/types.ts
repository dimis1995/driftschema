import type { ObjectId } from "mongodb";
import type { FieldValue, FieldDefinition } from "driftschema";

export interface MongoRecordDocument {
  _id: ObjectId;
  entityType: string;
  fields: Record<string, FieldValue>;
}

export type NewMongoRecordDocument = Omit<MongoRecordDocument, "_id">;

export interface MongoFieldDefinitionDocument {
  _id: ObjectId;
  entityType: string;
  name: string;
  type: FieldDefinition["type"];
  required: boolean;
}

export type NewMongoFieldDefinitionDocument = Omit<MongoFieldDefinitionDocument, "_id">;
