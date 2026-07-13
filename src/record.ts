export type FieldValue = string | number | boolean | Date | null;

export interface StoredRecord {
  id: string;
  entityType: string;
  fields: Map<string, FieldValue>;
}

export interface FlatRecord {
  id: string;
  entityType: string;
  [fieldName: string]: FieldValue | string;
}
