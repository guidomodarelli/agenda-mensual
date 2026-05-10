import {
  ChevronDownIcon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
} from "lucide-react";

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

export type AccountMenuStatus = "authenticated" | "unauthenticated";

interface AccountMenuClassNames {
  trigger?: string;
  triggerAvatar?: string;
  triggerText?: string;
  triggerName?: string;
  triggerEmail?: string;
  triggerChevron?: string;
  connectedBadge?: string;
  disconnectedBadge?: string;
}

interface AccountMenuProps {
  accountEmail: string;
  accountName: string;
  align?: "start" | "center" | "end";
  classNames?: AccountMenuClassNames;
  menuClassName?: string;
  onSignIn: () => void;
  onSignOut: () => void;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  status: AccountMenuStatus;
  tooltipLabel?: string;
  triggerAriaLabel: string;
  triggerVariant: "avatar" | "sidebar";
  userImage: string | null;
}

function getAccountInitials(accountName: string): string {
  const initials = accountName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart.charAt(0).toUpperCase())
    .join("");

  return initials || "CM";
}

function AccountAvatar({
  accountName,
  className,
  connectedBadgeClassName,
  disconnectedBadgeClassName,
  status,
  userImage,
}: {
  accountName: string;
  className?: string;
  connectedBadgeClassName?: string;
  disconnectedBadgeClassName?: string;
  status: AccountMenuStatus;
  userImage: string | null;
}) {
  const initials = getAccountInitials(accountName);

  return (
    <Avatar className={className}>
      {userImage ? <AvatarImage alt={accountName} src={userImage} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
      <AvatarBadge
        className={
          status === "authenticated"
            ? connectedBadgeClassName
            : disconnectedBadgeClassName
        }
      >
        {status === "authenticated" ? null : <PlusIcon />}
      </AvatarBadge>
    </Avatar>
  );
}

export function AccountMenu({
  accountEmail,
  accountName,
  align = "end",
  classNames,
  menuClassName,
  onSignIn,
  onSignOut,
  side,
  sideOffset = 4,
  status,
  tooltipLabel,
  triggerAriaLabel,
  triggerVariant,
  userImage,
}: AccountMenuProps) {
  const isAuthenticated = status === "authenticated";
  const triggerButton = (
    <button
      aria-label={triggerAriaLabel}
      className={classNames?.trigger}
      type="button"
    >
      <AccountAvatar
        accountName={accountName}
        className={classNames?.triggerAvatar}
        connectedBadgeClassName={classNames?.connectedBadge}
        disconnectedBadgeClassName={classNames?.disconnectedBadge}
        status={status}
        userImage={userImage}
      />
      {triggerVariant === "sidebar" ? (
        <>
          <span className={classNames?.triggerText}>
            <span className={classNames?.triggerName}>{accountName}</span>
            <span className={classNames?.triggerEmail}>{accountEmail}</span>
          </span>
          <ChevronDownIcon className={classNames?.triggerChevron} />
        </>
      ) : null}
    </button>
  );
  const trigger = tooltipLabel ? (
    <TooltipTrigger asChild>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
    </TooltipTrigger>
  ) : (
    <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
  );

  const menu = (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent
        align={align}
        className={menuClassName}
        side={side}
        sideOffset={sideOffset}
      >
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3.5 px-4 py-3.5">
          <AccountAvatar
            accountName={accountName}
            className={triggerVariant === "avatar" && !isAuthenticated ? "size-11 grayscale" : "size-11"}
            connectedBadgeClassName={classNames?.connectedBadge}
            disconnectedBadgeClassName={classNames?.disconnectedBadge}
            status={status}
            userImage={userImage}
          />
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
            if (isAuthenticated) {
              onSignOut();
              return;
            }

            onSignIn();
          }}
        >
          {isAuthenticated ? <LogOutIcon /> : <LogInIcon />}
          <span>{isAuthenticated ? "Cerrar sesión" : "Iniciar sesión"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!tooltipLabel) {
    return menu;
  }

  return (
    <Tooltip>
      {menu}
      <TooltipContent className="mr-2" side="bottom" sideOffset={8}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
