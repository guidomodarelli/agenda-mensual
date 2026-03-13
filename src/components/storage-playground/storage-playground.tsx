import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VISIBLE_DRIVE_FOLDER_NAME } from "@/modules/storage/shared/visible-drive-folder-name";
import {
  cn,
} from "@/lib/utils";

import styles from "./storage-playground.module.scss";

export interface StoragePlaygroundFormValues {
  content: string;
  mimeType: string;
  name: string;
}

export interface StoragePlaygroundStoredResource {
  id: string;
  mimeType: string;
  name: string;
  viewUrl?: string | null;
}

export interface StoragePlaygroundFormState {
  error: string | null;
  isSubmitting: boolean;
  result: StoragePlaygroundStoredResource | null;
  successMessage: string | null;
  values: StoragePlaygroundFormValues;
}

type StorageFieldName = keyof StoragePlaygroundFormValues;
type StorageFormSubmitHandler = (event: React.FormEvent<HTMLFormElement>) => void;

interface StoragePlaygroundProps {
  applicationSettingsActionDisabled: boolean;
  applicationSettingsForm: StoragePlaygroundFormState;
  applicationSettingsHint: string;
  isAuthenticated: boolean;
  onApplicationSettingsFieldChange: (
    fieldName: StorageFieldName,
    value: string,
  ) => void;
  onApplicationSettingsSubmit: StorageFormSubmitHandler;
  onUserFileFieldChange: (fieldName: StorageFieldName, value: string) => void;
  onUserFileSubmit: StorageFormSubmitHandler;
  sessionMessage: string;
  sessionUserEmail: string | null;
  sessionUserName: string | null;
  userFilesActionDisabled: boolean;
  userFilesForm: StoragePlaygroundFormState;
  userFilesHint: string;
}

export function StoragePlayground({
  applicationSettingsActionDisabled,
  applicationSettingsForm,
  applicationSettingsHint,
  isAuthenticated,
  onApplicationSettingsFieldChange,
  onApplicationSettingsSubmit,
  onUserFileFieldChange,
  onUserFileSubmit,
  sessionMessage,
  sessionUserEmail,
  sessionUserName,
  userFilesActionDisabled,
  userFilesForm,
  userFilesHint,
}: StoragePlaygroundProps) {
  return (
    <section
      aria-labelledby="storage-playground-title"
      className={styles.section}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="storage-playground-title">
              Probar storage en Google Drive
            </h2>
          </CardTitle>
          <CardDescription>
            Guardá configuración interna en la base de datos y un archivo visible
            del usuario en Drive sin salir de esta pantalla.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.content}>
          <p
            className={cn(
              styles.sessionStatus,
              isAuthenticated ? styles.sessionReady : styles.sessionPending,
            )}
            role="status"
          >
            {sessionMessage}
          </p>
          {isAuthenticated && sessionUserName && sessionUserEmail ? (
            <div className={styles.sessionIdentity}>
              <p className={styles.sessionIdentityLine}>
                Cuenta activa: {sessionUserName}
              </p>
              <p className={styles.sessionIdentityLine}>Email: {sessionUserEmail}</p>
            </div>
          ) : null}

          <div className={styles.formsGrid}>
            <form
              className={styles.formCard}
              onSubmit={onApplicationSettingsSubmit}
            >
              <div className={styles.formHeader}>
                <h3 className={styles.formTitle}>Guardar configuración</h3>
                <p className={styles.formDescription}>
                  Este formulario guarda configuración interna de la app en la
                  base de datos.
                </p>
              </div>

              <div className={styles.fields}>
                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor="application-settings-name"
                  >
                    Nombre del archivo de configuración
                  </label>
                  <input
                    className={styles.input}
                    id="application-settings-name"
                    onChange={(event) =>
                      onApplicationSettingsFieldChange("name", event.target.value)
                    }
                    type="text"
                    value={applicationSettingsForm.values.name}
                  />
                </div>

                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor="application-settings-mime-type"
                  >
                    MIME type de la configuración
                  </label>
                  <input
                    className={styles.input}
                    id="application-settings-mime-type"
                    onChange={(event) =>
                      onApplicationSettingsFieldChange(
                        "mimeType",
                        event.target.value,
                      )
                    }
                    type="text"
                    value={applicationSettingsForm.values.mimeType}
                  />
                </div>

                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor="application-settings-content"
                  >
                    Contenido JSON
                  </label>
                  <textarea
                    className={styles.textarea}
                    id="application-settings-content"
                    onChange={(event) =>
                      onApplicationSettingsFieldChange(
                        "content",
                        event.target.value,
                      )
                    }
                    value={applicationSettingsForm.values.content}
                  />
                </div>
              </div>

              <p
                aria-live="polite"
                className={cn(
                  styles.hint,
                  applicationSettingsForm.error && styles.errorText,
                  applicationSettingsForm.successMessage && styles.successText,
                )}
                role={applicationSettingsForm.error ? "alert" : undefined}
              >
                {applicationSettingsForm.error ??
                  applicationSettingsForm.successMessage ??
                  applicationSettingsHint}
              </p>

              <div className={styles.actions}>
                <Button
                  disabled={applicationSettingsActionDisabled}
                  type="submit"
                >
                  {applicationSettingsForm.isSubmitting
                    ? "Guardando configuración..."
                    : "Guardar configuración"}
                </Button>
              </div>

              {applicationSettingsForm.result ? (
                <div className={styles.result}>
                  <p className={styles.resultLine}>
                    Nombre: {applicationSettingsForm.result.name}
                  </p>
                  <p className={styles.resultLine}>
                    MIME type: {applicationSettingsForm.result.mimeType}
                  </p>
                  <p className={styles.resultLine}>
                    Id: {applicationSettingsForm.result.id}
                  </p>
                </div>
              ) : null}
            </form>

            <form className={styles.formCard} onSubmit={onUserFileSubmit}>
              <div className={styles.formHeader}>
                <h3 className={styles.formTitle}>Guardar archivo del usuario</h3>
                <p className={styles.formDescription}>
                  Este formulario crea un archivo visible en My Drive dentro de la
                  carpeta `{VISIBLE_DRIVE_FOLDER_NAME}` con el alcance mínimo
                  `drive.file`.
                </p>
              </div>

              <div className={styles.fields}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-file-name">
                    Nombre del archivo del usuario
                  </label>
                  <input
                    className={styles.input}
                    id="user-file-name"
                    onChange={(event) =>
                      onUserFileFieldChange("name", event.target.value)
                    }
                    type="text"
                    value={userFilesForm.values.name}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-file-mime-type">
                    MIME type del archivo
                  </label>
                  <input
                    className={styles.input}
                    id="user-file-mime-type"
                    onChange={(event) =>
                      onUserFileFieldChange("mimeType", event.target.value)
                    }
                    type="text"
                    value={userFilesForm.values.mimeType}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="user-file-content">
                    Contenido del archivo
                  </label>
                  <textarea
                    className={styles.textarea}
                    id="user-file-content"
                    onChange={(event) =>
                      onUserFileFieldChange("content", event.target.value)
                    }
                    value={userFilesForm.values.content}
                  />
                </div>
              </div>

              <p
                aria-live="polite"
                className={cn(
                  styles.hint,
                  userFilesForm.error && styles.errorText,
                  userFilesForm.successMessage && styles.successText,
                )}
                role={userFilesForm.error ? "alert" : undefined}
              >
                {userFilesForm.error ??
                  userFilesForm.successMessage ??
                  userFilesHint}
              </p>

              <div className={styles.actions}>
                <Button
                  disabled={userFilesActionDisabled}
                  type="submit"
                >
                  {userFilesForm.isSubmitting
                    ? "Guardando archivo..."
                    : "Guardar archivo"}
                </Button>
              </div>

              {userFilesForm.result ? (
                <div className={styles.result}>
                  <p className={styles.resultLine}>
                    Nombre: {userFilesForm.result.name}
                  </p>
                  <p className={styles.resultLine}>
                    Carpeta en Drive: {VISIBLE_DRIVE_FOLDER_NAME}
                  </p>
                  <p className={styles.resultLine}>
                    MIME type: {userFilesForm.result.mimeType}
                  </p>
                  <p className={styles.resultLine}>Id: {userFilesForm.result.id}</p>
                  {userFilesForm.result.viewUrl ? (
                    <Button asChild className={styles.resultLink} variant="link">
                      <a
                        href={userFilesForm.result.viewUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir archivo en Drive
                      </a>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </form>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
