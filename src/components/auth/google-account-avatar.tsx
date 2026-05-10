import { PlusIcon } from "lucide-react";

import { AccountMenu } from "@/components/auth/account-menu";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type GoogleAccountAvatarStatus = "authenticated" | "loading" | "unauthenticated";

interface GoogleAccountAvatarProps {
  onConnect: () => void;
  onDisconnect: () => void;
  status: GoogleAccountAvatarStatus;
  userEmail?: string | null;
  userImage: string | null;
  userName: string | null;
}

function getUserInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart.charAt(0).toUpperCase())
    .join("");

  return initials || "CM";
}

export function GoogleAccountAvatar({
  onConnect,
  onDisconnect,
  status,
  userEmail,
  userImage,
  userName,
}: GoogleAccountAvatarProps) {
  const accountName = userName ?? "Incógnito";
  const accountEmail = userEmail?.trim() || "Sin cuenta";
  const initials = getUserInitials(accountName);
  const tooltipStatusLabel =
    status === "authenticated"
      ? "Google conectado"
      : status === "loading"
        ? "Verificando conexion de Google"
        : "Sin sesión";

  if (status === "loading") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Verificando sesión de Google"
            disabled
            type="button"
          >
            <Avatar className="grayscale">
              {userImage ? <AvatarImage alt={accountName} src={userImage} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
              <AvatarBadge>
                <PlusIcon />
              </AvatarBadge>
            </Avatar>
          </button>
        </TooltipTrigger>
        <TooltipContent className="mr-2" side="bottom" sideOffset={8}>
          {tooltipStatusLabel}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <AccountMenu
      accountEmail={accountEmail}
      accountName={accountName}
      align="end"
      classNames={{
        triggerAvatar: status === "authenticated" ? undefined : "grayscale",
        connectedBadge: "bg-green-600 dark:bg-green-800",
      }}
      menuClassName="w-72 overflow-hidden rounded-2xl p-0"
      onSignIn={onConnect}
      onSignOut={onDisconnect}
      status={status}
      tooltipLabel={tooltipStatusLabel}
      triggerAriaLabel={
        status === "authenticated"
          ? "Cuenta de Google conectada"
          : "Conectar cuenta de Google"
      }
      triggerVariant="avatar"
      userImage={userImage}
    />
  );
}
