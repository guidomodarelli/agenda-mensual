import { vi, describe, it, expect, afterEach, type Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PwaUpdateControl } from "./pwa-update-control";

type MockServiceWorker = {
  postMessage: Mock;
};

type MockServiceWorkerRegistration = {
  addEventListener: Mock;
  installing: null;
  removeEventListener: Mock;
  update: Mock;
  waiting: MockServiceWorker | null;
};

type MockServiceWorkerContainer = {
  addEventListener: Mock;
  controller: object;
  getRegistration: Mock;
  removeEventListener: Mock;
};

function setMockServiceWorkerEnvironment(
  registration: MockServiceWorkerRegistration,
) {
  const serviceWorkerContainer: MockServiceWorkerContainer = {
    addEventListener: vi.fn(),
    controller: {},
    getRegistration: vi.fn().mockResolvedValue(registration),
    removeEventListener: vi.fn(),
  };

  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorkerContainer,
  });

  return serviceWorkerContainer;
}

describe("PwaUpdateControl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays hidden when there is no waiting worker", async () => {
    const registration: MockServiceWorkerRegistration = {
      addEventListener: vi.fn(),
      installing: null,
      removeEventListener: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      waiting: null,
    };

    setMockServiceWorkerEnvironment(registration);

    render(<PwaUpdateControl />);

    await waitFor(() => {
      expect(registration.update).toHaveBeenCalled();
    });

    expect(screen.queryByText("Hay una nueva versión")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Actualizar app",
      }),
    ).not.toBeInTheDocument();
  });

  it("shows update badge when a waiting worker exists", async () => {
    const registration: MockServiceWorkerRegistration = {
      addEventListener: vi.fn(),
      installing: null,
      removeEventListener: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      waiting: {
        postMessage: vi.fn(),
      },
    };

    setMockServiceWorkerEnvironment(registration);

    render(<PwaUpdateControl />);

    expect(await screen.findByText("Hay una nueva versión")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Actualizar app",
      }),
    ).toBeInTheDocument();
  });

  it("checks for updates and asks waiting worker to skip waiting", async () => {
    const user = userEvent.setup();
    const waitingWorker = {
      postMessage: vi.fn(),
    };
    const registration: MockServiceWorkerRegistration = {
      addEventListener: vi.fn(),
      installing: null,
      removeEventListener: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
      waiting: waitingWorker,
    };

    setMockServiceWorkerEnvironment(registration);

    render(<PwaUpdateControl />);

    await user.click(
      await screen.findByRole("button", {
        name: "Actualizar app",
      }),
    );

    await waitFor(() => {
      expect(registration.update).toHaveBeenCalled();
      expect(waitingWorker.postMessage).toHaveBeenCalledWith({
        type: "SKIP_WAITING",
      });
    });
  });
});
