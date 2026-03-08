export interface UserFileUpload {
  content: string;
  mimeType: string;
  name: string;
}

export function createUserFileUpload(
  payload: UserFileUpload,
  operationName: string,
): UserFileUpload {
  const normalizedPayload = {
    ...payload,
    content: payload.content.trim(),
    mimeType: payload.mimeType.trim(),
    name: payload.name.trim(),
  };

  if (!normalizedPayload.name) {
    throw new Error(`${operationName} requires a non-empty file name.`);
  }

  if (!normalizedPayload.mimeType) {
    throw new Error(`${operationName} requires a MIME type.`);
  }

  if (!normalizedPayload.content) {
    throw new Error(`${operationName} requires file content.`);
  }

  return normalizedPayload;
}
