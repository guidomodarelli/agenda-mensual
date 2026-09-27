/**
 * Renders a standardized receipt uploader built on top of the beez-ui file upload primitives.
 *
 * @module receipt-file-uploader
 */

import { useEffect, useRef, useState } from "react";
import {
  FileUpload,
  FileUploadDropZone,
  FileUploadItem,
  FileUploadList,
} from "beez-ui";

import styles from "./receipt-file-uploader.module.scss";
import {
  RECEIPT_UPLOAD_ACCEPT_ATTRIBUTE,
  RECEIPT_UPLOAD_HINT_TEXT,
  RECEIPT_UPLOAD_MAX_SIZE_BYTES,
} from "./receipt-upload.constants";

interface ReceiptFileUploaderProps {
  errorMessage?: string | null;
  inputId?: string;
  inputAriaLabel: string;
  isDisabled?: boolean;
  isUploading?: boolean;
  onFileChange: (file: File | null) => void;
  onInvalidFileSize?: () => void;
  onInvalidFileType?: () => void;
  selectedFile: File | null;
  uploadProgressPercent?: number;
}

const SIMULATED_UPLOAD_START_PROGRESS_PERCENT = 25;
const SIMULATED_UPLOAD_MAX_PROGRESS_PERCENT = 90;
const SIMULATED_UPLOAD_PROGRESS_STEP_PERCENT = 2;
const SIMULATED_UPLOAD_PROGRESS_INTERVAL_MILLISECONDS = 120;
const REAL_UPLOAD_PROGRESS_STALL_TIMEOUT_MILLISECONDS = 800;

/** Spanish copy of the drop zone. */
const RECEIPT_DROP_ZONE_LABELS = {
  dragAndDrop: "o arrastrá y soltá",
  uploadAction: "Hacé click para subir",
  uploadActionMobileSuffix: "desde tu equipo",
} as const;

/** Spanish copy of the selected receipt row. */
const RECEIPT_FILE_ITEM_LABELS = {
  complete: "Completado",
  delete: "Eliminar",
  failed: "No se pudo subir, probá de nuevo",
  progress: "Progreso de subida del comprobante",
  uploading: "Subiendo...",
} as const;

/**
 * Clamps a numeric progress value to an integer in the [0, 100] range.
 *
 * @param progressPercent - The raw progress value.
 * @returns The normalized progress percent.
 */
function clampProgressPercent(progressPercent: number): number {
  return Math.max(0, Math.min(100, Math.round(progressPercent)));
}

/**
 * Renders a single-file receipt uploader with drag-and-drop and upload progress support.
 *
 * @param props - The component input props.
 * @returns The uploader UI with optional selected file preview and progress.
 */
export function ReceiptFileUploader({
  errorMessage,
  inputId,
  inputAriaLabel,
  isDisabled = false,
  isUploading = false,
  onFileChange,
  onInvalidFileSize,
  onInvalidFileType,
  selectedFile,
  uploadProgressPercent,
}: ReceiptFileUploaderProps) {
  const [simulatedProgressPercent, setSimulatedProgressPercent] = useState(0);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [uploadStartTimestamp, setUploadStartTimestamp] = useState<number | null>(null);
  const [lastRealProgressEventTimestamp, setLastRealProgressEventTimestamp] = useState<number | null>(null);
  const lastRealProgressValueReference = useRef<number | null>(null);
  const wasUploadingReference = useRef(false);

  useEffect(() => {
    const currentTimestamp = Date.now();

    if (isUploading && !wasUploadingReference.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUploadStartTimestamp(currentTimestamp);
      setSimulatedProgressPercent(SIMULATED_UPLOAD_START_PROGRESS_PERCENT);
      setCurrentTimestamp(currentTimestamp);
      setLastRealProgressEventTimestamp(null);
      lastRealProgressValueReference.current = null;
    }

    if (!isUploading && wasUploadingReference.current) {
      setUploadStartTimestamp(null);
      setSimulatedProgressPercent(0);
      setCurrentTimestamp(currentTimestamp);
      setLastRealProgressEventTimestamp(null);
      lastRealProgressValueReference.current = null;
    }

    wasUploadingReference.current = isUploading;
  }, [isUploading]);

  useEffect(() => {
    if (!isUploading || typeof uploadProgressPercent !== "number") {
      return;
    }

    const normalizedRealProgressPercent = clampProgressPercent(uploadProgressPercent);

    if (lastRealProgressValueReference.current !== normalizedRealProgressPercent) {
      lastRealProgressValueReference.current = normalizedRealProgressPercent;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastRealProgressEventTimestamp(Date.now());
    }
  }, [isUploading, uploadProgressPercent]);

  useEffect(() => {
    if (!isUploading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
      setSimulatedProgressPercent((currentProgressPercent) =>
        Math.min(
          SIMULATED_UPLOAD_MAX_PROGRESS_PERCENT,
          Math.max(
            currentProgressPercent,
            SIMULATED_UPLOAD_START_PROGRESS_PERCENT,
          ) + SIMULATED_UPLOAD_PROGRESS_STEP_PERCENT,
        ));
    }, SIMULATED_UPLOAD_PROGRESS_INTERVAL_MILLISECONDS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isUploading]);

  const uploadHasStarted =
    isUploading &&
    typeof uploadStartTimestamp === "number" &&
    currentTimestamp >= uploadStartTimestamp;
  const realProgressPercent =
    typeof uploadProgressPercent === "number"
      ? clampProgressPercent(uploadProgressPercent)
      : null;
  const hasRecentRealProgressEvent =
    uploadHasStarted &&
    realProgressPercent !== null &&
    typeof lastRealProgressEventTimestamp === "number" &&
    currentTimestamp - lastRealProgressEventTimestamp <=
      REAL_UPLOAD_PROGRESS_STALL_TIMEOUT_MILLISECONDS;
  const effectiveProgressPercent = isUploading
    ? hasRecentRealProgressEvent && realProgressPercent !== null
      ? realProgressPercent
      : Math.max(
          simulatedProgressPercent,
          realProgressPercent ?? SIMULATED_UPLOAD_START_PROGRESS_PERCENT,
        )
    : 0;
  const hasUploadError = Boolean(errorMessage);

  return (
    <FileUpload className={styles.receiptFileUploader}>
      <FileUploadDropZone
        accept={RECEIPT_UPLOAD_ACCEPT_ATTRIBUTE}
        allowsMultiple={false}
        className={styles.dropZone}
        hint={RECEIPT_UPLOAD_HINT_TEXT}
        inputId={inputId}
        isDisabled={isDisabled}
        labels={{ ...RECEIPT_DROP_ZONE_LABELS, input: inputAriaLabel }}
        maxSize={RECEIPT_UPLOAD_MAX_SIZE_BYTES}
        onDropFiles={(files) => {
          onFileChange(files[0] ?? null);
        }}
        onDropUnacceptedFiles={() => {
          onInvalidFileType?.();
        }}
        onSizeLimitExceed={() => {
          onInvalidFileSize?.();
        }}
      />

      {selectedFile ? (
        <FileUploadList>
          <FileUploadItem
            className={styles.fileItem}
            failed={hasUploadError}
            isDeleteDisabled={isUploading}
            labels={RECEIPT_FILE_ITEM_LABELS}
            name={selectedFile.name}
            onDelete={() => {
              if (isUploading) {
                return;
              }
              onFileChange(null);
            }}
            progress={hasUploadError ? 0 : effectiveProgressPercent}
            progressVariant="fill"
            size={selectedFile.size}
          />
        </FileUploadList>
      ) : null}

      {errorMessage ? (
        <p className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </FileUpload>
  );
}
