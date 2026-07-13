import type { StoredRecord, FlatRecord, FieldValue } from "./record.js";

export interface RecordStore {
  create(entityType: string, fields: Map<string, FieldValue>): Promise<StoredRecord>;
  createFlat(entityType: string, flat: Omit<FlatRecord, "id" | "entityType">): Promise<FlatRecord>;

  getById(id: string): Promise<StoredRecord | undefined>;
  getByEntityType(entityType: string): Promise<StoredRecord[]>;

  getFlatById(id: string): Promise<FlatRecord | undefined>;
  getFlatByEntityType(entityType: string): Promise<FlatRecord[]>;

  delete(id: string): Promise<void>;
}
