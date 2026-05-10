import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  IconBuildingBank,
  IconCalendarDollar,
  IconCashBanknote,
  IconChevronDown,
  IconLogout,
  IconReportMoney,
  IconWallet,
} from "@tabler/icons-react";

import { GoogleAccountAvatar } from "@/components/auth/google-account-avatar";
import { PwaUpdateControl } from "@/components/pwa/pwa-update-control";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  activeSection: FinanceAppSectionKey;
  authRedirectPath: string;
  children: ReactNode;
  expensesMonth?: string;
  initialSidebarOpen?: boolean;
  isOAuthConfigured: boolean;
}

export function FinanceAppShell({
  activeSection,
  authRedirectPath,
  children,
  expensesMonth,
  initialSidebarOpen = true,
  isOAuthConfigured,
}: FinanceAppShellProps) {
  const { data: session, status } = useSession();
  const sessionUserImage = session?.user?.image?.trim() || null;
  const sessionUserName = session?.user?.name?.trim() || null;
  const sessionUserEmail = session?.user?.email?.trim() || "Sin cuenta de Google";
  const topBarStickySentinelRef = useRef<HTMLDivElement | null>(null);
  const [isTopBarStuck, setIsTopBarStuck] = useState(false);

  useEffect(() => {
    const sentinel = topBarStickySentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTopBarStuck(!entry.isIntersecting);
      },
      {
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleGoogleAccountConnect = () => {
    if (!isOAuthConfigured) {
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
    <SidebarProvider defaultOpen={initialSidebarOpen}>
      <Sidebar className={styles.sidebarShell} collapsible="icon" variant="sidebar">
        <SidebarHeader className={styles.sidebarHeader}>
          <div
            className={`${styles.sidebarBrand} group-data-[collapsible=icon]:grid-cols-[2rem] group-data-[collapsible=icon]:gap-0`}
          >
            <span
              className={`${styles.sidebarBrandIcon} group-data-[collapsible=icon]:hidden`}
              aria-hidden="true"
            >
              <IconWallet />
            </span>
            <div
              className={`${styles.sidebarBrandText} group-data-[collapsible=icon]:hidden`}
            >
              <p className={styles.sidebarTitle}>Control Mensual</p>
              <p className={styles.sidebarSubtitle}>Panel de trabajo</p>
            </div>
            <SidebarTrigger className={styles.sidebarHeaderTrigger} />
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Cuenta activa"
                className={`${styles.sidebarAccount} group-data-[collapsible=icon]:grid-cols-[2rem] group-data-[collapsible=icon]:gap-0`}
                type="button"
              >
                <Avatar className={styles.sidebarAccountAvatar}>
                  {sessionUserImage ? (
                    <AvatarImage
                      alt={sessionUserName ?? "Cuenta de Google"}
                      src={sessionUserImage}
                    />
                  ) : null}
                  <AvatarFallback>
                    {sessionUserName
                      ?.split(/\s+/)
                      .slice(0, 2)
                      .map((namePart) => namePart.charAt(0).toUpperCase())
                      .join("") || "CM"}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`${styles.sidebarAccountText} group-data-[collapsible=icon]:hidden`}
                >
                  <span className={styles.sidebarAccountName}>
                    {sessionUserName ?? "Control Mensual"}
                  </span>
                  <span className={styles.sidebarAccountEmail}>{sessionUserEmail}</span>
                </span>
                <IconChevronDown
                  className={`${styles.sidebarAccountChevron} group-data-[collapsible=icon]:hidden`}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={styles.sidebarAccountMenu}
              side="right"
              sideOffset={8}
            >
              <div className={styles.sidebarAccountMenuHeader}>
                <Avatar className={styles.sidebarAccountMenuAvatar}>
                  {sessionUserImage ? (
                    <AvatarImage
                      alt={sessionUserName ?? "Cuenta de Google"}
                      src={sessionUserImage}
                    />
                  ) : null}
                  <AvatarFallback>
                    {sessionUserName
                      ?.split(/\s+/)
                      .slice(0, 2)
                      .map((namePart) => namePart.charAt(0).toUpperCase())
                      .join("") || "CM"}
                  </AvatarFallback>
                </Avatar>
                <span className={styles.sidebarAccountMenuText}>
                  <span className={styles.sidebarAccountMenuName}>
                    {sessionUserName ?? "Control Mensual"}
                  </span>
                  <span className={styles.sidebarAccountMenuEmail}>
                    {sessionUserEmail}
                  </span>
                </span>
              </div>
              <DropdownMenuSeparator className={styles.sidebarAccountMenuSeparator} />
              <DropdownMenuItem
                className={styles.sidebarAccountMenuItem}
                onSelect={(event) => {
                  event.preventDefault();
                  handleGoogleAccountDisconnect();
                }}
              >
                <IconLogout />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <main className={styles.page}>
          <div className={styles.layout}>
            <div
              aria-hidden="true"
              className={styles.topBarStickySentinel}
              ref={topBarStickySentinelRef}
            />
            <div
              className={`${styles.topBar} ${isTopBarStuck ? styles.topBarStuck : ""}`.trim()}
            >
              <SidebarTrigger
                aria-label="Abrir menu lateral"
                className={styles.mobileSidebarTrigger}
              />
              <PwaUpdateControl />
              <AnimatedThemeToggler
                aria-label="Alternar tema"
                className={buttonVariants({
                  size: "icon-sm",
                  variant: "outline",
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
  );
}
