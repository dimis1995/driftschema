import { FieldDefinitionStore } from "../field-definitions/FieldDefinitionStore.js";
import { fromFlatRecord, toFlatRecord } from "./flatten.js";
import type { StoredRecord, FieldValue, FlatRecord } from "../types.js";
import { RecordStore } from "./RecordStore.js";
import { validateFields } from "./validation.js";
import { matchesFilter } from "./matchesFilter.js";

/** Pagination options accepted by `InMemoryRecordStore`'s `getByEntityType` and `query`. */
export interface InMemoryPageOptions {
  offset?: number;
  limit?: number;
}

function isInMemoryPageOptions(value: unknown): value is InMemoryPageOptions {
  return typeof value === "object" && value !== null;
}

function paginate<T>(items: T[], options?: unknown): T[] {
  if (options === undefined) return items;
  if (!isInMemoryPageOptions(options)) {
    throw new Error("Pagination options must be a plain object of the form { offset?, limit? }");
  }

  const { offset = 0, limit } = options;
  const sliced = items.slice(offset);
  return limit === undefined ? sliced : sliced.slice(0, limit);
}

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

  async getByEntityType(entityType: string, options?: unknown): Promise<StoredRecord[]> {
    const matches = this.records.filter((r) => r.entityType === entityType);
    return paginate(matches, options);
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

  async getFlatByEntityType(entityType: string, options?: unknown): Promise<FlatRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    return (await this.getByEntityType(entityType, options)).map((r) =>
      toFlatRecord(r, definitions),
    );
  }

  async getFlatById(id: string): Promise<FlatRecord | undefined> {
    const record = await this.getById(id);
    if (!record) return undefined;
    const definitions = await this.fieldDefinitionStore.getByEntityType(record.entityType);
    return toFlatRecord(record, definitions);
  }

  async query(entityType: string, filter: unknown, options?: unknown): Promise<StoredRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const candidates = await this.getByEntityType(entityType);
    const matched = candidates.filter((r) => matchesFilter(r, filter, definitions));
    return paginate(matched, options);
  }

  async queryFlat(entityType: string, filter: unknown, options?: unknown): Promise<FlatRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const records = await this.query(entityType, filter, options);
    return records.map((r) => toFlatRecord(r, definitions));
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
