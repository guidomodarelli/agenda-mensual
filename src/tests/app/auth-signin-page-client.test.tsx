import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import type { ClientSafeProvider } from "next-auth/react";
import type { ReactNode } from "react";

import { SignInPageClient } from "@/app/auth/signin/signin-page-client";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

jest.mock("@/components/ui/typing-animation", () => ({
  TypingAnimation: ({ children }: { children: ReactNode }) => (
    <h1>{children}</h1>
  ),
}));

const mockedUseSearchParams = jest.mocked(useSearchParams);
const mockedSignIn = jest.mocked(signIn);

const googleProvider = {
  callbackUrl: "/api/auth/callback/google",
  id: "google",
  name: "Google",
  signinUrl: "/api/auth/signin/google",
  type: "oauth",
} as ClientSafeProvider;

describe("SignInPageClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
