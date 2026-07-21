// packages/mongo/src/MongoRecordStore.ts
import type { Collection } from "mongodb";
import type {
  RecordStore,
  FieldDefinitionStore,
  StoredRecord,
  FlatRecord,
  FieldValue,
} from "driftschema";
import { validateFields, toFlatRecord, fromFlatRecord } from "driftschema";
import type { MongoRecordDocument } from "./types.js";
import { toNewMongoDocument, fromMongoDocument, toObjectId } from "./mapping.js";

export class MongoRecordStore implements RecordStore {
  constructor(
    private readonly fieldDefinitionStore: FieldDefinitionStore,
    private readonly collection: Collection<MongoRecordDocument>,
  ) {}

  async create(entityType: string, fields: Map<string, FieldValue>): Promise<StoredRecord> {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    validateFields(fields, definitions);

    const newDoc = toNewMongoDocument(entityType, fields);
    const result = await this.collection.insertOne(newDoc as MongoRecordDocument);

    return fromMongoDocument({ ...newDoc, _id: result.insertedId });
  }

  async createFlat(
    entityType: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord> {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    // id is unknown until Mongo assigns it — use a placeholder, discarded after insert.
    const provisional = fromFlatRecord({ ...flat, id: "pending", entityType }, definitions);
    validateFields(provisional.fields, definitions);

    const newDoc = toNewMongoDocument(entityType, provisional.fields);
    const result = await this.collection.insertOne(newDoc as MongoRecordDocument);

    const stored = fromMongoDocument({ ...newDoc, _id: result.insertedId });
    return toFlatRecord(stored, definitions);
  }

  async getById(id: string): Promise<StoredRecord | undefined> {
    const doc = await this.collection.findOne({ _id: toObjectId(id) });
    return doc ? fromMongoDocument(doc) : undefined;
  }

  async getByEntityType(entityType: string): Promise<StoredRecord[]> {
    const docs = await this.collection.find({ entityType }).toArray();
    return docs.map(fromMongoDocument);
  }

  async getFlatById(id: string): Promise<FlatRecord | undefined> {
    const record = await this.getById(id);
    if (!record) return undefined;
    const definitions = this.fieldDefinitionStore.getByEntityType(record.entityType);
    return toFlatRecord(record, definitions);
  }

  async getFlatByEntityType(entityType: string): Promise<FlatRecord[]> {
    const definitions = this.fieldDefinitionStore.getByEntityType(entityType);
    const records = await this.getByEntityType(entityType);
    return records.map((r) => toFlatRecord(r, definitions));
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ _id: toObjectId(id) });
  }
}
