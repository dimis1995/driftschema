/**
 * DDL for the tables `PostgresRecordStore`/`PostgresFieldDefinitionStore` expect.
 * Not run automatically by either store — a real deployment should own schema
 * changes through its own migration tool. `POSTGRES_SCHEMA_SQL`/`createSchema`
 * exist as a copy-pasteable source of truth and a quick-start/test convenience.
 */
export const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS field_definitions (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  required BOOLEAN NOT NULL,
  format TEXT,
  allowed_values TEXT[]
);
CREATE INDEX IF NOT EXISTS field_definitions_entity_type_idx ON field_definitions (entity_type);

CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS records_entity_type_idx ON records (entity_type);
CREATE INDEX IF NOT EXISTS records_fields_gin_idx ON records USING GIN (fields);
`;

export async function createSchema(client: {
  query: (sql: string) => Promise<unknown>;
}): Promise<void> {
  await client.query(POSTGRES_SCHEMA_SQL);
}
