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
});
