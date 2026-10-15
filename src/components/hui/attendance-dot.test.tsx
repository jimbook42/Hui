import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttendanceDot } from "@/components/hui/attendance-dot";

describe("AttendanceDot subdued options", () => {
  it("uses neutral pending styling for unselected yes/maybe/no", () => {
    const { container: yesContainer } = render(
      <AttendanceDot state="yes" label="Yes" subdued />,
    );
    const yesDot = yesContainer.querySelector("span.inline-flex.items-center");
    expect(yesDot?.className).toMatch(/border-dotted/);
    expect(yesDot?.className).not.toMatch(/border-attendance-yes/);

    const { container: maybeContainer } = render(
      <AttendanceDot state="maybe" label="Maybe" subdued />,
    );
    const maybeDot = maybeContainer.querySelector("span.inline-flex.items-center");
    expect(maybeDot?.className).toMatch(/border-dotted/);
  });
});
