import { afterEach, describe, expect, it, vi } from "vitest";

import {
  INVITE_SHARE_TEXT,
  INVITE_SHARE_TITLE,
  canUseWebShare,
  copyInviteLink,
  shareOrCopyInviteLink,
} from "./share";

describe("invite sharing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects Web Share support", () => {
    vi.stubGlobal("navigator", { share: vi.fn() });
    expect(canUseWebShare()).toBe(true);
    vi.stubGlobal("navigator", {});
    expect(canUseWebShare()).toBe(false);
  });

  it("uses native share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, clipboard: { writeText: vi.fn() } });

    const result = await shareOrCopyInviteLink("https://hui.example/join/abc");
    expect(result).toEqual({ outcome: "shared" });
    expect(share).toHaveBeenCalledWith({
      title: INVITE_SHARE_TITLE,
      text: INVITE_SHARE_TEXT,
      url: "https://hui.example/join/abc",
    });
  });

  it("treats cancelled share as non-error", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError"));
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    const result = await shareOrCopyInviteLink("https://hui.example/join/abc");
    expect(result).toEqual({ outcome: "cancelled" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to copy when share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await shareOrCopyInviteLink("https://hui.example/join/abc");
    expect(result).toEqual({ outcome: "copied" });
    expect(writeText).toHaveBeenCalledWith("https://hui.example/join/abc");
  });

  it("copies directly for the copy action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await copyInviteLink("https://hui.example/join/token");
    expect(result).toEqual({ outcome: "copied" });
  });
});
