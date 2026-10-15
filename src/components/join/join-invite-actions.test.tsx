import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { JoinAuthLinks } from "@/components/join/join-invite-actions";

describe("JoinAuthLinks", () => {
  it("puts create account first as the primary action", () => {
    render(
      <JoinAuthLinks token="tok" groupName="Friday Dinner Crew" focusEventId={null} />,
    );
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("Create account to join Friday Dinner Crew");
    expect(links[0]).toHaveClass("hui-btn-primary");
    expect(links[1]).toHaveTextContent("Sign in to join Friday Dinner Crew");
    expect(links[1]).toHaveClass("hui-btn-secondary");
  });
});
