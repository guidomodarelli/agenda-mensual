"use client";

/** Adapts shared navigation to the existing application preference contract. */
import { SidebarProvider } from "beez-ui";
import { useState, type ReactNode } from "react";

import { SIDEBAR_STATE_COOKIE_NAME } from "@/modules/shared/shared/constants/sidebar";

/** Retains the existing thirty-day server preference lifetime, in seconds. */
const SIDEBAR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Preserves browser storage and the SSR cookie; widths come from the shared sidebar.
 * @param props - Server preference and application content.
 * @returns The shared sidebar context configured for Control Mensual.
 */
export function FinanceSidebarProvider({ children, defaultOpen }: {
  children: ReactNode;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState<boolean | undefined>(undefined);

  /**
   * Persists the legacy cookie while retaining usable navigation if cookies are blocked.
   * @param nextOpen - Whether the desktop sidebar should remain expanded.
   */
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    try {
      document.cookie = `${SIDEBAR_STATE_COOKIE_NAME}=${nextOpen}; Path=/; Max-Age=${SIDEBAR_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    } catch {
      // Browser privacy policies must not prevent toggling the current sidebar.
    }
  }

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={handleOpenChange}
      storageKey={SIDEBAR_STATE_COOKIE_NAME}
    >
      {children}
    </SidebarProvider>
  );
}
