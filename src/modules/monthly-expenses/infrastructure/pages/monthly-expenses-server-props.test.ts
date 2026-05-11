import type { GetServerSidePropsContext } from "next";

import {
  GoogleOAuthAuthenticationError,
} from "@/modules/auth/infrastructure/oauth/google-oauth-token";
import type { MonthlyExpensesPageProps } from "@/modules/monthly-expenses/shared/pages/monthly-expenses-page";

import {
  getMonthlyExpensesServerSidePropsForTab,
  toSerializableMonthlyExpensesPageProps,
} from "./monthly-expenses-server-props";

const mockGetStorageBootstrap = jest.fn();
const mockCreateRequestLogContext = jest.fn();
const mockGetMonthlyExpensesDocument = jest.fn();
const mockGetLendersCatalog = jest.fn();
const mockGetMonthlyExpensesLoansReport = jest.fn();
const mockGetMonthlyExpensesCopyableMonths = jest.fn();
const mockGetAuthenticatedUserSubjectFromRequest = jest.fn();
const mockCreateMigratedTursoDatabase = jest.fn();
const mockGetGoogleDriveClientFromRequest = jest.fn();
const mockCreateGetMonthlyExchangeRateSnapshot = jest.fn();

jest.mock("@/modules/auth/infrastructure/oauth/google-oauth-config", () => ({
  isGoogleOAuthConfigured: () => true,
}));

jest.mock("@/modules/storage/application/queries/get-storage-bootstrap", () => ({
  getStorageBootstrap: (...parameters: unknown[]) =>
    mockGetStorageBootstrap(...parameters),
}));

jest.mock("@/modules/shared/infrastructure/observability/app-logger", () => ({
  appLogger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  createRequestLogContext: (...parameters: unknown[]) =>
    mockCreateRequestLogContext(...parameters),
}));

jest.mock(
  "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-document",
  () => ({
    getMonthlyExpensesDocument: (...parameters: unknown[]) =>
      mockGetMonthlyExpensesDocument(...parameters),
  }),
);

jest.mock("@/modules/lenders/application/use-cases/get-lenders-catalog", () => ({
  getLendersCatalog: (...parameters: unknown[]) =>
    mockGetLendersCatalog(...parameters),
}));

jest.mock(
  "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-loans-report",
  () => ({
    getMonthlyExpensesLoansReport: (...parameters: unknown[]) =>
      mockGetMonthlyExpensesLoansReport(...parameters),
  }),
);

jest.mock(
  "@/modules/monthly-expenses/application/use-cases/get-monthly-expenses-copyable-months",
  () => ({
    getMonthlyExpensesCopyableMonths: (...parameters: unknown[]) =>
      mockGetMonthlyExpensesCopyableMonths(...parameters),
  }),
);

jest.mock(
  "@/modules/auth/infrastructure/next-auth/authenticated-user-subject",
  () => ({
    getAuthenticatedUserSubjectFromRequest: (...parameters: unknown[]) =>
      mockGetAuthenticatedUserSubjectFromRequest(...parameters),
  }),
);

jest.mock(
  "@/modules/shared/infrastructure/database/drizzle/turso-database",
  () => ({
    createMigratedTursoDatabase: (...parameters: unknown[]) =>
      mockCreateMigratedTursoDatabase(...parameters),
  }),
);

jest.mock(
  "@/modules/auth/infrastructure/google-drive/google-drive-client",
  () => ({
    getGoogleDriveClientFromRequest: (...parameters: unknown[]) =>
      mockGetGoogleDriveClientFromRequest(...parameters),
  }),
);

jest.mock(
  "@/modules/exchange-rates/infrastructure/create-get-monthly-exchange-rate-snapshot",
  () => ({
    createGetMonthlyExchangeRateSnapshot: (...parameters: unknown[]) =>
      mockCreateGetMonthlyExchangeRateSnapshot(...parameters),
  }),
);

jest.mock(
  "@/modules/monthly-expenses/infrastructure/turso/repositories/drizzle-monthly-expenses-repository",
  () => ({
    DrizzleMonthlyExpensesRepository: jest.fn().mockImplementation(() => ({})),
  }),
);

jest.mock(
  "@/modules/lenders/infrastructure/turso/repositories/drizzle-lenders-repository",
  () => ({
    DrizzleLendersRepository: jest.fn().mockImplementation(() => ({})),
  }),
);

jest.mock(
  "@/modules/monthly-expenses/infrastructure/google-drive/repositories/google-drive-monthly-expense-receipts-repository",
  () => ({
    GoogleDriveMonthlyExpenseReceiptsRepository: jest
      .fn()
      .mockImplementation(() => ({})),
  }),
);

function createServerSideContext(
  month: string,
): GetServerSidePropsContext {
  return {
    query: {
      month,
    },
    req: {
      cookies: {},
      headers: {},
    },
  } as unknown as GetServerSidePropsContext;
}

describe("toSerializableMonthlyExpensesPageProps", () => {
  it("omits undefined nested folder status values from the SSR payload", () => {
    const props: MonthlyExpensesPageProps = {
      bootstrap: {
        architecture: {
          dataStrategy: "ssr-first",
          middleendLocation: "src/modules",
          routing: "app-router",
        },
        authStatus: "configured",
        requiredScopes: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/drive.file",
        ],
        storageTargets: [
          {
            id: "userFiles",
            requiredScope: "https://www.googleapis.com/auth/drive.file",
            writesUserVisibleFiles: true,
          },
        ],
      },
      initialActiveTab: "expenses",
      initialCopyableMonths: {
        defaultSourceMonth: null,
        sourceMonths: [],
        targetMonth: "2026-04",
      },
      initialDocument: {
        items: [
          {
            currency: "ARS",
            description: "Internet",
            folders: {
              allReceiptsFolderId: "folder-all",
              allReceiptsFolderStatus: "normal",
              allReceiptsFolderViewUrl: "https://example.com/all",
              monthlyFolderId: "folder-monthly",
              monthlyFolderStatus: undefined,
              monthlyFolderViewUrl: "https://example.com/monthly",
            },
            id: "expense-1",
            occurrencesPerMonth: 1,
            receipts: [],
            subtotal: 100,
            total: 100,
          },
        ],
        month: "2026-04",
      },
      initialLendersCatalog: {
        lenders: [],
      },
      initialLoansReport: {
        entries: [],
        summary: {
          activeLoanCount: 0,
          lenderCount: 0,
          netRemainingAmount: 0,
        payableRemainingAmount: 0,
        receivableRemainingAmount: 0,
        remainingAmount: 0,
          trackedLoanCount: 0,
        },
      },
      lendersLoadErrorCode: null,
      lendersLoadError: null,
      loadErrorCode: null,
      loadError: null,
      reportLoadErrorCode: null,
      reportLoadError: null,
    };

    const serializedProps = toSerializableMonthlyExpensesPageProps(props);
    const itemFolders = serializedProps.initialDocument.items[0]?.folders;

    expect(itemFolders).toEqual({
      allReceiptsFolderId: "folder-all",
      allReceiptsFolderStatus: "normal",
      allReceiptsFolderViewUrl: "https://example.com/all",
      monthlyFolderId: "folder-monthly",
      monthlyFolderViewUrl: "https://example.com/monthly",
    });
    expect(itemFolders).not.toHaveProperty("monthlyFolderStatus");
  });
});

describe("getMonthlyExpensesServerSidePropsForTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStorageBootstrap.mockReturnValue({
      architecture: {
        dataStrategy: "ssr-first",
        middleendLocation: "src/modules",
        routing: "app-router",
      },
      authStatus: "configured",
      requiredScopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file",
      ],
      storageTargets: [],
    });
    mockCreateRequestLogContext.mockReturnValue({
      requestId: "request-id",
    });
    mockGetAuthenticatedUserSubjectFromRequest.mockResolvedValue("subject-1");
    mockCreateMigratedTursoDatabase.mockResolvedValue({});
    mockGetGoogleDriveClientFromRequest.mockResolvedValue({});
    mockCreateGetMonthlyExchangeRateSnapshot.mockReturnValue(jest.fn());
    mockGetMonthlyExpensesDocument.mockResolvedValue({
      items: [],
      month: "2026-04",
    });
    mockGetLendersCatalog.mockResolvedValue({
      lenders: [],
    });
    mockGetMonthlyExpensesLoansReport.mockResolvedValue({
      entries: [],
      summary: {
        activeLoanCount: 0,
        lenderCount: 0,
        netRemainingAmount: 0,
        payableRemainingAmount: 0,
        receivableRemainingAmount: 0,
        remainingAmount: 0,
        trackedLoanCount: 0,
      },
    });
    mockGetMonthlyExpensesCopyableMonths.mockResolvedValue({
      defaultSourceMonth: null,
      sourceMonths: [],
      targetMonth: "2026-04",
    });
  });

  it("loads document without Drive statuses and without loans report on non-debts tabs", async () => {
    const result = await getMonthlyExpensesServerSidePropsForTab(
      createServerSideContext("2026-04"),
      "expenses",
    );

    expect(result.props.initialDocument.month).toBe("2026-04");
    expect(mockGetMonthlyExpensesDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          includeDriveStatuses: false,
          month: "2026-04",
        },
      }),
    );
    expect(mockGetLendersCatalog).toHaveBeenCalledTimes(1);
    expect(mockGetMonthlyExpensesLoansReport).not.toHaveBeenCalled();
  });

  it("computes loans report on debts tab reusing lenders catalog result", async () => {
    await getMonthlyExpensesServerSidePropsForTab(
      createServerSideContext("2026-04"),
      "debts",
    );

    expect(mockGetLendersCatalog).toHaveBeenCalledTimes(1);
    expect(mockGetMonthlyExpensesLoansReport).toHaveBeenCalledTimes(1);
    expect(mockGetMonthlyExpensesLoansReport).toHaveBeenCalledWith(
      expect.objectContaining({
        lenders: [],
      }),
    );
  });

  it("renders empty unauthenticated state when Google session is missing", async () => {
    mockGetAuthenticatedUserSubjectFromRequest.mockRejectedValue(
      new GoogleOAuthAuthenticationError(
        "authenticated-user-subject:request requires an authenticated Google session.",
      ),
    );

    const result = await getMonthlyExpensesServerSidePropsForTab(
      createServerSideContext("2026-04"),
      "expenses",
    );

    expect(result.props.initialDocument).toEqual({
      exchangeRateLoadError: null,
      exchangeRateSnapshot: null,
      items: [],
      month: "2026-04",
    });
    expect(result.props.loadError).toBeNull();
    expect(result.props.loadErrorCode).toBeNull();
    expect(mockCreateMigratedTursoDatabase).not.toHaveBeenCalled();
  });
});
