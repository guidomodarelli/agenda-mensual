import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { GetServerSidePropsContext } from "next";

import {
  GoogleOAuthAuthenticationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";

import {
  getExchangeRatesServerSideProps,
} from "./exchange-rates-server-props";

const mockGetAuthenticatedUserEmailFromRequest = vi.fn();
const mockIsGoogleAdminEmail = vi.fn();
const mockGetStorageBootstrap = vi.fn();
const mockCreateMigratedTursoDatabase = vi.fn();
const mockCreateRequestLogContext = vi.fn();
const mockGetExchangeRatesPageResult = vi.fn();
const mockGetAuthenticatedUserSubjectFromRequest = vi.fn();
const mockDrizzleMonthlyExpensesRepository = vi.fn();
const mockAmbitoExchangeRatesRepository = vi.fn();
const mockDrizzleMonthlyExchangeRateSnapshotsRepository = vi.fn();

vi.mock(
  "@/modules/auth/infrastructure/next-auth/authenticated-user-email",
  () => ({
    getAuthenticatedUserEmailFromRequest: (...parameters: unknown[]) =>
      mockGetAuthenticatedUserEmailFromRequest(...parameters),
  }),
);

vi.mock(
  "@/modules/auth/infrastructure/next-auth/google-admin-allowlist",
  () => ({
    isGoogleAdminEmail: (...parameters: unknown[]) =>
      mockIsGoogleAdminEmail(...parameters),
  }),
);

vi.mock("@/modules/auth/infrastructure/oauth/google-oauth-config", () => ({
  isGoogleOAuthConfigured: () => true,
}));

vi.mock("@/modules/storage/application/queries/get-storage-bootstrap", () => ({
  getStorageBootstrap: (...parameters: unknown[]) =>
    mockGetStorageBootstrap(...parameters),
}));

vi.mock(
  "@/modules/shared/infrastructure/database/drizzle/turso-database",
  () => ({
    createMigratedTursoDatabase: (...parameters: unknown[]) =>
      mockCreateMigratedTursoDatabase(...parameters),
  }),
);

vi.mock("@/modules/shared/infrastructure/observability/app-logger", () => ({
  appLogger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
  createRequestLogContext: (...parameters: unknown[]) =>
    mockCreateRequestLogContext(...parameters),
}));

vi.mock(
  "@/modules/auth/infrastructure/next-auth/authenticated-user-subject",
  () => ({
    getAuthenticatedUserSubjectFromRequest: (...parameters: unknown[]) =>
      mockGetAuthenticatedUserSubjectFromRequest(...parameters),
  }),
);

vi.mock(
  "@/modules/exchange-rates/application/use-cases/get-exchange-rates-page-result",
  () => ({
    getExchangeRatesPageResult: (...parameters: unknown[]) =>
      mockGetExchangeRatesPageResult(...parameters),
  }),
);

vi.mock(
  "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository",
  () => ({
    DrizzleMonthlyExpensesRepository: vi
      .fn()
      .mockImplementation(function (...parameters: unknown[]) { return mockDrizzleMonthlyExpensesRepository(...parameters); },
      ),
  }),
);

vi.mock("../api/ambito-exchange-rates-repository", () => ({
  AmbitoExchangeRatesRepository: vi
    .fn()
    .mockImplementation(function (...parameters: unknown[]) { return mockAmbitoExchangeRatesRepository(...parameters); },
    ),
}));

vi.mock("../turso/repositories/drizzle-monthly-exchange-rate-snapshots-repository", () => ({
  DrizzleMonthlyExchangeRateSnapshotsRepository: vi
    .fn()
    .mockImplementation(function (...parameters: unknown[]) { return mockDrizzleMonthlyExchangeRateSnapshotsRepository(...parameters); },
    ),
}));

const { appLogger } = vi.mocked(await import(
  "@/modules/shared/infrastructure/observability/app-logger",
), true);

function createContext(): GetServerSidePropsContext {
  return {
    query: {
      month: "2026-04",
    },
    req: {
      cookies: {},
      headers: {},
      method: "GET",
      url: "/cotizaciones?month=2026-04",
    },
    res: {},
    resolvedUrl: "/cotizaciones?month=2026-04",
  } as unknown as GetServerSidePropsContext;
}

describe("getExchangeRatesServerSideProps", () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date("2026-05-11T12:00:00.000Z"));
    vi.clearAllMocks();
    mockGetAuthenticatedUserEmailFromRequest.mockResolvedValue("admin@example.com");
    mockIsGoogleAdminEmail.mockReturnValue(true);
    mockGetStorageBootstrap.mockReturnValue({
      architecture: {
        dataStrategy: "ssr-first",
        middleendLocation: "src/modules",
        routing: "app-router",
      },
      authStatus: "configured",
      requiredScopes: [],
      storageTargets: [],
    });
    mockCreateMigratedTursoDatabase.mockResolvedValue({});
    mockCreateRequestLogContext.mockReturnValue({
      requestId: "request-id",
    });
    mockAmbitoExchangeRatesRepository.mockReturnValue({});
    mockDrizzleMonthlyExchangeRateSnapshotsRepository.mockReturnValue({});
    mockDrizzleMonthlyExpensesRepository.mockReturnValue({
      getOldestStoredMonth: vi.fn().mockResolvedValue("2026-01"),
    });
    mockGetExchangeRatesPageResult.mockResolvedValue({
      blueRate: 1290,
      canEditIibb: true,
      iibbRateDecimal: 0.02,
      loadError: null,
      loadErrorCode: null,
      maxSelectableMonth: "2026-05",
      minSelectableMonth: "2026-05",
      officialRate: 1200,
      selectedMonth: "2026-04",
      solidarityRate: 1476,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads exchange rates without error logging when the user month range has no Google session", async () => {
    mockGetAuthenticatedUserSubjectFromRequest.mockRejectedValue(
      new GoogleOAuthAuthenticationError(
        "authenticated-user-subject:request requires an authenticated Google session.",
      ),
    );

    const response = await getExchangeRatesServerSideProps(createContext());

    expect(response.props.result.loadError).toBeNull();
    expect(mockGetExchangeRatesPageResult).toHaveBeenCalledWith(
      expect.objectContaining({
        maxSelectableMonth: "2026-05",
        minSelectableMonth: "2026-05",
        month: "2026-04",
      }),
    );
    expect(appLogger.warn).toHaveBeenCalledWith(
      "exchange-rates SSR skipped user month range",
      expect.objectContaining({
        context: expect.objectContaining({
          operation: "exchange-rates-ssr:skip-user-month-range",
        }),
      }),
    );
    expect(appLogger.error).not.toHaveBeenCalled();
  });
});
