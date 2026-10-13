import { describe, expect, it } from "vitest";

import { parsePersonalSetupFormData } from "./personal-setup-update";

describe("parsePersonalSetupFormData", () => {
  it("keeps a display name from skip forms", () => {
    const form = new FormData();
    form.set("display_name", "Alex Smith");
    const patch = parsePersonalSetupFormData(form);
    expect(patch.displayName).toBe("Alex Smith");
    expect(patch.completeSetup).toBe(false);
  });

  it("parses home location when fields are present", () => {
    const form = new FormData();
    form.set("complete_setup", "1");
    form.set("display_name", "Alex");
    form.set("home_location_label", "1 Queen St, Auckland");
    form.set("home_location_lat", "-36.8485");
    form.set("home_location_lng", "174.7633");
    const patch = parsePersonalSetupFormData(form);
    expect(patch.home?.label).toBe("1 Queen St, Auckland");
    expect(patch.completeSetup).toBe(true);
  });

  it("ignores home when fields are absent", () => {
    const form = new FormData();
    form.set("display_name", "Alex");
    const patch = parsePersonalSetupFormData(form);
    expect(patch.home).toBeUndefined();
  });
});
