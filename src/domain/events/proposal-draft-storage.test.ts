import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  readStoredProposalDraft,
  readStoredProposalCadence,
  writeStoredProposalCadence,
  writeStoredProposalDraft,
} from "@/domain/events/proposal-draft-storage";
import type { EventProposalDraft } from "@/domain/events/proposal";

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

  it("round-trips meet frequency with the propose draft", () => {
    const draft = {
      title: "Test",
      gatheringType: "dinner_meal" as const,
      gatheringTypeCustom: "",
      location: "",
      notes: "",
      eventKind: "one_off" as const,
      recurrence: null,
      candidates: [],
      initialHostUserId: null,
      foodInvolvement: null,
      hostPlaceRequired: true,
      organiserWillHost: false,
      requestedContributions: [],
    } satisfies EventProposalDraft;

    writeStoredProposalDraft("g2", {
      step: "name",
      draft,
      timeDate: "2026-11-01",
      timeStart: "12:00",
      timeEnd: "",
      meetFrequency: "once",
    });

    expect(readStoredProposalDraft("g2")).toMatchObject({
      step: "name",
      meetFrequency: "once",
      draft: { title: "Test" },
    });
  });
});
