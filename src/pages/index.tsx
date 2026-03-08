import type {
  GetServerSideProps,
  InferGetServerSidePropsType,
} from "next";

import { isGoogleOAuthConfigured } from "@/modules/auth/infrastructure/oauth/google-oauth-config";
import { GOOGLE_OAUTH_SCOPES } from "@/modules/auth/infrastructure/oauth/google-oauth-scopes";
import { StoragePlayground } from "@/components/storage-playground/storage-playground";
import { getStorageBootstrap } from "@/modules/storage/application/queries/get-storage-bootstrap";
import type { StorageBootstrapResult } from "@/modules/storage/application/results/storage-bootstrap";

import styles from "./index.module.scss";

type HomePageProps = {
  bootstrap: StorageBootstrapResult;
};

export default function HomePage({
  bootstrap,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const isOAuthConfigured = bootstrap.authStatus === "configured";

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <StoragePlayground isOAuthConfigured={isOAuthConfigured} />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<HomePageProps> = async () => {
  try {
    return {
      props: {
        bootstrap: getStorageBootstrap({
          isGoogleOAuthConfigured: isGoogleOAuthConfigured(),
          requiredScopes: GOOGLE_OAUTH_SCOPES,
        }),
      },
    };
  } catch {
    return {
      props: {
        bootstrap: getStorageBootstrap({
          isGoogleOAuthConfigured: false,
          requiredScopes: [],
        }),
      },
    };
  }
};
