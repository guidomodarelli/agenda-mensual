import { AlertTriangle, CircleX } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import styles from "./drive-status-badge.module.scss";
import type { MonthlyExpenseDriveResourceStatus } from "./monthly-expenses-table.types";

function getDriveStatusMessage(
  status: MonthlyExpenseDriveResourceStatus | undefined,
): string | null {
  if (status === "trashed") {
    return "Este recurso está en la papelera de Drive.";
  }

  if (status === "missing") {
    return "Este recurso fue eliminado en Drive.";
  }

  return null;
}

/**
 * Renders a warning/error tooltip badge when a Drive resource is trashed or
 * missing, and nothing when the resource is healthy.
 *
 * @param props - Component props.
 * @param props.status - Drive resource status for the related entity.
 */
export function DriveStatusBadge({
  status,
}: {
  status: MonthlyExpenseDriveResourceStatus | undefined;
}) {
  const message = getDriveStatusMessage(status);

  if (!message || !status) {
    return null;
  }

  const icon =
    status === "trashed" ? (
      <AlertTriangle aria-hidden="true" className={styles.driveStatusWarning} />
    ) : (
      <CircleX aria-hidden="true" className={styles.driveStatusError} />
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={styles.driveStatusBadge}>{icon}</span>
      </TooltipTrigger>
      <TooltipContent>{message}</TooltipContent>
    </Tooltip>
  );
}
