import type { StoredRecord, FlatRecord, FieldValue } from "../types.js";

export interface RecordStore {
  create(entityType: string, fields: Map<string, FieldValue>): Promise<StoredRecord>;
  createFlat(entityType: string, flat: Omit<FlatRecord, "id" | "entityType">): Promise<FlatRecord>;

  getById(id: string): Promise<StoredRecord | undefined>;

  /**
   * Lists records of an entity type. `options`, like `filter` below, is
   * implementation-defined — each RecordStore documents and narrows what it
   * accepts (e.g. `{ offset, limit }` for the in-memory store, `{ skip, limit }`
   * for Mongo). There is no portable pagination syntax guaranteed across
   * engines.
   *
   * Convention: if the number of records returned equals the requested
   * limit, treat that as a signal there may be more — backends don't return
   * a separate "has more" flag.
   */
  getByEntityType(entityType: string, options?: unknown): Promise<StoredRecord[]>;

  getFlatById(id: string): Promise<FlatRecord | undefined>;
  getFlatByEntityType(entityType: string, options?: unknown): Promise<FlatRecord[]>;

  /**
   * Filters records of an entity type. The filter shape is
   * implementation-defined — each RecordStore documents and narrows what it
   * accepts (e.g. a filter keyed by field name, with whatever operators
   * that backend natively supports). There is no portable filter syntax
   * guaranteed across engines.
   *
   * `options` follows the same per-backend pagination convention documented
   * on `getByEntityType`.
   */
  query(entityType: string, filter: unknown, options?: unknown): Promise<StoredRecord[]>;
  queryFlat(entityType: string, filter: unknown, options?: unknown): Promise<FlatRecord[]>;

  update(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined>;
  updateFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined>;

  replace(id: string, fields: Map<string, FieldValue>): Promise<StoredRecord | undefined>;
  replaceFlat(
    id: string,
    flat: Omit<FlatRecord, "id" | "entityType">,
  ): Promise<FlatRecord | undefined>;

  delete(id: string): Promise<void>;
}
