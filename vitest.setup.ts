import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// `next/cache` only runs inside the Next.js server runtime (it needs the
// incremental cache store), so in jest we replace it with a transparent
// pass-through: `unstable_cache` still invokes the real computation (only the
// caching layer is removed) and `revalidateTag`/`revalidatePath` become no-ops.
// This keeps tests exercising real behavior while avoiding runtime-only APIs.
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
	revalidateTag: vi.fn(),
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

// Keep behavioral tests independent of animation timing; Playwright exercises motion.
Object.defineProperty(globalThis, "matchMedia", {
	configurable: true,
	writable: true,
	value: (query: string) => ({
		addEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
		matches: query === "(prefers-reduced-motion: reduce)",
		media: query,
		onchange: null,
		removeEventListener: vi.fn(),
	}),
});

// jsdom does not implement these pointer/scroll APIs, which Radix UI primitives
// (e.g. Select) rely on to open and navigate their popovers in tests.
if (typeof window !== "undefined") {
	window.HTMLElement.prototype.hasPointerCapture = vi.fn();
	window.HTMLElement.prototype.releasePointerCapture = vi.fn();
	window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
