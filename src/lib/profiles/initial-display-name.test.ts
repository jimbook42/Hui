import { describe, expect, it } from "vitest";

import { initialDisplayNameFromAuthMetadata } from "./initial-display-name";

describe("initialDisplayNameFromAuthMetadata", () => {
  it("prefers full_name for new OAuth users", () => {
    expect(
      initialDisplayNameFromAuthMetadata(
        { full_name: "Isaac Tull", name: "Isaac", display_name: "isaactull42" },
        "isaactull42@gmail.com",
      ),
    ).toBe("Isaac Tull");
  });

  it("falls back to name when full_name is absent", () => {
    expect(
      initialDisplayNameFromAuthMetadata({ name: "Isaac Tull" }, "solo@hui.test"),
    ).toBe("Isaac Tull");
  });

  it("uses display_name when no provider person name exists", () => {
    expect(
      initialDisplayNameFromAuthMetadata({ display_name: "Chosen Name" }, "solo@hui.test"),
    ).toBe("Chosen Name");
  });

  it("falls back to the email local-part when metadata has no useful name", () => {
    expect(initialDisplayNameFromAuthMetadata({}, "isaactull42@gmail.com")).toBe(
      "isaactull42",
    );
  });

  it("prefers full_name over display_name for provider metadata", () => {
    expect(
      initialDisplayNameFromAuthMetadata(
        { full_name: "Isaac Tull", display_name: "isaactull42" },
        "isaactull42@gmail.com",
      ),
    ).toBe("Isaac Tull");
  });

  it("preserves email/password sign-up display_name when no provider person name exists", () => {
    expect(
      initialDisplayNameFromAuthMetadata({ display_name: "Email User" }, "user@hui.test"),
    ).toBe("Email User");
  });

  it("resolves Microsoft/Azure metadata the same as other OAuth providers", () => {
    expect(
      initialDisplayNameFromAuthMetadata(
        { full_name: "Isaac Tull", name: "Isaac Tull", email: "isaac@outlook.com" },
        "isaac@outlook.com",
      ),
    ).toBe("Isaac Tull");
  });

  it("resolves Facebook metadata from Supabase (name and full_name from Graph)", () => {
    expect(
      initialDisplayNameFromAuthMetadata(
        {
          full_name: "Jane Doe",
          name: "Jane Doe",
          avatar_url: "https://platform-lookaside.fbsbx.com/platform/profilepic/example.jpg",
          email: "jane@example.com",
          email_verified: true,
          provider_id: "123456789",
        },
        "jane@example.com",
      ),
    ).toBe("Jane Doe");
  });

  it("uses Facebook name when full_name is absent in metadata", () => {
    expect(
      initialDisplayNameFromAuthMetadata(
        { name: "Jane Doe", provider_id: "123456789" },
        "jane@example.com",
      ),
    ).toBe("Jane Doe");
  });
});
