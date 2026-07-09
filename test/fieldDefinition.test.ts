import { describe, it, expect } from "vitest";
import { FieldDefinitionStore } from "../src/fieldDefinition";

describe("FieldDefinitionStore", () => {
  it("adds a field definition and retrieves it by entity type", () => {
    const store = new FieldDefinitionStore();
    store.add({ entityType: "diamonds", name: "caratWeight", type: "number", required: true });
    const fields = store.getByEntityType("diamonds")
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe("caratWeight");
  })
})
