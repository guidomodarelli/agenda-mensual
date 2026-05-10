import { useCallback, useRef, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { flushSync } from "react-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    icon: Sun,
    label: "Claro",
    value: "light",
  },
  {
    icon: Moon,
    label: "Oscuro",
    value: "dark",
  },
  {
    icon: Monitor,
    label: "Sistema",
    value: "system",
  },
] as const;

type ThemeOption = (typeof THEME_OPTIONS)[number]["value"];

type ViewTransitionWithReady = {
  ready?: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (
    updateCallback: () => void | Promise<void>,
  ) => ViewTransitionWithReady;
};

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number;
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  disabled,
  ...props
}: AnimatedThemeTogglerProps) => {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const isThemeReady =
    isHydrated &&
    (resolvedTheme === "light" || resolvedTheme === "dark");
  const isDark = resolvedTheme === "dark";
  const selectedTheme: ThemeOption =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "system";
  const isDisabled = !isThemeReady || disabled;

  const selectTheme = useCallback((nextTheme: ThemeOption) => {
    const button = buttonRef.current;
    if (!button || typeof document === "undefined" || isDisabled) {
      return;
    }

    const { top, left, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y)
    );
    const documentWithViewTransition = document as DocumentWithViewTransition;

    const applyTheme = () => {
      setTheme(nextTheme);
    };

    if (typeof documentWithViewTransition.startViewTransition !== "function") {
      applyTheme();
      return;
    }

    const transition = documentWithViewTransition.startViewTransition(() => {
      flushSync(applyTheme);
    });

    const ready = transition?.ready;
    if (ready && typeof ready.then === "function") {
      void ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      });
    }
  }, [duration, isDisabled, setTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          ref={buttonRef}
          disabled={isDisabled}
          className={cn(className)}
          {...props}
        >
          {!isThemeReady ? <SunMoon aria-hidden="true" /> : isDark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          <span className="sr-only">Alternar tema</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44 rounded-xl p-2"
        side="bottom"
        sideOffset={8}
      >
        <DropdownMenuRadioGroup
          onValueChange={(nextTheme) => {
            selectTheme(nextTheme as ThemeOption);
          }}
          value={selectedTheme}
        >
          {THEME_OPTIONS.map(({ icon: Icon, label, value }) => (
            <DropdownMenuRadioItem
              key={value}
              className="h-11 gap-3 px-3 pr-9 text-base"
              value={value}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span>{label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
