import type { EventProposalDraft } from "@/domain/events/proposal";
import type { StoredMeetFrequency } from "@/domain/events/proposal-draft-meet-frequency";

export type { StoredMeetFrequency } from "@/domain/events/proposal-draft-meet-frequency";
export { deriveMeetFrequencyFromDraft } from "@/domain/events/proposal-draft-meet-frequency";

export type { StoredProposalCadence } from "@/domain/events/proposal-draft-cadence";
export {
  readStoredProposalCadence,
  writeStoredProposalCadence,
} from "@/domain/events/proposal-draft-cadence";

const DRAFT_VERSION = 3;

type StoredProposalDraft = {
  version: number;
  step: "name" | "time" | "review";
  draft: EventProposalDraft;
  timeDate: string;
  timeStart: string;
  timeEnd: string;
  meetFrequency?: StoredMeetFrequency;
};

function draftStorageKey(groupId: string): string {
  return `hui.propose-draft.${groupId}`;
}

export function readStoredProposalDraft(groupId: string): StoredProposalDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(draftStorageKey(groupId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredProposalDraft;
    if (parsed.version !== DRAFT_VERSION || !parsed.draft) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredProposalDraft(groupId: string, payload: Omit<StoredProposalDraft, "version">): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(
      draftStorageKey(groupId),
      JSON.stringify({ ...payload, version: DRAFT_VERSION }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredProposalDraft(groupId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(draftStorageKey(groupId));
  } catch {
    // ignore
  }
}
