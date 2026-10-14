import { describe, expect, it } from "vitest";

import { passwordsMeetRules } from "./password-rules";

describe("passwordsMeetRules", () => {
  it("requires length and matching confirmation", () => {
    expect(passwordsMeetRules("short", "short")).toBe(false);
    expect(passwordsMeetRules("longenough", "different")).toBe(false);
    expect(passwordsMeetRules("longenough", "longenough")).toBe(true);
  });
});
