import { describe, expect, it } from "vitest";

import { canDeleteGroup, canTransferOwnership } from "./permissions";

describe("group ownership permissions", () => {
  it("limits delete and transfer to the owner", () => {
    expect(canDeleteGroup("owner")).toBe(true);
    expect(canDeleteGroup("admin")).toBe(false);
    expect(canDeleteGroup("member")).toBe(false);
    expect(canTransferOwnership("owner")).toBe(true);
    expect(canTransferOwnership("admin")).toBe(false);
  });
});
