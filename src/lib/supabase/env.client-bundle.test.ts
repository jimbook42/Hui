import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Next.js only inlines NEXT_PUBLIC_* into client bundles when env vars are read with
 * literal property access on process.env (not dynamic env[key]).
 */
describe("getPublicSupabaseConfig client bundle inlining", () => {
  it("uses literal process.env.NEXT_PUBLIC_* for the default code path", () => {
    const source = readFileSync(path.join(import.meta.dirname, "env.ts"), "utf8");

    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
    expect(source).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});
