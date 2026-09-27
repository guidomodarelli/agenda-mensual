import { Button } from "beez-ui";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import styles from "./pwa-update-control.module.scss";

type ServiceWorkerRegistrationWithListeners = ServiceWorkerRegistration & {
  addEventListener: (
    type: "updatefound",
    listener: () => void,
  ) => void;
  removeEventListener: (
    type: "updatefound",
    listener: () => void,
  ) => void;
};

function canUseServiceWorker(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

function watchForWaitingWorker(
  registration: ServiceWorkerRegistrationWithListeners,
  onWaiting: () => void,
): () => void {
  if (registration.waiting) {
    onWaiting();
  }

  const handleUpdateFound = () => {
    const installingWorker = registration.installing;

    if (!installingWorker) {
      return;
    }

    const handleStateChange = () => {
      if (
        installingWorker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        onWaiting();
      }
    };

    installingWorker.addEventListener("statechange", handleStateChange);
  };

  registration.addEventListener("updatefound", handleUpdateFound);

  return () => {
    registration.removeEventListener("updatefound", handleUpdateFound);
  };
}

/** Hydration never un-happens, so there is nothing to subscribe to. */
function subscribeToHydration(): () => void {
  return () => {};
}

function getClientHydrationSnapshot(): boolean {
  return true;
}

function getServerHydrationSnapshot(): boolean {
  return false;
}

export function PwaUpdateControl() {
  // False during the server render and hydration, true afterwards, without an extra effect pass.
  const isClient = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [hasUpdateReady, setHasUpdateReady] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const hasReloadedForControllerChange = useRef(false);

  useEffect(() => {
    if (!isClient || !canUseServiceWorker()) {
      return;
    }

    let cleanupRegistrationListeners: () => void = () => {};
    let isDisposed = false;

    const handleControllerChange = () => {
      if (hasReloadedForControllerChange.current) {
        return;
      }

      hasReloadedForControllerChange.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    async function attachUpdateWatcher() {
      const registration =
        (await navigator.serviceWorker.getRegistration()) as ServiceWorkerRegistrationWithListeners | undefined;

      if (!registration) {
        return;
      }

      cleanupRegistrationListeners = watchForWaitingWorker(registration, () => {
        if (!isDisposed) {
          setHasUpdateReady(true);
        }
      });

      await registration.update().catch(() => undefined);

      if (!isDisposed && registration.waiting) {
        setHasUpdateReady(true);
      }
    }

    void attachUpdateWatcher();

    return () => {
      isDisposed = true;
      cleanupRegistrationListeners();
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [isClient]);

  const handleCheckOrApplyUpdate = async () => {
    if (!canUseServiceWorker()) {
      return;
    }

    setIsCheckingUpdate(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        return;
      }

      await registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage({
          type: "SKIP_WAITING",
        });
      }
    } catch {
      // Ignore update check failures and keep UX non-blocking.
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  if (!isClient || !canUseServiceWorker() || !hasUpdateReady) {
    return null;
  }

  return (
    <div className={styles.container}>
      <span className={styles.badge}>Hay una nueva versión</span>
      <Button
        aria-label="Actualizar app"
        onClick={() => {
          void handleCheckOrApplyUpdate();
        }}
        size="sm"
        type="button"
        variant="default"
      >
        <RefreshCw
          aria-hidden="true"
          className={isCheckingUpdate ? "animate-spin" : undefined}
        />
        Actualizar app
      </Button>
    </div>
  );
}
