import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";

import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";
import { VISIBLE_DRIVE_FOLDER_NAME } from "@/modules/storage/shared/visible-drive-folder-name";
import HomePage from "@/pages/index";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

const mockedUseSession = jest.mocked(useSession);
const originalFetch = global.fetch;

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
  ],
  storageTargets: [
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
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
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
      screen.getByText("Conectate con Google para habilitar el guardado."),
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

  it("submits application settings from the page container", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          id: "settings-file-id",
          mimeType: "application/json",
          name: "application-settings.json",
        },
      }),
      ok: true,
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    render(<HomePage bootstrap={bootstrap} />);

    await user.click(
      screen.getByRole("button", { name: "Guardar configuración" }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/application-settings",
        expect.objectContaining({
          body: JSON.stringify({
            content: "{\n  \"theme\": \"dark\"\n}",
            mimeType: "application/json",
            name: "application-settings.json",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
    });

    expect(
      screen.getByText(
        "Configuración guardada en la base de datos con id settings-file-id.",
      ),
    ).toBeInTheDocument();
  });

  it("submits a user file from the page container and renders the Drive link", async () => {
    const user = userEvent.setup();
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        data: {
          id: "user-file-id",
          mimeType: "text/csv",
          name: "expenses.csv",
          viewUrl: "https://drive.google.com/file/d/user-file-id/view",
        },
      }),
      ok: true,
    });

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);
    global.fetch = fetchMock as typeof fetch;

    render(<HomePage bootstrap={bootstrap} />);

    await user.click(screen.getByRole("button", { name: "Guardar archivo" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/storage/user-files",
        expect.objectContaining({
          body: JSON.stringify({
            content: "date,amount\n2026-03-08,32.5",
            mimeType: "text/csv",
            name: "expenses.csv",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        }),
      );
    });

    expect(
      screen.getByText(
        `Archivo guardado en Drive con id user-file-id dentro de la carpeta ${VISIBLE_DRIVE_FOLDER_NAME}.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Carpeta en Drive: ${VISIBLE_DRIVE_FOLDER_NAME}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir archivo en Drive" }),
    ).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/user-file-id/view",
    );
  });

  it("shows inline validation from the page container when user file content is empty", async () => {
    const user = userEvent.setup();

    mockedUseSession.mockReturnValue({
      data: {
        expires: "2099-01-01T00:00:00.000Z",
        user: {
          email: "gus@example.com",
          name: "Gus",
        },
      },
      status: "authenticated",
      update: jest.fn(),
    } as ReturnType<typeof useSession>);

    render(<HomePage bootstrap={bootstrap} />);

    await user.clear(screen.getByLabelText("Contenido del archivo"));

    expect(
      screen.getByText(
        "Completá nombre, MIME type y contenido para guardar el archivo del usuario.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar archivo" }),
    ).toBeDisabled();
  });
});
