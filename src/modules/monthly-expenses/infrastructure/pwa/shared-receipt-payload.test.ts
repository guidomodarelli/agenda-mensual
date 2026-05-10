import {
  consumeSharedReceiptPayload,
  readSharedReceiptPayload,
  saveSharedReceiptPayload,
  SHARED_RECEIPT_PAYLOAD_CACHE_PATH,
  type SharedReceiptPayload,
} from "./shared-receipt-payload";

interface CacheLike {
  delete: jest.Mock<Promise<boolean>, [RequestInfo | URL]>;
  match: jest.Mock<Promise<Response | undefined>, [RequestInfo | URL]>;
  put: jest.Mock<Promise<void>, [RequestInfo | URL, Response]>;
}

interface JsonResponseLike {
  clone?: () => JsonResponseLike;
  json: () => Promise<unknown>;
}

function toCacheKey(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function createCacheStorageMock() {
  const entries = new Map<string, Response>();
  const cache: CacheLike = {
    delete: jest.fn(async (request) => entries.delete(toCacheKey(request))),
    match: jest.fn(async (request) => entries.get(toCacheKey(request))),
    put: jest.fn(async (request, response) => {
      entries.set(
        toCacheKey(request),
        (typeof response.clone === "function" ? response.clone() : response) as Response,
      );
    }),
  };

  const cacheStorage = {
    open: jest.fn(async (cacheName: string) => {
      void cacheName;
      return cache as unknown as Cache;
    }),
  } as unknown as Pick<CacheStorage, "open">;

  return {
    cache,
    cacheStorage,
  };
}

function createMockJsonResponse(payload: unknown): JsonResponseLike {
  const response: JsonResponseLike = {
    clone: () => response,
    json: async () => payload,
  };

  return response;
}

describe("shared receipt payload cache", () => {
  const locationRef = {
    origin: "https://control-mensual.test",
  };
  const now = new Date("2026-03-17T14:00:00.000Z");

  function createValidPayload(overrides?: Partial<SharedReceiptPayload>): SharedReceiptPayload {
    return {
      contentBase64: "Zm9vYmFy",
      fileName: "comprobante.pdf",
      mimeType: "application/pdf",
      receivedAtIso: now.toISOString(),
      sizeBytes: 128,
      source: "web-share-target",
      ...overrides,
    };
  }

  it("stores and reads a valid payload", async () => {
    const { cacheStorage } = createCacheStorageMock();
    const payload = createValidPayload();

    await saveSharedReceiptPayload(payload, {
      cacheStorage,
      locationRef,
    });

    await expect(
      readSharedReceiptPayload({
        cacheStorage,
        locationRef,
        now,
      }),
    ).resolves.toEqual(payload);
  });

  it("consumes payload once and clears it", async () => {
    const { cacheStorage } = createCacheStorageMock();
    const payload = createValidPayload();

    await saveSharedReceiptPayload(payload, {
      cacheStorage,
      locationRef,
    });

    await expect(
      consumeSharedReceiptPayload({
        cacheStorage,
        locationRef,
        now,
      }),
    ).resolves.toEqual(payload);

    await expect(
      readSharedReceiptPayload({
        cacheStorage,
        locationRef,
        now,
      }),
    ).resolves.toBeNull();
  });

  it("rejects stale payloads and removes them", async () => {
    const { cache, cacheStorage } = createCacheStorageMock();

    await saveSharedReceiptPayload(
      createValidPayload({
        receivedAtIso: "2026-03-17T13:10:00.000Z",
      }),
      {
        cacheStorage,
        locationRef,
      },
    );

    await expect(
      readSharedReceiptPayload({
        cacheStorage,
        locationRef,
        maxAgeMs: 30 * 60 * 1000,
        now,
      }),
    ).resolves.toBeNull();

    expect(cache.delete).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid payload shape", async () => {
    const { cache, cacheStorage } = createCacheStorageMock();

    await cache.put(
      `${locationRef.origin}${SHARED_RECEIPT_PAYLOAD_CACHE_PATH}`,
      createMockJsonResponse(
        createValidPayload({
          mimeType: "text/plain" as "application/pdf",
        }),
      ) as unknown as Response,
    );

    await expect(
      readSharedReceiptPayload({
        cacheStorage,
        locationRef,
        now,
      }),
    ).resolves.toBeNull();
  });

  it("stores and reads a manual-file-picker payload", async () => {
    const { cacheStorage } = createCacheStorageMock();
    const payload = createValidPayload({ source: "manual-file-picker" });

    await saveSharedReceiptPayload(payload, { cacheStorage, locationRef });

    await expect(
      readSharedReceiptPayload({ cacheStorage, locationRef, now }),
    ).resolves.toEqual(payload);
  });
});
