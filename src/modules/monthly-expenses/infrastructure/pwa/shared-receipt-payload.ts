import { z } from "zod";

export const SHARED_RECEIPT_PAYLOAD_CACHE_NAME = "control-mensual-shared-receipt-v1";
export const SHARED_RECEIPT_PAYLOAD_CACHE_PATH = "/__pwa/shared-receipt/payload";
export const MAX_SHARED_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_SHARED_RECEIPT_MAX_AGE_MS = 30 * 60 * 1000;

export const ALLOWED_SHARED_RECEIPT_MIME_TYPES = [
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedSharedReceiptMimeType = (typeof ALLOWED_SHARED_RECEIPT_MIME_TYPES)[number];

const SHARED_RECEIPT_SOURCE = ["web-share-target", "manual-file-picker"] as const;

const sharedReceiptPayloadSchema = z.object({
  contentBase64: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(ALLOWED_SHARED_RECEIPT_MIME_TYPES),
  receivedAtIso: z.string().trim().datetime(),
  sizeBytes: z.number().int().positive().max(MAX_SHARED_RECEIPT_SIZE_BYTES),
  source: z.enum(SHARED_RECEIPT_SOURCE),
}).strict();

export type SharedReceiptPayload = z.infer<typeof sharedReceiptPayloadSchema>;

type CacheStorageLike = Pick<CacheStorage, "open">;

interface SharedReceiptPayloadStorageOptions {
  cacheStorage?: CacheStorageLike;
  locationRef?: Pick<Location, "origin">;
}

interface ReadSharedReceiptPayloadOptions extends SharedReceiptPayloadStorageOptions {
  maxAgeMs?: number;
  now?: Date;
}

interface JsonResponseLike {
  json: () => Promise<unknown>;
  clone: () => JsonResponseLike;
}

function getCacheStorage({
  cacheStorage,
}: SharedReceiptPayloadStorageOptions): CacheStorageLike | null {
  if (cacheStorage) {
    return cacheStorage;
  }

  if (typeof globalThis === "undefined" || !("caches" in globalThis)) {
    return null;
  }

  return globalThis.caches;
}

function getRequestUrl({
  locationRef,
}: SharedReceiptPayloadStorageOptions): string {
  const origin =
    locationRef?.origin ||
    (typeof globalThis !== "undefined" && "location" in globalThis
      ? globalThis.location.origin
      : "") ||
    "https://control-mensual.local";

  return `${origin}${SHARED_RECEIPT_PAYLOAD_CACHE_PATH}`;
}

async function getPayloadCache(
  options: SharedReceiptPayloadStorageOptions,
): Promise<Cache | null> {
  const storage = getCacheStorage(options);

  if (!storage) {
    return null;
  }

  return storage.open(SHARED_RECEIPT_PAYLOAD_CACHE_NAME);
}

function createJsonResponse(payload: SharedReceiptPayload): Response {
  const serializedPayload = JSON.stringify(payload);

  if (typeof Response !== "undefined") {
    return new Response(serializedPayload, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    });
  }

  const jsonResponse: JsonResponseLike = {
    clone: () => jsonResponse,
    json: async () => JSON.parse(serializedPayload),
  };

  return jsonResponse as unknown as Response;
}

export async function clearSharedReceiptPayload(
  options: SharedReceiptPayloadStorageOptions = {},
): Promise<void> {
  const cache = await getPayloadCache(options);

  if (!cache) {
    return;
  }

  await cache.delete(getRequestUrl(options));
}

export async function saveSharedReceiptPayload(
  payload: SharedReceiptPayload,
  options: SharedReceiptPayloadStorageOptions = {},
): Promise<void> {
  const cache = await getPayloadCache(options);

  if (!cache) {
    return;
  }

  const normalizedPayload = sharedReceiptPayloadSchema.parse(payload);

  await cache.put(
    getRequestUrl(options),
    createJsonResponse(normalizedPayload),
  );
}

export async function readSharedReceiptPayload(
  options: ReadSharedReceiptPayloadOptions = {},
): Promise<SharedReceiptPayload | null> {
  const {
    maxAgeMs = DEFAULT_SHARED_RECEIPT_MAX_AGE_MS,
    now = new Date(),
  } = options;
  const cache = await getPayloadCache(options);

  if (!cache) {
    return null;
  }

  const response = await cache.match(getRequestUrl(options));

  if (!response) {
    return null;
  }

  try {
    const parsedPayload = sharedReceiptPayloadSchema.parse(await response.json());
    const receivedAt = new Date(parsedPayload.receivedAtIso);

    if (
      !Number.isFinite(receivedAt.getTime()) ||
      now.getTime() - receivedAt.getTime() > Math.max(maxAgeMs, 0)
    ) {
      await clearSharedReceiptPayload(options);
      return null;
    }

    return parsedPayload;
  } catch {
    await clearSharedReceiptPayload(options);
    return null;
  }
}

export async function consumeSharedReceiptPayload(
  options: ReadSharedReceiptPayloadOptions = {},
): Promise<SharedReceiptPayload | null> {
  const payload = await readSharedReceiptPayload(options);

  if (!payload) {
    return null;
  }

  await clearSharedReceiptPayload(options);

  return payload;
}
