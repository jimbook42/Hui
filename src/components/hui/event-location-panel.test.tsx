import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventPlaceMap } from "@/components/hui/event-location-panel";

describe("EventPlaceMap", () => {
  it("renders a calm placeholder when there is no place or pin", () => {
    const { container } = render(
      <EventPlaceMap location={null} coordinates={null} className="h-20" />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders when location text is empty after trim", () => {
    const { container } = render(
      <EventPlaceMap location="   " coordinates={null} className="h-20" />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
