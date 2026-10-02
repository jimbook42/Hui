import { describe, expect, it } from "vitest";

import { formatSharedDietaryLine, sharedDietaryReminder } from "@/domain/dietary/display";

describe("dietary display", () => {
  it("formats shared lines and reminders", () => {
    expect(formatSharedDietaryLine("Isaac", "Vegetarian", null)).toBe("Isaac — Vegetarian");
    expect(formatSharedDietaryLine("Alice", "No dairy", "small butter okay")).toBe(
      "Alice — No dairy (small butter okay)",
    );
    expect(sharedDietaryReminder(0)).toBeNull();
    expect(sharedDietaryReminder(1)).toBe("1 shared dietary requirement may need consideration.");
    expect(sharedDietaryReminder(2)).toBe("2 shared dietary requirements may need consideration.");
  });
});
