import type { ObjectId } from "mongodb";
import type { FieldValue, FieldDefinition, NumberFormat } from "driftschema";

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
  format?: NumberFormat;
  values?: string[];
}

export type NewMongoFieldDefinitionDocument = Omit<MongoFieldDefinitionDocument, "_id">;
