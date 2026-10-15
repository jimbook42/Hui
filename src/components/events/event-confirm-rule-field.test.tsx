import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventConfirmRuleField } from "@/components/events/event-confirm-rule-field";

describe("EventConfirmRuleField", () => {
  it("renders all three rules and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EventConfirmRuleField value="when_most_can_come" onChange={onChange} />);

    expect(screen.getByText(/When most can come/i)).toBeTruthy();
    expect(screen.getByText(/Only when everyone can come/i)).toBeTruthy();
    expect(screen.getByText(/Organiser picks/i)).toBeTruthy();

    await user.click(screen.getByText(/Organiser picks/i));
    expect(onChange).toHaveBeenCalledWith("organiser_picks");
  });
});
