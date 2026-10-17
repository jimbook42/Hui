import { describe, expect, it } from "vitest";

import {
  DISPLAY_NAME_CONFIRMED_METADATA_KEY,
  displayNameMatchesEmailPrefix,
  shouldPromptForDisplayName,
} from "./display-name-prompt";

describe("displayNameMatchesEmailPrefix", () => {
  it("matches case-insensitively", () => {
    expect(displayNameMatchesEmailPrefix("Isaac", "isaac@outlook.com")).toBe(true);
    expect(displayNameMatchesEmailPrefix("isaac", "Isaac@outlook.com")).toBe(true);
  });

  it("does not match when the user chose a different name", () => {
    expect(displayNameMatchesEmailPrefix("Isaac Tull", "isaac@outlook.com")).toBe(false);
  });
});

describe("shouldPromptForDisplayName", () => {
  it("prompts when the profile name equals the email prefix and is not confirmed", () => {
    expect(
      shouldPromptForDisplayName({
        displayName: "isaac",
        email: "isaac@outlook.com",
        userMetadata: {},
      }),
    ).toBe(true);
  });

  it("hides after display_name_confirmed metadata is set", () => {
    expect(
      shouldPromptForDisplayName({
        displayName: "isaac",
        email: "isaac@outlook.com",
        userMetadata: { [DISPLAY_NAME_CONFIRMED_METADATA_KEY]: true },
      }),
    ).toBe(false);
  });

  it("never prompts when the name differs from the prefix", () => {
    expect(
      shouldPromptForDisplayName({
        displayName: "Isaac Tull",
        email: "isaac@outlook.com",
        userMetadata: {},
      }),
    ).toBe(false);
  });
});
