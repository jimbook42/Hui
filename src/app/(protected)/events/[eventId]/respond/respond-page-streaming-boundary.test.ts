import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Next.js can only stream one server-started promise into a client subtree when the
 * client reads it via the RSC flight payload. A second sibling client component on the
 * respond page broke that stream (500 "This page couldn't load" after propose).
 */
describe("EventParticipantRespondPage streaming boundary", () => {
  it("does not mount a second client component beside the respond flow", () => {
    const pagePath = path.join(
      import.meta.dirname,
      "page.tsx",
    );
    const source = readFileSync(pagePath, "utf8");

    expect(source).not.toMatch(/EventLifecycleLiveRefresh/);
    expect(source).toMatch(/secondaryDataPromise=\{secondaryDataPromise\}/);
  });
});
