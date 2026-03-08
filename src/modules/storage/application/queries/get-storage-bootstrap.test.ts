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
        "https://www.googleapis.com/auth/drive.appdata",
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
        "https://www.googleapis.com/auth/drive.appdata",
      ],
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
