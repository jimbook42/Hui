import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal/privacy-contact";
import {
  PRIVACY_LAST_UPDATED,
  PRIVACY_SECTION_HEADINGS,
  PRIVACY_STATEMENT_TITLE,
} from "@/lib/legal/privacy-statement-constants";

describe("privacy page copy", () => {
  it("renders the approved privacy statement headings and contact details", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { level: 1, name: PRIVACY_STATEMENT_TITLE })).toBeTruthy();
    expect(screen.getByText(`Last updated: ${PRIVACY_LAST_UPDATED}`)).toBeTruthy();
    expect(screen.getAllByText(PRIVACY_CONTACT_EMAIL).length).toBeGreaterThan(0);

    for (const heading of PRIVACY_SECTION_HEADINGS) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
  });
});
