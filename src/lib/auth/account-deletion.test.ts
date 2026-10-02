import { describe, expect, it } from "vitest";

import {
  ACCOUNT_DELETION_CONFIRMATION,
  isAccountDeletionConfirmed,
} from "./account-deletion";

describe("account deletion confirmation", () => {
  it("accepts exact DELETE", () => {
    expect(isAccountDeletionConfirmed(ACCOUNT_DELETION_CONFIRMATION)).toBe(true);
  });

  it("rejects incorrect confirmation", () => {
    expect(isAccountDeletionConfirmed("delete")).toBe(false);
    expect(isAccountDeletionConfirmed("DELETE ")).toBe(false);
    expect(isAccountDeletionConfirmed("")).toBe(false);
  });
});
