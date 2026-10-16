import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DecisionCreateForm } from "@/components/decisions/decision-create-form";

vi.mock("@/app/decisions/actions", () => ({
  createEventDecisionAction: vi.fn(),
  updateEventDecisionDraftAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe("DecisionCreateForm", () => {
  it("starts with two option rows and can add a third", async () => {
    const user = userEvent.setup();
    render(<DecisionCreateForm eventId="event-1" />);

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /\+ Add option/i }));
    expect(screen.getByLabelText("Option 3")).toBeInTheDocument();
  });

  it("removes a row when more than two remain", async () => {
    const user = userEvent.setup();
    render(<DecisionCreateForm eventId="event-1" />);

    await user.click(screen.getByRole("button", { name: /\+ Add option/i }));
    const removeButtons = screen.getAllByRole("button", { name: /Remove option/i });
    await user.click(removeButtons[0]);
    expect(screen.getAllByLabelText(/Option \d/i)).toHaveLength(2);
  });

  it("shows duplicate error before submit", async () => {
    const user = userEvent.setup();
    render(<DecisionCreateForm eventId="event-1" />);

    const fields = screen.getAllByLabelText(/Option \d/i);
    await user.clear(fields[0]);
    await user.type(fields[0], "Same");
    await user.clear(fields[1]);
    await user.type(fields[1], "same");
    await user.click(screen.getByRole("button", { name: /Open decision/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/unique/i);
  });
});
