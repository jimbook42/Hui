import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMAIL_SIGN_IN_CREDENTIALS_ERROR } from "@/lib/auth/email-sign-in";

const signInWithPassword = vi.fn();
const redirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirect(...args),
  unstable_rethrow: (error: unknown) => {
    throw error;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword },
  })),
}));

vi.mock("@/lib/profiles/ensure-profile", () => ({
  ensureUserProfile: vi.fn(),
}));

vi.mock("@/lib/auth/action-timeout", () => ({
  withAuthActionTimeout: (work: () => Promise<unknown>) => work(),
  AuthActionTimeoutError: class AuthActionTimeoutError extends Error {},
  authTimeoutUserMessage: () => "timeout",
}));

describe("signInAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockImplementation(() => {
      throw new Error("REDIRECT");
    });
  });

  it("returns a generic credentials error when sign-in fails", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const { signInAction } = await import("@/app/auth/actions");
    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("password", "wrong-password");
    formData.set("next", "/dashboard");

    const result = await signInAction({}, formData);

    expect(result.error).toBe(EMAIL_SIGN_IN_CREDENTIALS_ERROR);
    expect(result.fields).toEqual({ email: "user@example.com" });
    expect(redirect).not.toHaveBeenCalled();
  });
});
