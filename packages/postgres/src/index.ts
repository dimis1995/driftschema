import type { Pool } from "pg";
import { RecordStoreFactory } from "driftschema";
import { PostgresRecordStore } from "./PostgresRecordStore.js";

export { PostgresRecordStore } from "./PostgresRecordStore.js";
export { PostgresFieldDefinitionStore } from "./PostgresFieldDefinitionStore.js";
export { POSTGRES_SCHEMA_SQL, createSchema } from "./schema.js";
export type {
  PostgresPageOptions,
  PostgresOffsetPageOptions,
  PostgresCursorPageOptions,
} from "./mapping.js";
export type { PostgresRecordRow, PostgresFieldDefinitionRow } from "./types.js";

/** Config accepted by the "postgres" engine when created via `RecordStoreFactory.create`. */
export interface PostgresRecordStoreConfig {
  pool: Pool;
  tableName?: string;
}

function isPostgresRecordStoreConfig(config: unknown): config is PostgresRecordStoreConfig {
  return typeof config === "object" && config !== null && "pool" in config;
}

// Registers the "postgres" engine as a side effect of importing this package, so
// `RecordStoreFactory.create("postgres", ...)` works after a plain `import "driftschema-postgres"`.
RecordStoreFactory.register("postgres", (fieldDefinitionStore, config) => {
  if (!isPostgresRecordStoreConfig(config)) {
    throw new Error(
      'The "postgres" engine requires a config of the form { pool, tableName? }, where pool is a ' +
        "pg.Pool to run queries against.",
    );
  }
  return new PostgresRecordStore(fieldDefinitionStore, config.pool, config.tableName);
});
