import { render, screen, within } from "@testing-library/react";
import type { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { useSession } from "next-auth/react";
import type { ReactElement } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";

export const SIDEBAR_STORAGE_KEY = "control-mensual.sidebar.open";
export const TABLE_PREFERENCES_STORAGE_KEY =
  "control-mensual.monthly-expenses.table-preferences";

export const bootstrap: StorageBootstrapResult = {
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
};

export const basePageProps = {
  bootstrap,
  initialCopyableMonths: {
    defaultSourceMonth: null,
    sourceMonths: [],
    targetMonth: "2026-03",
  },
  initialLendersCatalog: {
    lenders: [],
  },
  initialLoansReport: {
    entries: [],
    summary: {
      activeLoanCount: 0,
      lenderCount: 0,
      remainingAmount: 0,
      trackedLoanCount: 0,
    },
  },
  lendersLoadErrorCode: null,
  lendersLoadError: null,
  loadErrorCode: null,
  loadError: null,
  initialActiveTab: "expenses" as const,
  reportLoadErrorCode: null,
  reportLoadError: null,
};

type MockMonthlyExpensesRouter = ReturnType<typeof useRouter> & {
  isReady: boolean;
  pathname: string;
  query: Record<string, string | string[] | undefined>;
};

let currentMonthlyExpensesRouter: MockMonthlyExpensesRouter | null = null;

function syncCurrentMonthlyExpensesRouterWithUrl(url: string | URL | null | undefined) {
  if (!url || !currentMonthlyExpensesRouter) {
    return;
  }

  const nextUrl = new URL(String(url), window.location.href);

  currentMonthlyExpensesRouter.pathname = nextUrl.pathname;
  currentMonthlyExpensesRouter.query = Object.fromEntries(
    nextUrl.searchParams.entries(),
  );
}

function createReadonlySearchParams(
  query: Record<string, string | string[] | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        searchParams.append(key, entry);
      });
      return;
    }

    if (value !== undefined) {
      searchParams.set(key, value);
    }
  });

  return {
    get: (name: string) => searchParams.get(name),
    toString: () => searchParams.toString(),
  } as ReturnType<typeof useSearchParams>;
}

export function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

export function createMockRouter(
  overrides?: Partial<{
    isReady: boolean;
    pathname: string;
    push: jest.Mock;
    query: Record<string, string | string[] | undefined>;
    replace: jest.Mock;
  }>,
) {
  const router: MockMonthlyExpensesRouter = {
    back: jest.fn(),
    forward: jest.fn(),
    isReady: true,
    pathname: "/gastos",
    prefetch: jest.fn(),
    query: {},
    refresh: jest.fn(),
    push: jest.fn().mockImplementation(async (nextRoute: unknown) => {
      if (typeof nextRoute === "string") {
        const url = new URL(nextRoute, "http://localhost");
        router.pathname = url.pathname;
        router.query = Object.fromEntries(url.searchParams.entries());

        return true;
      }

      if (
        typeof nextRoute === "object" &&
        nextRoute !== null &&
        "pathname" in nextRoute &&
        typeof nextRoute.pathname === "string"
      ) {
        router.pathname = nextRoute.pathname;
      }

      if (
        typeof nextRoute === "object" &&
        nextRoute !== null &&
        "query" in nextRoute &&
        typeof nextRoute.query === "object" &&
        nextRoute.query !== null
      ) {
        router.query = nextRoute.query as Record<string, string | string[] | undefined>;
      }

      return true;
    }),
    replace: jest.fn().mockImplementation(async (nextRoute: unknown) => {
      if (typeof nextRoute === "string") {
        const url = new URL(nextRoute, "http://localhost");
        router.pathname = url.pathname;
        router.query = Object.fromEntries(url.searchParams.entries());

        return true;
      }

      if (
        typeof nextRoute === "object" &&
        nextRoute !== null &&
        "pathname" in nextRoute &&
        typeof nextRoute.pathname === "string"
      ) {
        router.pathname = nextRoute.pathname;
      }

      if (
        typeof nextRoute === "object" &&
        nextRoute !== null &&
        "query" in nextRoute &&
        typeof nextRoute.query === "object" &&
        nextRoute.query !== null
      ) {
        router.query = nextRoute.query as Record<string, string | string[] | undefined>;
      }

      return true;
    }),
  };

  currentMonthlyExpensesRouter = Object.assign(router, overrides);

  return currentMonthlyExpensesRouter;
}

export function createMonthlyExpensesFetchMock(overrides?: {
  copyableMonths?: {
    defaultSourceMonth: string | null;
    sourceMonths: string[];
    targetMonth: string;
  };
  monthlyDocument?: {
    items: Array<Record<string, unknown>>;
    month: string;
  };
  reportEntries?: Array<Record<string, unknown>>;
  saveError?: string;
  saveResponse?: {
    body: Record<string, unknown>;
    status: number;
  };
}) {
  return jest.fn().mockImplementation(async (input: RequestInfo | URL) => {
    if (input === "/api/storage/monthly-expenses") {
      if (overrides?.saveError) {
        return {
          json: async () => ({
            error: overrides.saveError,
          }),
          ok: false,
          status: 500,
        };
      }

      if (overrides?.saveResponse) {
        return {
          json: async () => overrides.saveResponse?.body,
          ok: true,
          status: overrides.saveResponse.status,
        };
      }

      return {
        ok: true,
        status: 204,
      };
    }

    if (
      typeof input === "string" &&
      input.startsWith("/api/storage/monthly-expenses?")
    ) {
      return {
        json: async () => ({
          data: overrides?.monthlyDocument ?? {
            items: [],
            month: "2026-03",
          },
        }),
        ok: true,
      };
    }

    if (
      typeof input === "string" &&
      input.startsWith("/api/storage/monthly-expenses-copyable-months?")
    ) {
      return {
        json: async () => ({
          data: overrides?.copyableMonths ?? {
            defaultSourceMonth: null,
            sourceMonths: [],
            targetMonth: "2026-03",
          },
        }),
        ok: true,
      };
    }

    if (input === "/api/storage/monthly-expenses-report") {
      return {
        json: async () => ({
          data: {
            entries: overrides?.reportEntries ?? [],
            summary: {
              activeLoanCount: 0,
              lenderCount: 0,
              remainingAmount: 0,
              trackedLoanCount: 0,
            },
          },
        }),
        ok: true,
      };
    }

    throw new Error(`Unexpected fetch input: ${String(input)}`);
  });
}

export function getMonthlyExpensesSavePayload(fetchMock: jest.Mock) {
  const saveCall = fetchMock.mock.calls.find(
    ([url]) => url === "/api/storage/monthly-expenses",
  );

  expect(saveCall).toBeDefined();

  const [, options] = saveCall as [string, RequestInit];
  const headers = new Headers(options.headers);

  expect(options).toEqual(
    expect.objectContaining({
      method: "POST",
    }),
  );
  expect(headers.get("Content-Type")).toBe("application/json");

  return JSON.parse(String(options.body));
}

export function createDeferredValue<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

export function getMonthlyExpensesDescriptionsOrder(): Array<string | null> {
  const table = getMonthlyExpensesTable();

  if (!table) {
    return [];
  }

  const tableBody = table.querySelector("tbody");

  if (!tableBody) {
    return [];
  }

  return within(tableBody)
    .getAllByRole("row")
    .map((row) => {
      const rowCells = within(row).getAllByRole("cell");

      for (const rowCell of rowCells) {
        const rowCellText = rowCell.textContent?.trim() ?? "";

        if (rowCellText.length > 0) {
          return rowCellText;
        }
      }

      return null;
    });
}

export function getMonthlyExpensesTable(): HTMLElement | undefined {
  return screen.getAllByRole("table").find((currentTable) =>
    within(currentTable).queryByRole("columnheader", { name: /Descripción/i }),
  );
}

export function getPersistedTablePreferences():
  | {
      columnVisibility: Record<string, boolean>;
      loanSortMode: string;
      moveCompletedToEnd?: boolean;
      sorting: Array<{ desc: boolean; id: string }>;
    }
  | null {
  const serializedPreferences = window.localStorage.getItem(
    TABLE_PREFERENCES_STORAGE_KEY,
  );

  if (!serializedPreferences) {
    return null;
  }

  return JSON.parse(serializedPreferences) as {
    columnVisibility: Record<string, boolean>;
    loanSortMode: string;
    moveCompletedToEnd?: boolean;
    sorting: Array<{ desc: boolean; id: string }>;
  };
}

type RegisterDefaultHooksOptions = {
  createDefaultRouter: () => MockMonthlyExpensesRouter;
  mockedUsePathname: jest.MockedFunction<typeof usePathname>;
  mockedSignIn: jest.Mock;
  mockedSignOut: jest.Mock;
  mockedToast: jest.Mock & {
    error: jest.Mock;
    info: jest.Mock;
    promise: jest.Mock;
    success: jest.Mock;
    warning: jest.Mock;
  };
  mockedUseRouter: jest.MockedFunction<typeof useRouter>;
  mockedUseSearchParams: jest.MockedFunction<typeof useSearchParams>;
  mockedUseSession: jest.MockedFunction<typeof useSession>;
  originalFetch: typeof fetch;
};

export function registerMonthlyExpensesPageDefaultHooks(
  options: RegisterDefaultHooksOptions,
) {
  beforeEach(() => {
    if (typeof HTMLElement !== "undefined") {
      if (!HTMLElement.prototype.hasPointerCapture) {
        Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
          configurable: true,
          value: () => false,
        });
      }

      if (!HTMLElement.prototype.setPointerCapture) {
        Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
          configurable: true,
          value: () => undefined,
        });
      }

      if (!HTMLElement.prototype.releasePointerCapture) {
        Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
          configurable: true,
          value: () => undefined,
        });
      }
    }

    if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        value: () => undefined,
      });
    }

    options.mockedSignIn.mockReset();
    options.mockedSignOut.mockReset();
    options.mockedToast.mockReset();
    options.mockedToast.error.mockReset();
    options.mockedToast.info.mockReset();
    options.mockedToast.promise.mockReset();
    options.mockedToast.success.mockReset();
    options.mockedToast.warning.mockReset();
    options.mockedUsePathname.mockImplementation(
      () => currentMonthlyExpensesRouter?.pathname ?? "/gastos",
    );
    options.mockedUseRouter.mockReturnValue(options.createDefaultRouter());
    options.mockedUseSearchParams.mockImplementation(() =>
      createReadonlySearchParams(currentMonthlyExpensesRouter?.query ?? {}),
    );
    options.mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    });
    global.fetch = jest.fn();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/gastos");
    jest
      .spyOn(window.history, "pushState")
      .mockImplementation((state, unused, url) => {
        History.prototype.pushState.call(window.history, state, unused, url);
        syncCurrentMonthlyExpensesRouterWithUrl(url);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = options.originalFetch;
  });
}
