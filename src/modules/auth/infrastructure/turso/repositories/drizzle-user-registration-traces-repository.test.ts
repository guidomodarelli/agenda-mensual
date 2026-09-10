import { vi, describe, it, expect } from "vitest";
import { userRegistrationTracesTable } from "@/modules/shared/infrastructure/database/drizzle/schema";

import { DrizzleUserRegistrationTracesRepository } from "./drizzle-user-registration-traces-repository";

describe("DrizzleUserRegistrationTracesRepository", () => {
  it("returns null when traceability record does not exist", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      from: fromMock,
    });
    const repository = new DrizzleUserRegistrationTracesRepository({
      select: selectMock,
    } as never);

    const result = await repository.getRegistrationTraceByUserSubject(
      "google-user-123",
    );

    expect(result).toBeNull();
  });

  it("maps an existing SQL row into traceability payload", async () => {
    const whereMock = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([
        {
          authProvider: "google",
          lastVerifiedAtIso: "2026-04-27T10:00:00.000Z",
          registeredAtIso: "2026-04-20T10:00:00.000Z",
          registrationEmail: "user@example.com",
          userSubject: "google-user-123",
        },
      ]),
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    const selectMock = vi.fn().mockReturnValue({
      from: fromMock,
    });
    const repository = new DrizzleUserRegistrationTracesRepository({
      select: selectMock,
    } as never);

    const result = await repository.getRegistrationTraceByUserSubject(
      "google-user-123",
    );

    expect(result).toEqual({
      authProvider: "google",
      lastVerifiedAtIso: "2026-04-27T10:00:00.000Z",
      registeredAtIso: "2026-04-20T10:00:00.000Z",
      registrationEmail: "user@example.com",
      userSubject: "google-user-123",
    });
  });

  it("upserts and updates verification timestamp while preserving registration timestamp", async () => {
    const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
    const valuesMock = vi.fn().mockReturnValue({
      onConflictDoUpdate: onConflictDoUpdateMock,
    });
    const insertMock = vi.fn().mockReturnValue({
      values: valuesMock,
    });
    const repository = new DrizzleUserRegistrationTracesRepository({
      insert: insertMock,
    } as never);

    await repository.upsertRegistrationTrace({
      authProvider: "google",
      nowIso: "2026-04-27T11:00:00.000Z",
      registrationEmail: "user@example.com",
      userSubject: "google-user-123",
    });

    expect(insertMock).toHaveBeenCalledWith(userRegistrationTracesTable);
    expect(valuesMock).toHaveBeenCalledWith({
      authProvider: "google",
      lastVerifiedAtIso: "2026-04-27T11:00:00.000Z",
      registeredAtIso: "2026-04-27T11:00:00.000Z",
      registrationEmail: "user@example.com",
      userSubject: "google-user-123",
    });
    expect(onConflictDoUpdateMock).toHaveBeenCalledWith({
      set: {
        authProvider: "google",
        lastVerifiedAtIso: "2026-04-27T11:00:00.000Z",
        registrationEmail: "user@example.com",
      },
      target: [userRegistrationTracesTable.userSubject],
    });
  });
});
