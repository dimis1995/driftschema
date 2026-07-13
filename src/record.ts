import { fromFlatRecord, toFlatRecord } from "./flatten.js";
import { FieldDefinitionStore } from "./fieldDefinition.js";
import { validateFields } from "./validation.js";

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

export class RecordStore {
  private records: StoredRecord[] = [];

  constructor(private readonly fieldDefinitionStore: FieldDefinitionStore) {}

  // --- low-level: StoredRecord in, StoredRecord out ---

  create(entityType: string, fields: Map<string, FieldValue>): StoredRecord {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    validateFields(fields, definitions);

    const record: StoredRecord = { id: crypto.randomUUID(), entityType, fields };
    this.records.push(record);
    return record;
  }

  getByEntityType(entityType: string): StoredRecord[] {
    return this.records.filter((r) => r.entityType === entityType);
  }

  getById(id: string): StoredRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  // --- high-level: FlatRecord in, FlatRecord out ---

  createFlat(entityType: string, flat: Omit<FlatRecord, "id" | "entityType">): FlatRecord {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    const stored = fromFlatRecord({ ...flat, id: crypto.randomUUID(), entityType }, definitions);
    validateFields(stored.fields, definitions);
    this.records.push(stored);
    return toFlatRecord(stored, definitions);
  }

  getFlatByEntityType(entityType: string): FlatRecord[] {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    return this.getByEntityType(entityType).map((r) => toFlatRecord(r, definitions));
  }

  getFlatById(id: string): FlatRecord | undefined {
    const record = this.getById(id);
    if (!record) return undefined;
    const definitions = this.fieldDefinitionStore.getByEntityType(record.entityType);
    return toFlatRecord(record, definitions);
  }
}
