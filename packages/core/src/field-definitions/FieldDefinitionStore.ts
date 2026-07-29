import { FieldDefinition } from "./FieldDefinition.js";

export interface FieldDefinitionStore {
  add(def: Omit<FieldDefinition, "id">): Promise<FieldDefinition>;
  getByEntityType(entityType: string): Promise<FieldDefinition[]>;
  delete(id: string): Promise<void>;
}
