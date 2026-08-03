import { FieldDefinitionStore } from "../field-definitions/FieldDefinitionStore.js";
import { fromFlatRecord, toFlatRecord } from "./flatten.js";
import type { StoredRecord, FieldValue, FlatRecord } from "../types.js";
import { RecordStore } from "./RecordStore.js";
import { validateFields } from "./validation.js";

export class InMemoryRecordStore implements RecordStore {
  private records: StoredRecord[] = [];

  constructor(private readonly fieldDefinitionStore: FieldDefinitionStore) {}

  async create(entityType: string, fields: Map<string, FieldValue>): Promise<StoredRecord> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
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
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const stored = fromFlatRecord({ ...flat, id: crypto.randomUUID(), entityType }, definitions);
    validateFields(stored.fields, definitions);
    this.records.push(stored);
    return toFlatRecord(stored, definitions);
  }

  async getFlatByEntityType(entityType: string): Promise<FlatRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    return (await this.getByEntityType(entityType)).map((r) => toFlatRecord(r, definitions));
  }

  async getFlatById(id: string): Promise<FlatRecord | undefined> {
    const record = await this.getById(id);
    if (!record) return undefined;
    const definitions = await this.fieldDefinitionStore.getByEntityType(record.entityType);
    return toFlatRecord(record, definitions);
  }

  async update(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined> {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) return undefined;

    const existing = this.records[index];
    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    const merged = new Map([...existing.fields, ...fields]);
    validateFields(merged, definitions);

    const updated: StoredRecord = { ...existing, fields: merged };
    this.records[index] = updated;
    return updated;
  }

  async updateFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    const partial = fromFlatRecord({ ...flat, id, entityType: existing.entityType }, definitions);
    const updated = await this.update(id, partial.fields);
    return updated ? toFlatRecord(updated, definitions) : undefined;
  }

  async replace(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined> {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) return undefined;

    const existing = this.records[index];
    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    validateFields(fields, definitions);

    const updated: StoredRecord = { ...existing, fields };
    this.records[index] = updated;
    return updated;
  }

  async replaceFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    const full = fromFlatRecord({ ...flat, id, entityType: existing.entityType }, definitions);
    const updated = await this.replace(id, full.fields);
    return updated ? toFlatRecord(updated, definitions) : undefined;
  }

  async delete(id: string): Promise<void> {
    this.records = this.records.filter((r) => r.id !== id);
  }
}
