import type { FieldValue, FieldDefinition, NumberFormat } from "driftschema";

export interface PostgresRecordRow {
  id: string;
  entity_type: string;
  fields: Record<string, FieldValue>;
}

export interface PostgresFieldDefinitionRow {
  id: string;
  entity_type: string;
  name: string;
  type: FieldDefinition["type"];
  required: boolean;
  format: NumberFormat | null;
  allowed_values: string[] | null;
}
