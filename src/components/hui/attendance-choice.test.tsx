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

  it("does not shift sibling answer rows when one row enters saving state", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ul className="space-y-4">
        <li data-testid="respond-time-row-a">
          <AttendanceChoice
            state="yes"
            label="Yes, I can make it"
            selected={false}
            pending={false}
            onClick={onClick}
          />
        </li>
        <li data-testid="respond-time-row-b">
          <AttendanceChoice
            state="maybe"
            label="I could make it work"
            selected={false}
            pending={false}
            onClick={onClick}
          />
        </li>
        <li data-testid="respond-time-row-c">
          <AttendanceChoice
            state="no"
            label="I can't make it"
            selected={false}
            pending={false}
            onClick={onClick}
          />
        </li>
      </ul>,
    );

    const siblingTopsBefore = ["respond-time-row-b", "respond-time-row-c"].map((id) =>
      screen.getByTestId(id).getBoundingClientRect().top,
    );

    rerender(
      <ul className="space-y-4">
        <li data-testid="respond-time-row-a">
          <AttendanceChoice
            state="yes"
            label="Yes, I can make it"
            selected={true}
            pending={true}
            onClick={onClick}
          />
        </li>
        <li data-testid="respond-time-row-b">
          <AttendanceChoice
            state="maybe"
            label="I could make it work"
            selected={false}
            pending={false}
            onClick={onClick}
          />
        </li>
        <li data-testid="respond-time-row-c">
          <AttendanceChoice
            state="no"
            label="I can't make it"
            selected={false}
            pending={false}
            onClick={onClick}
          />
        </li>
      </ul>,
    );

    const siblingTopsAfter = ["respond-time-row-b", "respond-time-row-c"].map((id) =>
      screen.getByTestId(id).getBoundingClientRect().top,
    );

    for (let index = 0; index < siblingTopsBefore.length; index += 1) {
      expect(Math.abs(siblingTopsAfter[index] - siblingTopsBefore[index])).toBeLessThan(1);
    }
  });
});
