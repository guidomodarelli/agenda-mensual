const CACHE_NAME = "control-mensual-static-v1";
const SHARED_RECEIPT_PAYLOAD_CACHE_NAME = "control-mensual-shared-receipt-v1";
const SHARED_RECEIPT_PAYLOAD_CACHE_PATH = "/__pwa/shared-receipt/payload";
const SHARE_TARGET_ACTION_PATH = "/recibir-comprobante";
const SHARE_TARGET_RECEIPT_FIELD_NAME = "receipt";
const SHARED_RECEIPT_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const SHARED_RECEIPT_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

function toBase64FromArrayBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function sanitizeSharedFileName(fileName) {
  const normalizedFileName = fileName
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-");

  if (!normalizedFileName) {
    return "comprobante";
  }

  return normalizedFileName.slice(0, 180);
}

async function clearSharedReceiptPayload() {
  const shareCache = await caches.open(SHARED_RECEIPT_PAYLOAD_CACHE_NAME);

  await shareCache.delete(SHARED_RECEIPT_PAYLOAD_CACHE_PATH);
}

async function saveSharedReceiptPayload(payload) {
  const shareCache = await caches.open(SHARED_RECEIPT_PAYLOAD_CACHE_NAME);

  await shareCache.put(
    SHARED_RECEIPT_PAYLOAD_CACHE_PATH,
    new Response(JSON.stringify(payload), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    }),
  );
}

function buildShareTargetRedirectPath(searchParams = "") {
  return searchParams
    ? `${SHARE_TARGET_ACTION_PATH}?${searchParams}`
    : SHARE_TARGET_ACTION_PATH;
}

async function handleShareTargetPost(request) {
  try {
    const formData = await request.formData();
    const sharedReceipt = formData.get(SHARE_TARGET_RECEIPT_FIELD_NAME);

    if (!(sharedReceipt instanceof File)) {
      await clearSharedReceiptPayload();
      return Response.redirect(
        buildShareTargetRedirectPath("shareError=missing-file"),
        303,
      );
    }

    const normalizedMimeType = sharedReceipt.type.trim().toLowerCase();

    if (!SHARED_RECEIPT_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      await clearSharedReceiptPayload();
      return Response.redirect(
        buildShareTargetRedirectPath("shareError=unsupported-type"),
        303,
      );
    }

    if (
      !Number.isFinite(sharedReceipt.size) ||
      sharedReceipt.size <= 0 ||
      sharedReceipt.size > SHARED_RECEIPT_MAX_SIZE_BYTES
    ) {
      await clearSharedReceiptPayload();
      return Response.redirect(
        buildShareTargetRedirectPath("shareError=invalid-size"),
        303,
      );
    }

    const contentBase64 = toBase64FromArrayBuffer(
      await sharedReceipt.arrayBuffer(),
    );

    if (!contentBase64) {
      await clearSharedReceiptPayload();
      return Response.redirect(
        buildShareTargetRedirectPath("shareError=empty-payload"),
        303,
      );
    }

    await saveSharedReceiptPayload({
      contentBase64,
      fileName: sanitizeSharedFileName(sharedReceipt.name),
      mimeType: normalizedMimeType,
      receivedAtIso: new Date().toISOString(),
      sizeBytes: sharedReceipt.size,
      source: "web-share-target",
    });

    return Response.redirect(buildShareTargetRedirectPath("shared=1"), 303);
  } catch {
    await clearSharedReceiptPayload();
    return Response.redirect(
      buildShareTargetRedirectPath("shareError=invalid-payload"),
      303,
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "SKIP_WAITING") {
    return;
  }

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== CACHE_NAME &&
                key !== SHARED_RECEIPT_PAYLOAD_CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (
    request.method === "POST" &&
    requestUrl.pathname === SHARE_TARGET_ACTION_PATH
  ) {
    event.respondWith(handleShareTargetPost(request));
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  if (
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/auth/") ||
    requestUrl.pathname.startsWith("/api/auth/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((offlineResponse) => {
          if (offlineResponse) {
            return offlineResponse;
          }

          return caches.match("/").then((homeResponse) => {
            if (homeResponse) {
              return homeResponse;
            }

            return Response.error();
          });
        }),
      ),
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }

          const canCacheRequest =
            request.destination === "style" ||
            request.destination === "script" ||
            request.destination === "image" ||
            request.destination === "font" ||
            request.destination === "manifest" ||
            requestUrl.pathname.startsWith("/_next/static/");

          if (canCacheRequest) {
            const responseToCache = networkResponse.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache))
              .catch(() => undefined);
          }

          return networkResponse;
        })
        .catch(() => Response.error());
    }),
  );
});
