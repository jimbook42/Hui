import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EventRespondLoading from "@/app/(protected)/events/[eventId]/respond/loading";

vi.mock("@/components/app/app-shell", () => ({
  AppShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <div aria-label={title}>{children}</div>
  ),
}));

describe("EventRespondLoading", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows time-row skeletons instead of a buttonless attendance prompt", () => {
    render(<EventRespondLoading />);

    expect(screen.getByLabelText("Loading response flow")).toBeInTheDocument();
    expect(screen.queryByText(/Can you make this time/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Can you make it/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /yes|maybe|can't/i })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".hui-skeleton").length).toBeGreaterThanOrEqual(6);
  });
});
