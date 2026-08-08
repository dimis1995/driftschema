import { FieldDefinition } from "./FieldDefinition.js";

export interface FieldDefinitionStore {
  add(def: Omit<FieldDefinition, "id">): Promise<FieldDefinition>;
  getByEntityType(entityType: string): Promise<FieldDefinition[]>;

  /** Every definition in the store, across all entity types. */
  getAll(): Promise<FieldDefinition[]>;

  /**
   * Inserts or replaces a definition under its given id, rather than
   * minting a new one the way `add` does. Intended for moving definitions
   * between stores (e.g. copying from one backend to another) while
   * preserving the id — since `StoredRecord.fields` is keyed by field id,
   * regenerating ids on import would orphan any existing records.
   */
  upsert(def: FieldDefinition): Promise<FieldDefinition>;

  delete(id: string): Promise<void>;
}
