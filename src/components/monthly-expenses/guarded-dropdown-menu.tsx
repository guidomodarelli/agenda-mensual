import { DropdownMenu, type DropdownMenuProps } from "@astra-kit/ui";
import type { ReactElement } from "react";

export type GuardedDropdownMenuProps = DropdownMenuProps & {
  /** The menu's own trigger, rendered alone while the menu is disabled. */
  trigger: ReactElement;
  /** Keeps the menu closed: only the (disabled) trigger is rendered. */
  disabled?: boolean;
};

/**
 * A @astra-kit/ui `DropdownMenu` that cannot open while its trigger is disabled.
 *
 * Browsers still dispatch pointer events to a disabled `<button>`, and the
 * Radix trigger behind the Arc menu opens on `pointerdown`, so a disabled
 * custom trigger alone does not keep the menu closed. While `disabled`, this
 * renders only the trigger, without the menu around it.
 *
 * @param props - The `DropdownMenu` props, its required custom `trigger` and `disabled`.
 * @returns The trigger alone while disabled, or the menu with its trigger.
 */
export function GuardedDropdownMenu({
  disabled = false,
  trigger,
  ...menuProps
}: GuardedDropdownMenuProps) {
  if (disabled) {
    return trigger;
  }

  return <DropdownMenu {...menuProps} trigger={trigger} />;
}
