import { FieldDefinition } from "./FieldDefinition.js";
import { FieldDefinitionStore } from "./FieldDefinitionStore.js";

export class InMemoryFieldDefinitionStore implements FieldDefinitionStore {
  private defs: FieldDefinition[] = [];
  async add(def: Omit<FieldDefinition, "id">): Promise<FieldDefinition> {
    const withId = { ...def, id: crypto.randomUUID() };
    this.defs.push(withId);
    return withId;
  }
  async getByEntityType(entityType: string): Promise<FieldDefinition[]> {
    return this.defs.filter((d) => d.entityType === entityType);
  }

  async delete(id: string) {
    this.defs = this.defs.filter((d) => d.id === id);
  }
}
