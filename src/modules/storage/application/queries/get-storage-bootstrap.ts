import type { StorageBootstrapResult } from "../results/storage-bootstrap";

interface GetStorageBootstrapInput {
  isGoogleOAuthConfigured: boolean;
  requiredScopes: readonly string[];
}

export function getStorageBootstrap({
  isGoogleOAuthConfigured,
  requiredScopes,
}: GetStorageBootstrapInput): StorageBootstrapResult {
  return {
    architecture: {
      dataStrategy: "ssr-first",
      middleendLocation: "src/modules",
      routing: "pages-router",
    },
    authStatus: isGoogleOAuthConfigured ? "configured" : "pending",
    requiredScopes: [...requiredScopes],
    storageTargets: [
      {
        id: "applicationSettings",
        requiredScope: "https://www.googleapis.com/auth/drive.appdata",
        writesUserVisibleFiles: false,
      },
      {
        id: "userFiles",
        requiredScope: "https://www.googleapis.com/auth/drive.file",
        writesUserVisibleFiles: true,
      },
    ],
  };
}
