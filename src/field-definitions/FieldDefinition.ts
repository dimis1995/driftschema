export interface FieldDefinition {
  id: string;
  entityType: string;
  name: string;
  type: "string" | "number" | "boolean" | "date";
  required: boolean;
}
