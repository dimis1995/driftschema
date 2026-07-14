import { describe, it, expect, afterEach } from "vitest";
import { FieldDefinitionStore } from "../../src/field-definitions/FieldDefinitionStore.js";
import { RecordStoreFactory } from "../../src/records/RecordStoreFactory.js";
import { InMemoryRecordStore } from "../../src/records/InMemoryRecordStore.js";

afterEach(() => {
  RecordStoreFactory._resetForTests();
});

describe("RecordStoreFactory", () => {
  it("creates an InMemoryRecordStore for the 'memory' engine by default", async () => {
    const defs = new FieldDefinitionStore();
    const store = await RecordStoreFactory.create("memory", defs);

    expect(store).toBeInstanceOf(InMemoryRecordStore);
  });

  it("reports 'memory' as registered without any extra setup", () => {
    expect(RecordStoreFactory.isRegistered("memory")).toBe(true);
  });

  it("throws a clear error for a completely unknown engine", async () => {
    const defs = new FieldDefinitionStore();
    await expect(RecordStoreFactory.create("sqlite", defs)).rejects.toThrow(
      /Unknown engine "sqlite"/,
    );
  });
});

describe("RecordStoreFactory — registration mechanics", () => {
  it("allows an engine to register itself and then be created", async () => {
    const defs = new FieldDefinitionStore();

    class FakeEngineStore extends InMemoryRecordStore {}
    RecordStoreFactory.register("fake-engine", (d) => new FakeEngineStore(d));

    const store = await RecordStoreFactory.create("fake-engine", defs);
    expect(store).toBeInstanceOf(FakeEngineStore);
  });

  it("throws an actionable error for a known-but-uninstalled engine", async () => {
    const defs = new FieldDefinitionStore();
    // "mongo" is a known engine name (per ENGINE_PACKAGES) but driftschema-mongo
    // is not installed in this repo, so the dynamic import will fail.
    await expect(RecordStoreFactory.create("mongo", defs)).rejects.toThrow(
      /requires the "driftschema-mongo" package/,
    );
  });
});
