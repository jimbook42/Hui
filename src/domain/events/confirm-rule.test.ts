import { describe, expect, it } from "vitest";

import {
  eventConfirmRuleDisplayLine,
  eventConfirmRuleLabel,
  eventConfirmRuleOptionDescription,
  isEventConfirmRule,
} from "@/domain/events/confirm-rule";

describe("event confirm rule copy", () => {
  it("validates rule values", () => {
    expect(isEventConfirmRule("when_most_can_come")).toBe(true);
    expect(isEventConfirmRule("invalid")).toBe(false);
  });

  it("formats hui page display line", () => {
    expect(eventConfirmRuleDisplayLine("when_most_can_come")).toBe(
      "Confirms: when most can come",
    );
    expect(eventConfirmRuleLabel("organiser_picks")).toBe("Organiser picks");
  });

  it("uses plain-language option descriptions", () => {
    expect(eventConfirmRuleOptionDescription("when_most_can_come")).toMatch(
      /Confirm automatically/,
    );
    expect(eventConfirmRuleOptionDescription("when_most_can_come")).not.toMatch(/Auto-confirm/);
  });
});
