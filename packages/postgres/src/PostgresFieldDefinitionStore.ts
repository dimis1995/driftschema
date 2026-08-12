import type { Pool } from "pg";
import type { FieldDefinition, FieldDefinitionStore } from "driftschema";
import type { PostgresFieldDefinitionRow } from "./types.js";
import { assertValidUuid, assertValidIdentifier } from "./mapping.js";

export class PostgresFieldDefinitionStore implements FieldDefinitionStore {
  constructor(
    private readonly pool: Pool,
    private readonly tableName: string = "field_definitions",
  ) {
    assertValidIdentifier(tableName);
  }

  async add(def: Omit<FieldDefinition, "id">): Promise<FieldDefinition> {
    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO ${this.tableName} (id, entity_type, name, type, required, format, allowed_values)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        def.entityType,
        def.name,
        def.type,
        def.required,
        def.format ?? null,
        def.values ?? null,
      ],
    );
    return { ...def, id };
  }

  async getByEntityType(entityType: string): Promise<FieldDefinition[]> {
    const result = await this.pool.query<PostgresFieldDefinitionRow>(
      `SELECT id, entity_type, name, type, required, format, allowed_values FROM ${this.tableName} WHERE entity_type = $1`,
      [entityType],
    );
    return result.rows.map((row) => this.fromRow(row));
  }

  async getAll(): Promise<FieldDefinition[]> {
    const result = await this.pool.query<PostgresFieldDefinitionRow>(
      `SELECT id, entity_type, name, type, required, format, allowed_values FROM ${this.tableName}`,
    );
    return result.rows.map((row) => this.fromRow(row));
  }

  async upsert(def: FieldDefinition): Promise<FieldDefinition> {
    assertValidUuid(def.id);
    await this.pool.query(
      `INSERT INTO ${this.tableName} (id, entity_type, name, type, required, format, allowed_values)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         entity_type = EXCLUDED.entity_type,
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         required = EXCLUDED.required,
         format = EXCLUDED.format,
         allowed_values = EXCLUDED.allowed_values`,
      [
        def.id,
        def.entityType,
        def.name,
        def.type,
        def.required,
        def.format ?? null,
        def.values ?? null,
      ],
    );
    return def;
  }

  async delete(id: string): Promise<void> {
    assertValidUuid(id);
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
  }

  private fromRow(row: PostgresFieldDefinitionRow): FieldDefinition {
    return {
      id: row.id,
      entityType: row.entity_type,
      name: row.name,
      type: row.type,
      required: row.required,
      ...(row.format !== null && { format: row.format }),
      ...(row.allowed_values !== null && { values: row.allowed_values }),
    };
  }
}
