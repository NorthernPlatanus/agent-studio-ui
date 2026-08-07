import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/shared/api/msw/server";

// jsdom ships no `matchMedia`; the theme provider reads `prefers-color-scheme`.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom ships no `EventSource` either, and the shell opens the live stream on
// mount. The stub connects to nothing: SSE behaviour is tested against
// `openStream` directly, not through the layout.
if (typeof globalThis.EventSource !== "function") {
  class StubEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    readonly url: string;
    readyState = StubEventSource.CONNECTING;
    constructor(url: string) {
      this.url = url;
    }
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return false;
    }
    close() {
      this.readyState = StubEventSource.CLOSED;
    }
  }
  globalThis.EventSource = StubEventSource as unknown as typeof EventSource;
}

// An unhandled request means the test is hitting a real network — always a bug here.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
