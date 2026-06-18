import "@testing-library/jest-dom";

// `next/cache` only runs inside the Next.js server runtime (it needs the
// incremental cache store), so in jest we replace it with a transparent
// pass-through: `unstable_cache` still invokes the real computation (only the
// caching layer is removed) and `revalidateTag`/`revalidatePath` become no-ops.
// This keeps tests exercising real behavior while avoiding runtime-only APIs.
jest.mock("next/cache", () => ({
	revalidatePath: jest.fn(),
	revalidateTag: jest.fn(),
	unstable_cache:
		<Args extends unknown[], Result>(callback: (...args: Args) => Result) =>
		(...args: Args): Result =>
			callback(...args),
}));

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
