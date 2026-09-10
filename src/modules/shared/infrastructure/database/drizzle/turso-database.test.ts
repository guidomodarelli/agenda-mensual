import { vi, describe, it, expect, beforeEach } from "vitest";
vi.mock("@libsql/client", () => ({
  createClient: vi.fn(),
}));

vi.mock("drizzle-orm/libsql", () => ({
  drizzle: vi.fn(),
}));

vi.mock("drizzle-orm/libsql/migrator", () => ({
  migrate: vi.fn(),
}));

vi.mock("../turso-server-config", () => ({
  requireTursoServerConfig: vi.fn(),
}));

describe("createMigratedTursoDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs migrations only once across repeated calls", async () => {
    await (vi.resetModules(), (async () => {
      const { createClient } = await import("@libsql/client");
      const { drizzle } = await import("drizzle-orm/libsql");
      const { migrate } = await import("drizzle-orm/libsql/migrator");
      const { requireTursoServerConfig } = await import("../turso-server-config");
      const { createMigratedTursoDatabase } = await import("./turso-database");

      vi.mocked(requireTursoServerConfig).mockReturnValue({
        authToken: "test-token",
        url: "libsql://test.local",
      });
      vi.mocked(createClient).mockReturnValue({} as never);
      vi
        .mocked(drizzle)
        .mockReturnValueOnce({ id: "db-1" } as never)
        .mockReturnValueOnce({ id: "db-2" } as never);
      vi.mocked(migrate).mockResolvedValue(undefined as never);

      await createMigratedTursoDatabase();
      await createMigratedTursoDatabase();

      expect(migrate).toHaveBeenCalledTimes(1);
      expect(drizzle).toHaveBeenCalledTimes(2);
    })());
  });

  it("shares the same migration run for concurrent calls", async () => {
    await (vi.resetModules(), (async () => {
      const { createClient } = await import("@libsql/client");
      const { drizzle } = await import("drizzle-orm/libsql");
      const { migrate } = await import("drizzle-orm/libsql/migrator");
      const { requireTursoServerConfig } = await import("../turso-server-config");
      const { createMigratedTursoDatabase } = await import("./turso-database");

      let resolveMigration: () => void = () => undefined;
      const migrationPromise = new Promise<void>((resolve) => {
        resolveMigration = resolve;
      });

      vi.mocked(requireTursoServerConfig).mockReturnValue({
        authToken: "test-token",
        url: "libsql://test.local",
      });
      vi.mocked(createClient).mockReturnValue({} as never);
      vi
        .mocked(drizzle)
        .mockReturnValueOnce({ id: "db-1" } as never)
        .mockReturnValueOnce({ id: "db-2" } as never);
      vi.mocked(migrate).mockReturnValue(migrationPromise as never);

      const firstCall = createMigratedTursoDatabase();
      const secondCall = createMigratedTursoDatabase();

      expect(migrate).toHaveBeenCalledTimes(1);

      resolveMigration();
      await Promise.all([firstCall, secondCall]);
      expect(migrate).toHaveBeenCalledTimes(1);
      expect(drizzle).toHaveBeenCalledTimes(2);
    })());
  });

  it("retries migrations after a failed first attempt", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(function () { return undefined; });

    await (vi.resetModules(), (async () => {
      const { createClient } = await import("@libsql/client");
      const { drizzle } = await import("drizzle-orm/libsql");
      const { migrate } = await import("drizzle-orm/libsql/migrator");
      const { requireTursoServerConfig } = await import("../turso-server-config");
      const { createMigratedTursoDatabase } = await import("./turso-database");

      vi.mocked(requireTursoServerConfig).mockReturnValue({
        authToken: "test-token",
        url: "libsql://test.local",
      });
      vi.mocked(createClient).mockReturnValue({} as never);
      vi
        .mocked(drizzle)
        .mockReturnValueOnce({ id: "db-1" } as never)
        .mockReturnValueOnce({ id: "db-2" } as never);
      vi
        .mocked(migrate)
        .mockRejectedValueOnce(new Error("migration failed"))
        .mockResolvedValueOnce(undefined as never);

      await expect(createMigratedTursoDatabase()).rejects.toThrow(
        "migration failed",
      );
      expect(errorSpy).toHaveBeenCalled();
      await expect(createMigratedTursoDatabase()).resolves.toEqual({
        id: "db-2",
      });
      expect(migrate).toHaveBeenCalledTimes(2);
    })());
  });
});
