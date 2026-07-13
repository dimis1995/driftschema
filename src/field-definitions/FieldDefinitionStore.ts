import { FieldDefinition } from "./FieldDefinition.js";

export class FieldDefinitionStore {
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
