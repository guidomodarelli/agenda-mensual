import type {
  GetServerSideProps,
  InferGetServerSidePropsType,
} from "next";
import { useState } from "react";
import { useSession } from "next-auth/react";

import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import { GOOGLE_OAUTH_SCOPES } from "@/modules/auth/infrastructure/oauth/google-oauth-scopes";
import {
  StoragePlayground,
  type StoragePlaygroundFormState,
  type StoragePlaygroundFormValues,
} from "@/components/storage-playground/storage-playground";
import { getStorageBootstrap } from "@/modules/storage/application/queries/get-storage-bootstrap";
import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";
import { VISIBLE_DRIVE_FOLDER_NAME } from "@/modules/storage/shared/visible-drive-folder-name";
import {
  saveApplicationSettingsViaApi,
  saveUserFileViaApi,
  type StorageSaveRequest,
} from "@/modules/storage/infrastructure/api/storage-api";

import styles from "./index.module.scss";

type HomePageProps = {
  bootstrap: StorageBootstrapResult;
};

const DEFAULT_APPLICATION_SETTINGS_VALUES: StorageSaveRequest = {
  content: '{\n  "theme": "dark"\n}',
  mimeType: "application/json",
  name: "application-settings.json",
};

const DEFAULT_USER_FILE_VALUES: StorageSaveRequest = {
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

function normalizeStorageValues(values: StorageSaveRequest): StorageSaveRequest {
  return {
    content: values.content.trim(),
    mimeType: values.mimeType.trim(),
    name: values.name.trim(),
  };
}

function getFieldValidationMessage(
  values: StorageSaveRequest,
  resourceLabel: string,
): string | null {
  const normalizedValues = normalizeStorageValues(values);

  if (
    !normalizedValues.name ||
    !normalizedValues.mimeType ||
    !normalizedValues.content
  ) {
    return `Completá nombre, MIME type y contenido para guardar ${resourceLabel}.`;
  }

  return null;
}

export default function HomePage({
  bootstrap,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const isOAuthConfigured = bootstrap.authStatus === "configured";
  const { data: session, status } = useSession();
  const [applicationSettingsForm, setApplicationSettingsForm] =
    useState<StoragePlaygroundFormState>(
      createStorageFormState(DEFAULT_APPLICATION_SETTINGS_VALUES),
    );
  const [userFilesForm, setUserFilesForm] =
    useState<StoragePlaygroundFormState>(
      createStorageFormState(DEFAULT_USER_FILE_VALUES),
    );

  const isAuthenticated = status === "authenticated";
  const isSessionLoading = status === "loading";
  const sessionUserName = session?.user?.name?.trim() || null;
  const sessionUserEmail = session?.user?.email?.trim() || null;
  const sessionMessage = !isOAuthConfigured
    ? "Completá la configuración OAuth del servidor para habilitar el storage."
    : isSessionLoading
      ? "Estamos verificando tu sesión de Google."
      : isAuthenticated
        ? "Sesión Google activa. Ya podés guardar datos internos en la base y adjuntos en Drive."
        : "Conectate con Google para habilitar el guardado.";

  const applicationSettingsValidationMessage = getFieldValidationMessage(
    applicationSettingsForm.values,
    "la configuración",
  );
  const userFilesValidationMessage = getFieldValidationMessage(
    userFilesForm.values,
    "el archivo del usuario",
  );

  const updateApplicationSettingsField = (
    fieldName: keyof StorageSaveRequest,
    value: string,
  ) => {
    setApplicationSettingsForm((currentState) => ({
      ...currentState,
      error: null,
      result: null,
      successMessage: null,
      values: {
        ...currentState.values,
        [fieldName]: value,
      },
    }));
  };

  const updateUserFileField = (
    fieldName: keyof StorageSaveRequest,
    value: string,
  ) => {
    setUserFilesForm((currentState) => ({
      ...currentState,
      error: null,
      result: null,
      successMessage: null,
      values: {
        ...currentState.values,
        [fieldName]: value,
      },
    }));
  };

  const submitApplicationSettings = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      applicationSettingsValidationMessage ||
      !isOAuthConfigured ||
      !isAuthenticated
    ) {
      return;
    }

    setApplicationSettingsForm((currentState) => ({
      ...currentState,
      error: null,
      isSubmitting: true,
      result: null,
      successMessage: null,
    }));

    try {
      const result = await saveApplicationSettingsViaApi(
        normalizeStorageValues(applicationSettingsForm.values),
      );

      setApplicationSettingsForm((currentState) => ({
        ...currentState,
        isSubmitting: false,
        result,
        successMessage: `Configuración guardada en la base de datos con id ${result.id}.`,
      }));
    } catch (error) {
      setApplicationSettingsForm((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : "No pudimos guardar la configuración en la base de datos.",
        isSubmitting: false,
      }));
    }
  };

  const submitUserFile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (userFilesValidationMessage || !isOAuthConfigured || !isAuthenticated) {
      return;
    }

    setUserFilesForm((currentState) => ({
      ...currentState,
      error: null,
      isSubmitting: true,
      result: null,
      successMessage: null,
    }));

    try {
      const result = await saveUserFileViaApi(
        normalizeStorageValues(userFilesForm.values),
      );

      setUserFilesForm((currentState) => ({
        ...currentState,
        isSubmitting: false,
        result,
        successMessage: `Archivo guardado en Drive con id ${result.id} dentro de la carpeta ${VISIBLE_DRIVE_FOLDER_NAME}.`,
      }));
    } catch (error) {
      setUserFilesForm((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : "No pudimos guardar el archivo del usuario en Google Drive.",
        isSubmitting: false,
      }));
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <StoragePlayground
          applicationSettingsActionDisabled={
            !isOAuthConfigured ||
            !isAuthenticated ||
            isSessionLoading ||
            applicationSettingsForm.isSubmitting ||
            Boolean(applicationSettingsValidationMessage)
          }
          applicationSettingsForm={applicationSettingsForm}
          applicationSettingsHint={
            applicationSettingsValidationMessage ??
            "Usá este guardado para probar la persistencia interna en la base de datos."
          }
          isAuthenticated={isAuthenticated}
          onApplicationSettingsFieldChange={updateApplicationSettingsField}
          onApplicationSettingsSubmit={submitApplicationSettings}
          onUserFileFieldChange={updateUserFileField}
          onUserFileSubmit={submitUserFile}
          sessionMessage={sessionMessage}
          sessionUserEmail={sessionUserEmail}
          sessionUserName={sessionUserName}
          userFilesActionDisabled={
            !isOAuthConfigured ||
            !isAuthenticated ||
            isSessionLoading ||
            userFilesForm.isSubmitting ||
            Boolean(userFilesValidationMessage)
          }
          userFilesForm={userFilesForm}
          userFilesHint={
            userFilesValidationMessage ??
            `Usá este guardado para probar archivos visibles del usuario dentro de la carpeta ${VISIBLE_DRIVE_FOLDER_NAME}.`
          }
        />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<HomePageProps> = async () => {
  try {
    return {
      props: {
        bootstrap: getStorageBootstrap({
          isGoogleOAuthConfigured: isGoogleOAuthConfigured(),
          requiredScopes: GOOGLE_OAUTH_SCOPES,
        }),
      },
    };
  } catch {
    return {
      props: {
        bootstrap: getStorageBootstrap({
          isGoogleOAuthConfigured: false,
          requiredScopes: [],
        }),
      },
    };
  }
};
