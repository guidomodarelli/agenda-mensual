"use client";

import {
  Link,
  AnimatedThemeToggler,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  buttonVariants,
  AccountMenu,
} from "beez-ui";

import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  IconBuildingBank,
  IconCalendarDollar,
  IconCashBanknote,
  IconReportMoney,
} from "@tabler/icons-react";

import { GoogleAccountAvatar } from "@/components/auth/google-account-avatar";
import { PwaUpdateControl } from "@/components/pwa/pwa-update-control";

import { FinanceSidebarProvider } from "./finance-sidebar-provider";

import styles from "./finance-app-shell.module.scss";

export type FinanceAppSectionKey =
  | "expenses"
  | "exchange-rates"
  | "lenders"
  | "debts";

interface FinanceAppShellProps {
  children: ReactNode;
  initialSidebarOpen?: boolean;
  isOAuthConfigured: boolean;
}

interface FinanceAppShellNavigationOverrides {
  activeSection?: FinanceAppSectionKey;
  expensesMonth?: string;
}

interface FinanceAppShellNavigationContextValue {
  clearNavigationOverrides: () => void;
  navigationOverrides: FinanceAppShellNavigationOverrides;
  setNavigationOverrides: (overrides: FinanceAppShellNavigationOverrides) => void;
}

const DEFAULT_FINANCE_APP_SECTION: FinanceAppSectionKey = "expenses";
const FINANCE_APP_SECTION_BY_PATH_PREFIX: Array<{
  pathPrefix: string;
  section: FinanceAppSectionKey;
}> = [
  {
    pathPrefix: "/cotizaciones",
    section: "exchange-rates",
  },
  {
    pathPrefix: "/prestamistas",
    section: "lenders",
  },
  {
    pathPrefix: "/reportes/deudas",
    section: "debts",
  },
  {
    pathPrefix: "/gastos",
    section: "expenses",
  },
];

const FinanceAppShellNavigationContext =
  createContext<FinanceAppShellNavigationContextValue>({
    clearNavigationOverrides: () => undefined,
    navigationOverrides: {},
    setNavigationOverrides: () => undefined,
  });

function getActiveSectionFromPathname(pathname: string | null): FinanceAppSectionKey {
  const matchingSection = FINANCE_APP_SECTION_BY_PATH_PREFIX.find(({ pathPrefix }) =>
    pathname?.startsWith(pathPrefix),
  );

  return matchingSection?.section ?? DEFAULT_FINANCE_APP_SECTION;
}

function getAuthRedirectPath(
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams>,
): string {
  const normalizedPathname = pathname?.trim() || "/";

  if (normalizedPathname.startsWith("/auth/")) {
    return "/";
  }

  const serializedSearchParams = searchParams?.toString();

  return serializedSearchParams
    ? `${normalizedPathname}?${serializedSearchParams}`
    : normalizedPathname;
}

function getSignInPath(callbackUrl: string): string {
  return `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Publishes page-local navigation state to the global app shell.
 *
 * @param overrides - Navigation values that cannot be derived from the URL alone.
 */
export function useFinanceAppShellNavigation(
  {
    activeSection,
    expensesMonth,
  }: FinanceAppShellNavigationOverrides,
) {
  const { clearNavigationOverrides, setNavigationOverrides } = useContext(
    FinanceAppShellNavigationContext,
  );

  useEffect(() => {
    setNavigationOverrides({
      activeSection,
      expensesMonth,
    });

    return () => {
      clearNavigationOverrides();
    };
  }, [
    activeSection,
    clearNavigationOverrides,
    expensesMonth,
    setNavigationOverrides,
  ]);
}

interface FinanceAppShellSidebarNavigationProps {
  activeSection: FinanceAppSectionKey;
  expensesHref: ComponentProps<typeof Link>["href"];
}

/** Collapsed-rail utility: hides product text once the desktop sidebar shrinks to icons. */
const SIDEBAR_COLLAPSED_HIDDEN_CLASS = "group-data-[state=collapsed]/sidebar:hidden";

/**
 * Section links of the sidebar. The shared menu buttons route through the
 * BeezUIProvider link adapter and close the mobile sheet once selected.
 */
function FinanceAppShellSidebarNavigation({
  activeSection,
  expensesHref,
}: FinanceAppShellSidebarNavigationProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Secciones</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            href={expensesHref}
            icon={<IconCalendarDollar />}
            isActive={activeSection === "expenses"}
          >
            Control mensual
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            href="/cotizaciones"
            icon={<IconCashBanknote />}
            isActive={activeSection === "exchange-rates"}
          >
            Cotizaciones del dólar
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            href="/prestamistas"
            icon={<IconBuildingBank />}
            isActive={activeSection === "lenders"}
          >
            Prestamistas
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            href="/reportes/deudas"
            icon={<IconReportMoney />}
            isActive={activeSection === "debts"}
          >
            Reporte de deudas
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

export function FinanceAppShell({
  children,
  initialSidebarOpen = true,
  isOAuthConfigured,
}: FinanceAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [navigationOverrides, updateNavigationOverrides] =
    useState<FinanceAppShellNavigationOverrides>({});
  const setNavigationOverrides = useCallback(
    (overrides: FinanceAppShellNavigationOverrides) => {
      updateNavigationOverrides(overrides);
    },
    [],
  );
  const clearNavigationOverrides = useCallback(() => {
    updateNavigationOverrides({});
  }, []);
  const navigationContextValue = useMemo(
    () => ({
      clearNavigationOverrides,
      navigationOverrides,
      setNavigationOverrides,
    }),
    [
      clearNavigationOverrides,
      navigationOverrides,
      setNavigationOverrides,
    ],
  );
  const activeSection =
    navigationOverrides.activeSection ?? getActiveSectionFromPathname(pathname);
  const expensesMonth = navigationOverrides.expensesMonth;
  const authRedirectPath = getAuthRedirectPath(pathname, searchParams);
  const sessionUserImage = session?.user?.image?.trim() || null;
  const sessionUserName = session?.user?.name?.trim() || "Incógnito";
  const sessionUserEmail = session?.user?.email?.trim() || "Sin cuenta";

  const handleGoogleAccountConnect = () => {
    if (!isOAuthConfigured) {
      router.push(getSignInPath(authRedirectPath));
      return;
    }

    void signIn("google", {
      callbackUrl: authRedirectPath,
    });
  };

  const handleGoogleAccountDisconnect = () => {
    void signOut({
      callbackUrl: authRedirectPath,
    });
  };

  const expensesHref = expensesMonth
    ? `/gastos?${new URLSearchParams({ month: expensesMonth })}`
    : "/gastos";

  return (
    <FinanceAppShellNavigationContext.Provider value={navigationContextValue}>
      <FinanceSidebarProvider defaultOpen={initialSidebarOpen}>
        <Sidebar collapsible="icon" variant="sidebar">
          <SidebarHeader>
            <div className={styles.sidebarBrand}>
              <span
                className={styles.sidebarBrandIcon}
                aria-hidden="true"
              >
                <Image
                  alt=""
                  className={styles.sidebarBrandImage}
                  height={192}
                  priority
                  src="/icons/icon-192x192.png"
                  width={192}
                />
              </span>
              <div
                className={`${styles.sidebarBrandText} ${SIDEBAR_COLLAPSED_HIDDEN_CLASS}`}
              >
                <p className={styles.sidebarTitle}>Control Mensual</p>
                <p className={styles.sidebarSubtitle}>Panel de trabajo</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <FinanceAppShellSidebarNavigation
              activeSection={activeSection}
              expensesHref={expensesHref}
            />
          </SidebarContent>
          <SidebarFooter>
            <AccountMenu
              name={sessionUserName}
              email={sessionUserEmail}
              image={sessionUserImage}
              status={status === "authenticated" ? "authenticated" : "unauthenticated"}
              triggerVariant="sidebar"
              showStatusBadge
              align="end"
              side="right"
              sideOffset={8}
              labels={{ trigger: "Cuenta activa" }}
              classNames={{
                trigger: `${styles.sidebarAccount} group-data-[state=collapsed]/sidebar:grid-cols-[2rem] group-data-[state=collapsed]/sidebar:gap-0`,
                triggerAvatar: styles.sidebarAccountAvatar,
                triggerText: `${styles.sidebarAccountText} ${SIDEBAR_COLLAPSED_HIDDEN_CLASS}`,
                triggerName: styles.sidebarAccountName,
                triggerEmail: styles.sidebarAccountEmail,
                triggerChevron: `${styles.sidebarAccountChevron} ${SIDEBAR_COLLAPSED_HIDDEN_CLASS}`,
                connectedBadge: styles.sidebarAccountConnectedBadge,
                disconnectedBadge: styles.sidebarAccountDisconnectedBadge,
                content: styles.sidebarAccountMenu,
                header: styles.sidebarAccountMenuHeader,
                headerAvatar: styles.sidebarAccountMenuAvatar,
                item: styles.sidebarAccountMenuItem,
              }}
              onSignIn={handleGoogleAccountConnect}
              onSignOut={handleGoogleAccountDisconnect}
            />
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <main className={styles.page}>
            <div className={styles.layout}>
              <div className={styles.topBar}>
                <SidebarTrigger
                  aria-label="Abrir menu lateral"
                  className={styles.mobileSidebarTrigger}
                />
                <PwaUpdateControl />
                <AnimatedThemeToggler
                  aria-label="Alternar tema"
                  className={buttonVariants({
                    size: "icon-sm",
                    variant: "ghost",
                  })}
                />
                <GoogleAccountAvatar
                  onConnect={handleGoogleAccountConnect}
                  onDisconnect={handleGoogleAccountDisconnect}
                  status={status}
                  userEmail={sessionUserEmail}
                  userImage={sessionUserImage}
                  userName={sessionUserName}
                />
              </div>
              {children}
            </div>
          </main>
        </SidebarInset>
      </FinanceSidebarProvider>
    </FinanceAppShellNavigationContext.Provider>
  );
}
