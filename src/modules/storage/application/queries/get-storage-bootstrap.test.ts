import { getStorageBootstrap } from "./get-storage-bootstrap";

describe("getStorageBootstrap", () => {
  it("returns a generic storage bootstrap contract for the home page", () => {
    const result = getStorageBootstrap({
      isGoogleOAuthConfigured: true,
      requiredScopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file",
      ],
    });

    expect(result).toEqual({
      architecture: {
        dataStrategy: "ssr-first",
        middleendLocation: "src/modules",
        routing: "pages-router",
      },
      authStatus: "configured",
      requiredScopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/drive.file",
      ],
      storageTargets: [
        {
          id: "userFiles",
          requiredScope: "https://www.googleapis.com/auth/drive.file",
          writesUserVisibleFiles: true,
        },
      ],
    });
  });

  it("marks auth as pending when OAuth is not configured yet", () => {
    const result = getStorageBootstrap({
      isGoogleOAuthConfigured: false,
      requiredScopes: [],
    });

    expect(result.authStatus).toBe("pending");
  });
});
