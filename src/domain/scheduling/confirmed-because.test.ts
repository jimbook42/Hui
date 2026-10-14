import { describe, expect, it } from "vitest";

import { formatConfirmedBecauseLine } from "./confirmed-because";

describe("formatConfirmedBecauseLine", () => {
  it("describes yes votes against active members", () => {
    expect(
      formatConfirmedBecauseLine({ yesCount: 3, eligibleMemberCount: 5 }),
    ).toBe("Confirmed: 3 of 5 said yes");
  });
});
