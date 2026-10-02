import { describe, expect, it, vi } from "vitest";

import { deleteAuthUserWithVerification } from "./delete-auth-user";

describe("deleteAuthUserWithVerification", () => {
  it("returns ok when delete succeeds and getUserById finds no user", async () => {
    const admin = {
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
          getUserById: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: "User not found" },
          }),
        },
      },
    };

    const result = await deleteAuthUserWithVerification(
      admin as never,
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({ ok: true });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("fails when deleteUser returns an error", async () => {
    const admin = {
      auth: {
        admin: {
          deleteUser: vi
            .fn()
            .mockResolvedValue({ error: { message: "not allowed" } }),
          getUserById: vi.fn(),
        },
      },
    };

    const result = await deleteAuthUserWithVerification(
      admin as never,
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({ ok: false, error: "not allowed" });
    expect(admin.auth.admin.getUserById).not.toHaveBeenCalled();
  });

  it("fails when the auth user still exists after deleteUser", async () => {
    const admin = {
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
            error: null,
          }),
        },
      },
    };

    const result = await deleteAuthUserWithVerification(
      admin as never,
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({
      ok: false,
      error: "Auth user still exists after deletion.",
    });
  });
});
