import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EMAIL_SIGN_IN_CREDENTIALS_ERROR } from "@/lib/auth/email-sign-in";

const signInAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/auth/actions", () => ({
  signInAction: (...args: unknown[]) => signInAction(...args),
}));

import { EmailSignInForm } from "@/components/auth/email-sign-in-form";

describe("EmailSignInForm", () => {
  it("shows a credentials error after a failed sign-in and clears it when a field changes", async () => {
    const user = userEvent.setup();
    signInAction.mockResolvedValue({
      error: EMAIL_SIGN_IN_CREDENTIALS_ERROR,
      fields: { email: "user@example.com" },
    });

    render(<EmailSignInForm next="/dashboard" />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      EMAIL_SIGN_IN_CREDENTIALS_ERROR,
    );

    await user.type(screen.getByLabelText("Email"), "x");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
