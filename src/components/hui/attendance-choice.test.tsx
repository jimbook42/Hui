import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttendanceChoice } from "@/components/hui/attendance-choice";

describe("AttendanceChoice layout while saving", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not change button height when saving starts", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <AttendanceChoice
        state="yes"
        label="Yes"
        selected={false}
        pending={false}
        onClick={onClick}
      />,
    );

    const before = screen.getByRole("button", { name: "Yes" }).getBoundingClientRect().height;

    rerender(
      <AttendanceChoice
        state="yes"
        label="Yes"
        selected={true}
        pending={true}
        onClick={onClick}
      />,
    );

    const after = screen.getByRole("button", { name: "Yes" }).getBoundingClientRect().height;
    expect(Math.abs(after - before)).toBeLessThan(1);
  });
});
