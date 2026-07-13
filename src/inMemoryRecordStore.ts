import { FieldDefinitionStore } from "./fieldDefinition.js";
import { fromFlatRecord, toFlatRecord } from "./flatten.js";
import type { StoredRecord, FieldValue, FlatRecord } from "./record.js";
import { RecordStore } from "./recordStore.js";
import { validateFields } from "./validation.js";

export class InMemoryRecordStore implements RecordStore {
  private records: StoredRecord[] = [];

  constructor(private readonly fieldDefinitionStore: FieldDefinitionStore) {}

  async create(entityType: string, fields: Map<string, FieldValue>): Promise<StoredRecord> {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    validateFields(fields, definitions);

    const record: StoredRecord = { id: crypto.randomUUID(), entityType, fields };
    this.records.push(record);
    return record;
  }

  async getByEntityType(entityType: string): Promise<StoredRecord[]> {
    return this.records.filter((r) => r.entityType === entityType);
  }

  async getById(id: string): Promise<StoredRecord | undefined> {
    return this.records.find((r) => r.id === id);
  }

  async createFlat(
    entityType: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord> {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    const stored = fromFlatRecord({ ...flat, id: crypto.randomUUID(), entityType }, definitions);
    validateFields(stored.fields, definitions);
    this.records.push(stored);
    return toFlatRecord(stored, definitions);
  }

  async getFlatByEntityType(entityType: string): Promise<FlatRecord[]> {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    return (await this.getByEntityType(entityType)).map((r) => toFlatRecord(r, definitions));
  }

  async getFlatById(id: string): Promise<FlatRecord | undefined> {
    const record = await this.getById(id);
    if (!record) return undefined;
    const definitions = this.fieldDefinitionStore.getByEntityType(record.entityType);
    return toFlatRecord(record, definitions);
  }

  async delete(id: string): Promise<void> {
    this.records = this.records.filter((r) => r.id !== id);
  }
}
