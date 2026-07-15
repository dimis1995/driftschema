import { FieldDefinitionStore } from "../field-definitions/FieldDefinitionStore.js";
import { InMemoryRecordStore } from "./InMemoryRecordStore.js";
import { RecordStore } from "./RecordStore.js";

export type RecordStoreFactoryFn = (
  FieldDefinitionStore: FieldDefinitionStore,
  config?: unknown,
) => RecordStore;

const ENGINE_PACKAGES: Record<string, string> = {
  mongo: "driftschema-mongo",
};

export class RecordStoreFactory {
  private static registry = new Map<string, RecordStoreFactoryFn>();

  static {
    this.registry.set("memory", (defs) => new InMemoryRecordStore(defs));
  }

  /** The import function used to load an engine's package. Overridable in tests. */
  static _importFn: (packageName: string) => Promise<unknown> = (packageName) =>
    import(packageName);

  /**
   * Registers a factory function for an engine name. Called by engine packages as a side effect of being imported.
   */
  static register(engine: string, factoryFn: RecordStoreFactoryFn): void {
    this.registry.set(engine, factoryFn);
  }

  /**
   * Returns true if an engine is already registered
   */
  static isRegistered(engine: string): boolean {
    return this.registry.has(engine);
  }

  static async create(
    engine: string,
    fieldDefinitionStore: FieldDefinitionStore,
    config?: unknown,
  ): Promise<RecordStore> {
    if (!this.registry.has(engine)) {
      const packageName = ENGINE_PACKAGES[engine];
      if (!packageName) {
        throw new Error(`Unknown engine "${engine}". No known package is associated with it.`);
      }

      try {
        await this._importFn(packageName);
      } catch {
        throw new Error(
          `Engine "${engine} requires the "${packageName}" package. Install it with: npm install ${packageName}`,
        );
      }

      if (!this.registry.has(engine)) {
        throw new Error(
          `"${packageName}" was imported but did not register the "${engine}" engine. ` +
            `Check that it calls RecordStoreFactory.register("${engine}", ...).`,
        );
      }
    }

    const factoryFn = this.registry.get(engine)!;
    return factoryFn(fieldDefinitionStore, config);
  }

  /** Exposed for tests only — resets the registry back to just "memory". */
  static _resetForTests(): void {
    this.registry = new Map();
    this.registry.set("memory", (defs) => new InMemoryRecordStore(defs));
    this._importFn = (packageName) => import(packageName);
  }
}
