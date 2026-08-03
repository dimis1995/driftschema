import type { StoredRecord, FlatRecord, FieldValue } from "../types.js";

export interface RecordStore {
  create(entityType: string, fields: Map<string, FieldValue>): Promise<StoredRecord>;
  createFlat(entityType: string, flat: Omit<FlatRecord, "id" | "entityType">): Promise<FlatRecord>;

  getById(id: string): Promise<StoredRecord | undefined>;
  getByEntityType(entityType: string): Promise<StoredRecord[]>;

  getFlatById(id: string): Promise<FlatRecord | undefined>;
  getFlatByEntityType(entityType: string): Promise<FlatRecord[]>;

  update(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined>;
  updateFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined>;

  replace(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined>;
  replaceFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined>;

  delete(id: string): Promise<void>;
}
