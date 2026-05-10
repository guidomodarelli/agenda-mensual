import { LogOutIcon, PlusIcon } from "lucide-react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function getUserInitials(name: string | null): string {
  if (!name) {
    return "GG";
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "GG";
}

export function GoogleAccountAvatar({
  onConnect,
  onDisconnect,
  status,
  userEmail,
  userImage,
  userName,
}: GoogleAccountAvatarProps) {
  const initials = getUserInitials(userName);
  const accountName = userName ?? "Control Mensual";
  const accountEmail = userEmail?.trim() || "Sin cuenta de Google";
  const tooltipStatusLabel =
    status === "authenticated"
      ? "Google conectado"
      : status === "loading"
        ? "Verificando conexion de Google"
        : "Google desconectado";

  if (status === "authenticated") {
    return (
      <Tooltip>
        <DropdownMenu>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Cuenta de Google conectada"
                type="button"
              >
                <Avatar>
                  {userImage ? <AvatarImage alt={userName ?? "Cuenta de Google"} src={userImage} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                  <AvatarBadge className="bg-green-600 dark:bg-green-800" />
                </Avatar>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent align="end" className="w-72 overflow-hidden rounded-2xl p-0">
            <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3.5 px-4 py-3.5">
              <Avatar className="size-11">
                {userImage ? <AvatarImage alt={accountName} src={userImage} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0">
                <span className="truncate text-base font-bold leading-tight">
                  {accountName}
                </span>
                <span className="truncate text-sm leading-tight text-muted-foreground">
                  {accountEmail}
                </span>
              </span>
            </div>
            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuItem
              className="min-h-12 gap-3 rounded-none px-4 py-3 text-base font-semibold"
              onSelect={(event) => {
                event.preventDefault();
                onDisconnect();
              }}
            >
              <LogOutIcon />
              <span>Cerrar sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TooltipContent className="mr-2" side="bottom" sideOffset={8}>{tooltipStatusLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={
            status === "loading"
              ? "Verificando sesión de Google"
              : "Conectar cuenta de Google"
          }
          disabled={status === "loading"}
          onClick={onConnect}
          type="button"
        >
          <Avatar className="grayscale">
            {userImage ? <AvatarImage alt={userName ?? "Cuenta de Google"} src={userImage} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
            <AvatarBadge>
              <PlusIcon />
            </AvatarBadge>
          </Avatar>
        </button>
      </TooltipTrigger>
      <TooltipContent className="mr-2" side="bottom" sideOffset={8}>{tooltipStatusLabel}</TooltipContent>
    </Tooltip>
  );
}
