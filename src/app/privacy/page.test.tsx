import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("privacy page copy", () => {
  it("lists Google, Microsoft, and email without Facebook-specific claims", () => {
    const source = readFileSync(path.join(process.cwd(), "src/app/privacy/page.tsx"), "utf8");
    expect(source).toMatch(/Google, Microsoft, or email/);
    expect(source).not.toMatch(/Facebook/);
  });
});
