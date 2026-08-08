import { FieldDefinition, FieldDefinitionStore } from "driftschema";
import { Collection } from "mongodb";
import { toObjectId } from "./mapping.js";
import type { MongoFieldDefinitionDocument, NewMongoFieldDefinitionDocument } from "./types.js";

export class MongoFieldDefinitionStore implements FieldDefinitionStore {
  constructor(private readonly collection: Collection<MongoFieldDefinitionDocument>) {}
  async add(def: Omit<FieldDefinition, "id">): Promise<FieldDefinition> {
    const newDoc: NewMongoFieldDefinitionDocument = { ...def };
    const result = await this.collection.insertOne({ ...newDoc } as MongoFieldDefinitionDocument);
    return { ...def, id: result.insertedId.toString() };
  }
  async getByEntityType(entityType: string): Promise<FieldDefinition[]> {
    const docs = await this.collection.find({ entityType }).toArray();
    return docs.map((doc) => this.fromDoc(doc));
  }

  async getAll(): Promise<FieldDefinition[]> {
    const docs = await this.collection.find({}).toArray();
    return docs.map((doc) => this.fromDoc(doc));
  }

  async upsert(def: FieldDefinition): Promise<FieldDefinition> {
    const { id, ...rest } = def;
    const doc: NewMongoFieldDefinitionDocument = { ...rest };
    await this.collection.replaceOne({ _id: toObjectId(id) }, doc, { upsert: true });
    return def;
  }

  private fromDoc(doc: MongoFieldDefinitionDocument): FieldDefinition {
    return {
      id: doc._id.toString(),
      entityType: doc.entityType,
      name: doc.name,
      type: doc.type,
      required: doc.required,
      ...(doc.format !== undefined && { format: doc.format }),
      ...(doc.values !== undefined && { values: doc.values }),
    };
  }

  async delete(id: string) {
    await this.collection.deleteOne({ _id: toObjectId(id) });
  }
}
