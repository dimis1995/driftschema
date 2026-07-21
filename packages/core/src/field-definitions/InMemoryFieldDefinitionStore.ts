import { FieldDefinition } from "./FieldDefinition.js";
import { FieldDefinitionStore } from "./FieldDefinitionStore.js";

export class InMemoryFieldDefinitionStore implements FieldDefinitionStore {
  private defs: FieldDefinition[] = [];
  add(def: Omit<FieldDefinition, "id">): FieldDefinition {
    const withId = { ...def, id: crypto.randomUUID() };
    this.defs.push(withId);
    return withId;
  }
  getByEntityType(entityType: string): FieldDefinition[] {
    return this.defs.filter((d) => d.entityType === entityType);
  }
}
