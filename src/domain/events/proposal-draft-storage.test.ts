import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  readStoredProposalCadence,
  writeStoredProposalCadence,
} from "@/domain/events/proposal-draft-storage";

describe("proposal draft cadence storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    const session = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    };
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("window", { sessionStorage: session });
  });

  it("round-trips fortnightly cadence for a group", () => {
    writeStoredProposalCadence("g1", { intervalUnit: "week", intervalCount: 2 });
    expect(readStoredProposalCadence("g1")).toEqual({
      intervalUnit: "week",
      intervalCount: 2,
    });
  });
});
