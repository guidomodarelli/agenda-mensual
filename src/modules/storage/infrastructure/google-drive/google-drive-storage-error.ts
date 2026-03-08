import { GaxiosError } from "gaxios";
import { z } from "zod";

const googleApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.number().int().positive(),
    message: z.string().trim().min(1),
    status: z.string().trim().min(1).optional(),
  }),
});

export type GoogleDriveStorageErrorCode =
  | "api_disabled"
  | "insufficient_permissions"
  | "invalid_payload"
  | "invalid_scope"
  | "unexpected";

export class GoogleDriveStorageError extends Error {
  constructor(
    message: string,
    {
      apiStatus,
      code,
      endpoint,
      httpStatus,
      operation,
      cause,
    }: {
      apiStatus?: string;
      code: GoogleDriveStorageErrorCode;
      endpoint: string;
      httpStatus?: number;
      operation: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause });
    this.name = "GoogleDriveStorageError";
    this.apiStatus = apiStatus;
    this.code = code;
    this.endpoint = endpoint;
    this.httpStatus = httpStatus;
    this.operation = operation;
  }

  readonly apiStatus?: string;
  readonly code: GoogleDriveStorageErrorCode;
  readonly endpoint: string;
  readonly httpStatus?: number;
  readonly operation: string;
}

function getGoogleApiErrorDetails(error: unknown): {
  apiStatus?: string;
  httpStatus?: number;
  message?: string;
} {
  if (!(error instanceof GaxiosError)) {
    return {};
  }

  const parsedResponse = googleApiErrorResponseSchema.safeParse(
    error.response?.data,
  );

  if (!parsedResponse.success) {
    return {
      httpStatus: error.status ?? error.response?.status,
      message: error.message,
    };
  }

  return {
    apiStatus: parsedResponse.data.error.status,
    httpStatus:
      error.status ??
      error.response?.status ??
      parsedResponse.data.error.code,
    message: parsedResponse.data.error.message,
  };
}

function getGoogleDriveStorageErrorCode({
  apiStatus,
  httpStatus,
  message,
}: {
  apiStatus?: string;
  httpStatus?: number;
  message?: string;
}): GoogleDriveStorageErrorCode {
  const normalizedMessage = message?.toLowerCase() ?? "";
  const normalizedApiStatus = apiStatus?.toUpperCase();

  if (
    normalizedApiStatus === "SERVICE_DISABLED" ||
    normalizedMessage.includes("drive api has not been used") ||
    normalizedMessage.includes("is disabled") ||
    normalizedMessage.includes("api has not been used in project")
  ) {
    return "api_disabled";
  }

  if (
    normalizedApiStatus === "PERMISSION_DENIED" &&
    normalizedMessage.includes("insufficient authentication scopes")
  ) {
    return "invalid_scope";
  }

  if (
    normalizedApiStatus === "PERMISSION_DENIED" ||
    normalizedMessage.includes("insufficient permissions") ||
    normalizedMessage.includes("insufficient permission")
  ) {
    return "insufficient_permissions";
  }

  if (httpStatus === 400 || normalizedApiStatus === "INVALID_ARGUMENT") {
    return "invalid_payload";
  }

  return "unexpected";
}

export function mapGoogleDriveStorageError(
  error: unknown,
  {
    endpoint,
    operation,
  }: {
    endpoint: string;
    operation: string;
  },
): GoogleDriveStorageError {
  if (error instanceof GoogleDriveStorageError) {
    return error;
  }

  const googleApiErrorDetails = getGoogleApiErrorDetails(error);
  const code = getGoogleDriveStorageErrorCode(googleApiErrorDetails);

  return new GoogleDriveStorageError(
    `${operation} failed while calling ${endpoint} with httpStatus=${googleApiErrorDetails.httpStatus ?? "unknown"} and apiStatus=${googleApiErrorDetails.apiStatus ?? "unknown"}. ${googleApiErrorDetails.message ?? "Google Drive did not return a structured error message."}`,
    {
      apiStatus: googleApiErrorDetails.apiStatus,
      cause: error,
      code,
      endpoint,
      httpStatus: googleApiErrorDetails.httpStatus,
      operation,
    },
  );
}
