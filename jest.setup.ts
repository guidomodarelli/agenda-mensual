import "@testing-library/jest-dom";

class ResizeObserverMock {
	observe() {
		return;
	}

	unobserve() {
		return;
	}

	disconnect() {
		return;
	}
}

Object.defineProperty(globalThis, "ResizeObserver", {
	configurable: true,
	writable: true,
	value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "matchMedia", {
	configurable: true,
	writable: true,
	value: (query: string) => ({
		addEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
		matches: false,
		media: query,
		onchange: null,
		removeEventListener: jest.fn(),
	}),
});

// jsdom does not implement these pointer/scroll APIs, which Radix UI primitives
// (e.g. Select) rely on to open and navigate their popovers in tests.
if (typeof window !== "undefined") {
	window.HTMLElement.prototype.hasPointerCapture = jest.fn();
	window.HTMLElement.prototype.releasePointerCapture = jest.fn();
	window.HTMLElement.prototype.scrollIntoView = jest.fn();
}
