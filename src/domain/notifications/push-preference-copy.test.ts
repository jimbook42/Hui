import { describe, expect, it } from "vitest";

import { PUSH_CONTRIBUTION_CHANGES_DESCRIPTION } from "@/domain/notifications/push-preference-copy";

describe("push preference copy", () => {
  it("mentions claim and drop for hosts and organisers", () => {
    expect(PUSH_CONTRIBUTION_CHANGES_DESCRIPTION).toMatch(/claims or drops/i);
    expect(PUSH_CONTRIBUTION_CHANGES_DESCRIPTION).toMatch(/hosts or organisers/i);
  });
});
