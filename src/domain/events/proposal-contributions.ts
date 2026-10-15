import { normalizeContributionDescription } from "@/domain/contributions/validation";

import type { ProposalContributionRequest } from "./proposal";

export function normalizeProposalContributionRequests(
  raw: ProposalContributionRequest[],
  categoryNames: Map<string, string>,
): { ok: true; requests: ProposalContributionRequest[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const requests: ProposalContributionRequest[] = [];

  for (const item of raw) {
    const categoryId = item.categoryId?.trim();
    if (!categoryId) {
      continue;
    }
    if (seen.has(categoryId)) {
      continue;
    }
    const categoryName = categoryNames.get(categoryId);
    if (!categoryName) {
      return { ok: false, error: "Choose valid categories for what to bring." };
    }
    const label = normalizeContributionDescription(item.label ?? "", categoryName);
    if (!label) {
      return { ok: false, error: "Enter a valid description for what you are bringing." };
    }
    seen.add(categoryId);
    requests.push({ categoryId, label });
  }

  return { ok: true, requests };
}
