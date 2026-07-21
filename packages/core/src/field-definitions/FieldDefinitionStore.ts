import { FieldDefinition } from "./FieldDefinition.js";

export interface FieldDefinitionStore {
  add(def: Omit<FieldDefinition, "id">): FieldDefinition;
  getByEntityType(entityType: string): FieldDefinition[];
}
