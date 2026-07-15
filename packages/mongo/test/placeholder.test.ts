import { describe, it, expect } from "vitest";

describe("driftschema-mongo scaffold", () => {
  it("package exists and is importable", async () => {
    const mod = await import("../src/index.js");
    expect(mod).toBeDefined();
  });
});
