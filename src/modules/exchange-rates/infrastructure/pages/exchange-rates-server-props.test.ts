import type { GetServerSidePropsContext } from "next";

import {
  GoogleOAuthAuthenticationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";

import {
  getExchangeRatesServerSideProps,
} from "./exchange-rates-server-props";

const mockGetAuthenticatedUserEmailFromRequest = jest.fn();
const mockIsGoogleAdminEmail = jest.fn();
const mockGetStorageBootstrap = jest.fn();
const mockCreateMigratedTursoDatabase = jest.fn();
const mockCreateRequestLogContext = jest.fn();
const mockGetExchangeRatesPageResult = jest.fn();
const mockGetAuthenticatedUserSubjectFromRequest = jest.fn();
const mockDrizzleMonthlyExpensesRepository = jest.fn();
const mockAmbitoExchangeRatesRepository = jest.fn();
const mockDrizzleGlobalExchangeRateSettingsRepository = jest.fn();
const mockDrizzleMonthlyExchangeRateSnapshotsRepository = jest.fn();

jest.mock(
  "@/modules/auth/infrastructure/next-auth/authenticated-user-email",
  () => ({
    getAuthenticatedUserEmailFromRequest: (...parameters: unknown[]) =>
      mockGetAuthenticatedUserEmailFromRequest(...parameters),
  }),
);

jest.mock(
  "@/modules/auth/infrastructure/next-auth/google-admin-allowlist",
  () => ({
    isGoogleAdminEmail: (...parameters: unknown[]) =>
      mockIsGoogleAdminEmail(...parameters),
  }),
);

jest.mock("@/modules/auth/infrastructure/oauth/google-oauth-config", () => ({
  isGoogleOAuthConfigured: () => true,
}));

jest.mock("@/modules/storage/application/queries/get-storage-bootstrap", () => ({
  getStorageBootstrap: (...parameters: unknown[]) =>
    mockGetStorageBootstrap(...parameters),
}));

jest.mock(
  "@/modules/shared/infrastructure/database/drizzle/turso-database",
  () => ({
    createMigratedTursoDatabase: (...parameters: unknown[]) =>
      mockCreateMigratedTursoDatabase(...parameters),
  }),
);

jest.mock("@/modules/shared/infrastructure/observability/app-logger", () => ({
  appLogger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  createRequestLogContext: (...parameters: unknown[]) =>
    mockCreateRequestLogContext(...parameters),
}));

jest.mock(
  "@/modules/auth/infrastructure/next-auth/authenticated-user-subject",
  () => ({
    getAuthenticatedUserSubjectFromRequest: (...parameters: unknown[]) =>
      mockGetAuthenticatedUserSubjectFromRequest(...parameters),
  }),
);

jest.mock(
  "@/modules/exchange-rates/application/use-cases/get-exchange-rates-page-result",
  () => ({
    getExchangeRatesPageResult: (...parameters: unknown[]) =>
      mockGetExchangeRatesPageResult(...parameters),
  }),
);

jest.mock(
  "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository",
  () => ({
    DrizzleMonthlyExpensesRepository: jest
      .fn()
      .mockImplementation((...parameters: unknown[]) =>
        mockDrizzleMonthlyExpensesRepository(...parameters),
      ),
  }),
);

jest.mock("../api/ambito-exchange-rates-repository", () => ({
  AmbitoExchangeRatesRepository: jest
    .fn()
    .mockImplementation((...parameters: unknown[]) =>
      mockAmbitoExchangeRatesRepository(...parameters),
    ),
}));

jest.mock("../turso/repositories/drizzle-global-exchange-rate-settings-repository", () => ({
  DrizzleGlobalExchangeRateSettingsRepository: jest
    .fn()
    .mockImplementation((...parameters: unknown[]) =>
      mockDrizzleGlobalExchangeRateSettingsRepository(...parameters),
    ),
}));

jest.mock("../turso/repositories/drizzle-monthly-exchange-rate-snapshots-repository", () => ({
  DrizzleMonthlyExchangeRateSnapshotsRepository: jest
    .fn()
    .mockImplementation((...parameters: unknown[]) =>
      mockDrizzleMonthlyExchangeRateSnapshotsRepository(...parameters),
    ),
}));

const { appLogger } = jest.requireMock(
  "@/modules/shared/infrastructure/observability/app-logger",
) as {
  appLogger: {
    error: jest.Mock;
    warn: jest.Mock;
  };
};

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
    jest.useFakeTimers().setSystemTime(new Date("2026-05-11T12:00:00.000Z"));
    jest.clearAllMocks();
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
    mockDrizzleGlobalExchangeRateSettingsRepository.mockReturnValue({});
    mockDrizzleMonthlyExchangeRateSnapshotsRepository.mockReturnValue({});
    mockDrizzleMonthlyExpensesRepository.mockReturnValue({
      getOldestStoredMonth: jest.fn().mockResolvedValue("2026-01"),
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
    jest.useRealTimers();
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
