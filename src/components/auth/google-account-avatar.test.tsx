import { vi, describe, it, expect } from "vitest";
import { TooltipProvider } from "beez-ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

import { GoogleAccountAvatar } from "./google-account-avatar";

function renderGoogleAccountAvatar(
  props: ComponentProps<typeof GoogleAccountAvatar>,
) {
  return render(
    <TooltipProvider>
      <GoogleAccountAvatar {...props} />
    </TooltipProvider>,
  );
}

describe("GoogleAccountAvatar", () => {
  it("opens sign in menu when session is disconnected", async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();

    renderGoogleAccountAvatar(
      {
        onConnect,
        onDisconnect: vi.fn(),
        status: "unauthenticated",
        userImage: null,
        userName: null,
      },
    );

    await user.click(
      screen.getByRole("button", { name: "Conectar cuenta de Google" }),
    );
    expect(screen.getByText("Incógnito")).toBeInTheDocument();
    expect(screen.getByText("Sin cuenta")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Iniciar sesión" }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("renders disconnect menu when session is connected", async () => {
    const user = userEvent.setup();
    const onDisconnect = vi.fn();

    renderGoogleAccountAvatar(
      {
        onConnect: vi.fn(),
        onDisconnect,
        status: "authenticated",
        userEmail: "gus@example.com",
        userImage: "https://example.com/avatar.png",
        userName: "Gus Example",
      },
    );

    await user.click(
      screen.getByRole("button", { name: "Cuenta de Google conectada" }),
    );
    expect(screen.getByText("gus@example.com")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("uses user initials as fallback when no profile image is available", () => {
    renderGoogleAccountAvatar(
      {
        onConnect: vi.fn(),
        onDisconnect: vi.fn(),
        status: "authenticated",
        userImage: null,
        userName: "Guido Modarelli",
      },
    );

    expect(screen.getByText("GM")).toBeInTheDocument();
  });

  it("shows generic disconnected status in tooltip", async () => {
    const user = userEvent.setup();

    renderGoogleAccountAvatar({
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      status: "unauthenticated",
      userImage: null,
      userName: null,
    });

    await user.hover(
      screen.getByRole("button", { name: "Conectar cuenta de Google" }),
    );

    expect((await screen.findAllByText("Sin sesión")).length).toBeGreaterThan(0);
  });

  it("shows user name in connected tooltip", async () => {
    const user = userEvent.setup();

    renderGoogleAccountAvatar({
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      status: "authenticated",
      userImage: null,
      userName: "Guido Modarelli",
    });

    await user.hover(
      screen.getByRole("button", { name: "Cuenta de Google conectada" }),
    );

    expect((await screen.findAllByText("Guido Modarelli")).length).toBeGreaterThan(0);
  });
});
