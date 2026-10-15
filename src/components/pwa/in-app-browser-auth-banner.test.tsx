import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InAppBrowserAuthBanner } from "@/components/pwa/in-app-browser-auth-banner";

const FB_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FBAN/FBIOS";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InAppBrowserAuthBanner", () => {
  it("renders open-in-browser guidance for Facebook iOS webview", async () => {
    vi.stubGlobal("navigator", {
      userAgent: FB_IOS,
      maxTouchPoints: 5,
      clipboard: { writeText: vi.fn() },
    });

    render(<InAppBrowserAuthBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Open in Safari to sign in/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("stays hidden in normal mobile Safari", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      maxTouchPoints: 5,
      clipboard: { writeText: vi.fn() },
    });

    const { container } = render(<InAppBrowserAuthBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
