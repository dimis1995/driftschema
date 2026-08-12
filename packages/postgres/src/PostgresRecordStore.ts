import type { Pool } from "pg";
import type {
  RecordStore,
  FieldDefinitionStore,
  StoredRecord,
  FlatRecord,
  FieldValue,
} from "driftschema";
import { validateFields, toFlatRecord, fromFlatRecord } from "driftschema";
import type { PostgresRecordRow } from "./types.js";
import {
  assertValidUuid,
  assertValidIdentifier,
  fieldsToObject,
  fromRow,
  toPostgresFilter,
  buildPageClause,
} from "./mapping.js";

export class PostgresRecordStore implements RecordStore {
  constructor(
    private readonly fieldDefinitionStore: FieldDefinitionStore,
    private readonly pool: Pool,
    private readonly tableName: string = "records",
  ) {
    assertValidIdentifier(tableName);
  }

  async create(entityType: string, fields: Map<string, FieldValue>): Promise<StoredRecord> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    validateFields(fields, definitions);

    const id = crypto.randomUUID();
    await this.pool.query(
      `INSERT INTO ${this.tableName} (id, entity_type, fields) VALUES ($1, $2, $3::jsonb)`,
      [id, entityType, JSON.stringify(fieldsToObject(fields))],
    );

    return { id, entityType, fields };
  }

  async createFlat(
    entityType: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const id = crypto.randomUUID();
    const stored = fromFlatRecord({ ...flat, id, entityType }, definitions);
    validateFields(stored.fields, definitions);

    await this.pool.query(
      `INSERT INTO ${this.tableName} (id, entity_type, fields) VALUES ($1, $2, $3::jsonb)`,
      [id, entityType, JSON.stringify(fieldsToObject(stored.fields))],
    );

    return toFlatRecord(stored, definitions);
  }

  async getById(id: string): Promise<StoredRecord | undefined> {
    assertValidUuid(id);
    const result = await this.pool.query<PostgresRecordRow>(
      `SELECT id, entity_type, fields FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    if (result.rowCount === 0) return undefined;

    const row = result.rows[0]!;
    const definitions = await this.fieldDefinitionStore.getByEntityType(row.entity_type);
    return fromRow(row, definitions);
  }

  async getByEntityType(entityType: string, options?: unknown): Promise<StoredRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const params: unknown[] = [entityType];
    const { extraWhereSql, orderLimitSql } = buildPageClause(options, params);

    const result = await this.pool.query<PostgresRecordRow>(
      `SELECT id, entity_type, fields FROM ${this.tableName} WHERE entity_type = $1 ${extraWhereSql} ${orderLimitSql}`,
      params,
    );
    return result.rows.map((row) => fromRow(row, definitions));
  }

  async getFlatById(id: string): Promise<FlatRecord | undefined> {
    const record = await this.getById(id);
    if (!record) return undefined;
    const definitions = await this.fieldDefinitionStore.getByEntityType(record.entityType);
    return toFlatRecord(record, definitions);
  }

  async getFlatByEntityType(entityType: string, options?: unknown): Promise<FlatRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const records = await this.getByEntityType(entityType, options);
    return records.map((r) => toFlatRecord(r, definitions));
  }

  /**
   * Queries records of an entity type using driftschema's baseline filter
   * DSL (the same $eq/$ne/$gt/$gte/$lt/$lte/$in operators the in-memory
   * engine implements) — not a native Postgres/SQL passthrough. See
   * mapping.ts's toPostgresFilter for the full translation. `options`
   * accepts `{ offset?, limit? }` or `{ after?, limit? }`, per
   * buildPageClause.
   */
  async query(
    entityType: string,
    filter: Record<string, unknown>,
    options?: unknown,
  ): Promise<StoredRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const params: unknown[] = [entityType];
    const filterSql = toPostgresFilter(filter, definitions, params);
    const { extraWhereSql, orderLimitSql } = buildPageClause(options, params);

    const result = await this.pool.query<PostgresRecordRow>(
      `SELECT id, entity_type, fields FROM ${this.tableName} WHERE entity_type = $1 AND (${filterSql}) ${extraWhereSql} ${orderLimitSql}`,
      params,
    );
    return result.rows.map((row) => fromRow(row, definitions));
  }

  async queryFlat(
    entityType: string,
    filter: Record<string, unknown>,
    options?: unknown,
  ): Promise<FlatRecord[]> {
    const definitions = await this.fieldDefinitionStore.getByEntityType(entityType);
    const records = await this.query(entityType, filter, options);
    return records.map((r) => toFlatRecord(r, definitions));
  }

  /**
   * Merges `fields` into the existing record with a single atomic
   * `fields = fields || $2::jsonb` statement — unlike driftschema-mongo's
   * update (which re-writes the whole client-side-merged object and can
   * clobber a concurrent writer's change to an untouched field), a
   * concurrent change to a field this call doesn't touch survives. The
   * prior read is still required — not to compute what gets written, but
   * because validateFields must check the *merged* result (a partial
   * update touching no required field would otherwise look invalid).
   * This does not eliminate every race: this call's validation decision
   * can still be made against field definitions that changed between the
   * read and the write.
   */
  async update(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined> {
    assertValidUuid(id);
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    const merged = new Map([...existing.fields, ...fields]);
    validateFields(merged, definitions);

    const patch = fieldsToObject(fields);
    const result = await this.pool.query<PostgresRecordRow>(
      `UPDATE ${this.tableName} SET fields = fields || $2::jsonb WHERE id = $1 RETURNING id, entity_type, fields`,
      [id, JSON.stringify(patch)],
    );
    if (result.rowCount === 0) return undefined;

    return fromRow(result.rows[0]!, definitions);
  }

  async updateFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    const partial = fromFlatRecord({ ...flat, id, entityType: existing.entityType }, definitions);
    const updated = await this.update(id, partial.fields);
    return updated ? toFlatRecord(updated, definitions) : undefined;
  }

  /** Atomic full overwrite — `replace` doesn't merge, so it has no equivalent race to `update`'s. */
  async replace(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined> {
    assertValidUuid(id);
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    validateFields(fields, definitions);

    const result = await this.pool.query<PostgresRecordRow>(
      `UPDATE ${this.tableName} SET fields = $2::jsonb WHERE id = $1 RETURNING id, entity_type, fields`,
      [id, JSON.stringify(fieldsToObject(fields))],
    );
    if (result.rowCount === 0) return undefined;

    return fromRow(result.rows[0]!, definitions);
  }

  async replaceFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined> {
    const existing = await this.getById(id);
    if (!existing) return undefined;

    const definitions = await this.fieldDefinitionStore.getByEntityType(existing.entityType);
    const full = fromFlatRecord({ ...flat, id, entityType: existing.entityType }, definitions);
    const updated = await this.replace(id, full.fields);
    return updated ? toFlatRecord(updated, definitions) : undefined;
  }

  async delete(id: string): Promise<void> {
    assertValidUuid(id);
    await this.pool.query(`DELETE FROM ${this.tableName} WHERE id = $1`, [id]);
  }
}
