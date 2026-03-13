export type StorageTargetId = "userFiles";

export interface StorageTargetBootstrapResult {
  id: StorageTargetId;
  requiredScope: string;
  writesUserVisibleFiles: boolean;
}

export interface StorageBootstrapResult {
  architecture: {
    dataStrategy: "ssr-first";
    middleendLocation: "src/modules";
    routing: "pages-router";
  };
  authStatus: "configured" | "pending";
  requiredScopes: string[];
  storageTargets: StorageTargetBootstrapResult[];
}
