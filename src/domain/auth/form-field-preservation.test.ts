import { describe, expect, it } from "vitest";

import { preservedFieldsOnSignUpValidationError } from "./form-field-preservation";

describe("preservedFieldsOnSignUpValidationError", () => {
  it("retains display name and email when password is too short", () => {
    expect(
      preservedFieldsOnSignUpValidationError({
        email: "alex@example.com",
        password: "short",
        displayName: "Alex Smith",
      }),
    ).toEqual({
      display_name: "Alex Smith",
      email: "alex@example.com",
    });
  });

  it("does not preserve when password length is valid", () => {
    expect(
      preservedFieldsOnSignUpValidationError({
        email: "alex@example.com",
        password: "long-enough",
        displayName: "Alex Smith",
      }),
    ).toBeUndefined();
  });
});
