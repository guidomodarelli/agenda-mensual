import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import type { ClientSafeProvider } from "next-auth/react";

import { SignInPageClient } from "@/app/auth/signin/signin-page-client";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));


const mockedUseSearchParams = vi.mocked(useSearchParams);
const mockedSignIn = vi.mocked(signIn);

const googleProvider = {
  callbackUrl: "/api/auth/callback/google",
  id: "google",
  name: "Google",
  signinUrl: "/api/auth/signin/google",
  type: "oauth",
} as ClientSafeProvider;

describe("SignInPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseSearchParams.mockReturnValue({
      get: (name: string) => (name === "callbackUrl" ? "/cotizaciones" : null),
    } as ReturnType<typeof useSearchParams>);
  });

  it("starts Google sign in with the requested callback URL", async () => {
    const user = userEvent.setup();

    render(
      <SignInPageClient
        hasProviderError={false}
        providers={{
          google: googleProvider,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continuar con Google" }));

    expect(mockedSignIn).toHaveBeenCalledWith("google", {
      callbackUrl: "/cotizaciones",
    });
  });
});
