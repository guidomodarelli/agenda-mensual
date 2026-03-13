import { render, screen } from "@testing-library/react";

import { VISIBLE_DRIVE_FOLDER_NAME } from "@/modules/storage/shared/visible-drive-folder-name";

import {
  StoragePlayground,
  type StoragePlaygroundFormState,
  type StoragePlaygroundFormValues,
} from "./storage-playground";

const DEFAULT_APPLICATION_SETTINGS_VALUES: StoragePlaygroundFormValues = {
  content: '{\n  "theme": "dark"\n}',
  mimeType: "application/json",
  name: "application-settings.json",
};

const DEFAULT_USER_FILE_VALUES: StoragePlaygroundFormValues = {
  content: "date,amount\n2026-03-08,32.5",
  mimeType: "text/csv",
  name: "expenses.csv",
};

function createStorageFormState(
  values: StoragePlaygroundFormValues,
): StoragePlaygroundFormState {
  return {
    error: null,
    isSubmitting: false,
    result: null,
    successMessage: null,
    values,
  };
}

function createDefaultProps() {
  return {
    applicationSettingsActionDisabled: false,
    applicationSettingsForm: createStorageFormState(
      DEFAULT_APPLICATION_SETTINGS_VALUES,
    ),
    applicationSettingsHint:
      "Usá este guardado para probar la persistencia de la configuración.",
    isAuthenticated: true,
    isSessionLoading: false,
    onApplicationSettingsFieldChange: jest.fn(),
    onApplicationSettingsSubmit: jest.fn(),
    onUserFileFieldChange: jest.fn(),
    onUserFileSubmit: jest.fn(),
    sessionMessage:
      "Sesión Google activa. Ya podés guardar datos internos en la base y adjuntos en Drive.",
    sessionUserEmail: "gus@example.com",
    sessionUserName: "Gus",
    userFilesActionDisabled: false,
    userFilesForm: createStorageFormState(DEFAULT_USER_FILE_VALUES),
    userFilesHint: "Usá este guardado para probar archivos visibles del usuario.",
  };
}

describe("StoragePlayground", () => {
  it("disables storage actions when there is no Google session", () => {
    render(
      <StoragePlayground
        {...createDefaultProps()}
        applicationSettingsActionDisabled
        isAuthenticated={false}
        sessionMessage="Conectate con Google para habilitar el guardado."
        sessionUserEmail={null}
        sessionUserName={null}
        userFilesActionDisabled
      />,
    );

    expect(
      screen.getByText("Conectate con Google para habilitar el guardado."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar configuración" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Guardar archivo" }),
    ).toBeDisabled();
  });

  it("shows the active account personal details when session is authenticated", () => {
    render(<StoragePlayground {...createDefaultProps()} />);

    expect(
      screen.getByText(
        "Sesión Google activa. Ya podés guardar datos internos en la base y adjuntos en Drive.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Este formulario crea un archivo visible en My Drive dentro de la carpeta \`${VISIBLE_DRIVE_FOLDER_NAME}\` con el alcance mínimo \`drive.file\`.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Cuenta activa: Gus")).toBeInTheDocument();
    expect(screen.getByText("Email: gus@example.com")).toBeInTheDocument();
  });

  it("renders storage results passed by the container", () => {
    render(
      <StoragePlayground
        {...createDefaultProps()}
        applicationSettingsForm={{
          ...createStorageFormState(DEFAULT_APPLICATION_SETTINGS_VALUES),
          result: {
            id: "settings-file-id",
            mimeType: "application/json",
            name: "application-settings.json",
          },
          successMessage:
            "Configuración guardada en la base de datos con id settings-file-id.",
        }}
        userFilesForm={{
          ...createStorageFormState(DEFAULT_USER_FILE_VALUES),
          result: {
            id: "user-file-id",
            mimeType: "text/csv",
            name: "expenses.csv",
            viewUrl: "https://drive.google.com/file/d/user-file-id/view",
          },
          successMessage:
            `Archivo guardado en Drive con id user-file-id dentro de la carpeta ${VISIBLE_DRIVE_FOLDER_NAME}.`,
        }}
      />,
    );

    expect(
      screen.getByText(
        "Configuración guardada en la base de datos con id settings-file-id.",
      ),
    ).toBeInTheDocument();
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

  it("shows inline validation coming from the container", () => {
    render(
      <StoragePlayground
        {...createDefaultProps()}
        userFilesActionDisabled
        userFilesHint="Completá nombre, MIME type y contenido para guardar el archivo del usuario."
      />,
    );

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
