"use client";

import Link from "next/link";
import Image from "next/image";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

import { AccountMenu } from "@/components/auth/account-menu";
import { GoogleAccountAvatar } from "@/components/auth/google-account-avatar";
import { PwaUpdateControl } from "@/components/pwa/pwa-update-control";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { buttonVariants } from "@/components/ui/button";
import {
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
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

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
    ? {
        pathname: "/gastos",
        query: {
          month: expensesMonth,
        },
      }
    : "/gastos";

  return (
    <FinanceAppShellNavigationContext.Provider value={navigationContextValue}>
      <SidebarProvider defaultOpen={initialSidebarOpen}>
        <Sidebar className={styles.sidebarShell} collapsible="icon" variant="sidebar">
          <SidebarHeader className={styles.sidebarHeader}>
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
                className={`${styles.sidebarBrandText} group-data-[collapsible=icon]:hidden`}
              >
                <p className={styles.sidebarTitle}>Control Mensual</p>
                <p className={styles.sidebarSubtitle}>Panel de trabajo</p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className={styles.sidebarGroup}>
              <SidebarGroupLabel className={styles.sidebarGroupLabel}>Secciones</SidebarGroupLabel>
              <SidebarMenu className={styles.sidebarMenu}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={styles.sidebarMenuButton}
                    isActive={activeSection === "expenses"}
                    tooltip="Control mensual"
                  >
                    <Link href={expensesHref}>
                      <IconCalendarDollar />
                      <span>Control mensual</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={styles.sidebarMenuButton}
                    isActive={activeSection === "exchange-rates"}
                    tooltip="Cotizaciones del dólar"
                  >
                    <Link href="/cotizaciones">
                      <IconCashBanknote />
                      <span>Cotizaciones del dólar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={styles.sidebarMenuButton}
                    isActive={activeSection === "lenders"}
                    tooltip="Prestamistas"
                  >
                    <Link href="/prestamistas">
                      <IconBuildingBank />
                      <span>Prestamistas</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={styles.sidebarMenuButton}
                    isActive={activeSection === "debts"}
                    tooltip="Reporte de deudas"
                  >
                    <Link href="/reportes/deudas">
                      <IconReportMoney />
                      <span>Reporte de deudas</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className={styles.sidebarFooter}>
            <AccountMenu
              accountEmail={sessionUserEmail}
              accountName={sessionUserName}
              align="end"
              classNames={{
                trigger: `${styles.sidebarAccount} group-data-[collapsible=icon]:grid-cols-[2rem] group-data-[collapsible=icon]:gap-0`,
                triggerAvatar: styles.sidebarAccountAvatar,
                triggerText: `${styles.sidebarAccountText} group-data-[collapsible=icon]:hidden`,
                triggerName: styles.sidebarAccountName,
                triggerEmail: styles.sidebarAccountEmail,
                triggerChevron: `${styles.sidebarAccountChevron} group-data-[collapsible=icon]:hidden`,
                connectedBadge: styles.sidebarAccountConnectedBadge,
                disconnectedBadge: styles.sidebarAccountDisconnectedBadge,
              }}
              menuClassName={styles.sidebarAccountMenu}
              onSignIn={handleGoogleAccountConnect}
              onSignOut={handleGoogleAccountDisconnect}
              side="right"
              sideOffset={8}
              status={status === "authenticated" ? "authenticated" : "unauthenticated"}
              triggerAriaLabel="Cuenta activa"
              triggerVariant="sidebar"
              userImage={sessionUserImage}
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
      </SidebarProvider>
    </FinanceAppShellNavigationContext.Provider>
  );
}
