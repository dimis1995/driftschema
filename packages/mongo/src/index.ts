import type { Collection } from "mongodb";
import { RecordStoreFactory } from "driftschema";
import { MongoRecordStore } from "./MongoRecordStore.js";
import type { MongoRecordDocument } from "./types.js";

export { MongoRecordStore } from "./MongoRecordStore.js";
export { MongoFieldDefinitionStore } from "./MongoFieldDefinitionStore.js";
export type {
  MongoRecordDocument,
  NewMongoRecordDocument,
  MongoFieldDefinitionDocument,
  NewMongoFieldDefinitionDocument,
} from "./types.js";

/** Config accepted by the "mongo" engine when created via `RecordStoreFactory.create`. */
export interface MongoRecordStoreConfig {
  collection: Collection<MongoRecordDocument>;
}

function isMongoRecordStoreConfig(config: unknown): config is MongoRecordStoreConfig {
  return typeof config === "object" && config !== null && "collection" in config;
}

// Registers the "mongo" engine as a side effect of importing this package, so
// `RecordStoreFactory.create("mongo", ...)` works after a plain `import "driftschema-mongo"`.
RecordStoreFactory.register("mongo", (fieldDefinitionStore, config) => {
  if (!isMongoRecordStoreConfig(config)) {
    throw new Error(
      'The "mongo" engine requires a config of the form { collection }, where collection is a ' +
        "MongoDB Collection<MongoRecordDocument> to store records in.",
    );
  }
  return new MongoRecordStore(fieldDefinitionStore, config.collection);
});
