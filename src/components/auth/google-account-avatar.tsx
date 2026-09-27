import {
  AccountMenu,
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "beez-ui";
import { PlusIcon } from "lucide-react";

type GoogleAccountAvatarStatus = "authenticated" | "loading" | "unauthenticated";

interface GoogleAccountAvatarProps {
  onConnect: () => void;
  onDisconnect: () => void;
  status: GoogleAccountAvatarStatus;
  userEmail?: string | null;
  userImage: string | null;
  userName: string | null;
}

const GUEST_ACCOUNT_NAME = "Incógnito";
const GUEST_ACCOUNT_EMAIL = "Sin cuenta";
const DEFAULT_INITIALS = "CM";

function getUserInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart.charAt(0).toUpperCase())
    .join("");

  return initials || DEFAULT_INITIALS;
}

/**
 * Top bar Google account control: a disabled avatar while the session is
 * resolving, then the shared beez-ui account menu with the Google copy.
 */
export function GoogleAccountAvatar({
  onConnect,
  onDisconnect,
  status,
  userEmail,
  userImage,
  userName,
}: GoogleAccountAvatarProps) {
  const accountName = userName ?? GUEST_ACCOUNT_NAME;
  const accountEmail = userEmail?.trim() || GUEST_ACCOUNT_EMAIL;
  const initials = getUserInitials(accountName);
  const tooltipStatusLabel =
    status === "authenticated"
      ? accountName
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
      avatarFallback={initials}
      email={accountEmail}
      image={userImage}
      labels={{
        trigger:
          status === "authenticated"
            ? "Cuenta de Google conectada"
            : "Conectar cuenta de Google",
      }}
      name={accountName}
      onSignIn={onConnect}
      onSignOut={onDisconnect}
      showStatusBadge
      status={status}
      tooltipLabel={tooltipStatusLabel}
    />
  );
}
