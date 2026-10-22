import { describe, expect, it } from "vitest";

describe("repository fallback", () => {
  it("boots deterministic memory state when the demo store is explicitly selected", async () => {
    process.env.GUARDIANGATE_STORE = "memory";
    const { ensurePersistenceReady, persistenceStatus } = await import(
      "@/server/repositories/persistence"
    );

    await expect(ensurePersistenceReady()).resolves.toMatchObject({
      requested: "memory",
      active: "memory",
      hydrated: true,
    });
    expect(persistenceStatus().reason).toBe("explicit memory demo mode");
  });
});
