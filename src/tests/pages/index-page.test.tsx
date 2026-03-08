import { render, screen } from "@testing-library/react";
import { useSession } from "next-auth/react";

import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";
import HomePage from "@/pages/index";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

const mockedUseSession = jest.mocked(useSession);

const bootstrap: StorageBootstrapResult = {
  architecture: {
    dataStrategy: "ssr-first",
    middleendLocation: "src/modules",
    routing: "pages-router",
  },
  authStatus: "configured",
  requiredScopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
  ],
  storageTargets: [
    {
      id: "applicationSettings",
      requiredScope: "https://www.googleapis.com/auth/drive.appdata",
      writesUserVisibleFiles: false,
    },
    {
      id: "userFiles",
      requiredScope: "https://www.googleapis.com/auth/drive.file",
      writesUserVisibleFiles: true,
    },
  ],
};

describe("HomePage", () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
  });

  it("renders the storage playground without the legacy hero card", () => {
    render(<HomePage bootstrap={bootstrap} />);

    expect(
      screen.getByRole("heading", { name: "Probar storage en Google Drive" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Mis Finanzas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Pages Router + SSR + Hexagonal"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Conectate con Google para habilitar el guardado en Drive."),
    ).toBeInTheDocument();
  });

  it("renders the OAuth setup hint when bootstrap is pending", () => {
    render(<HomePage bootstrap={{ ...bootstrap, authStatus: "pending" }} />);

    expect(
      screen.getByText(
        "Completá la configuración OAuth del servidor para habilitar el storage.",
      ),
    ).toBeInTheDocument();
  });
});
