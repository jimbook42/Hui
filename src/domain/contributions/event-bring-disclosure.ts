/** When the bring disclosure should start open on the event detail page. */
export function contributionsDisclosureDefaultOpen(
  hasContributeAttention: boolean,
  hasActiveBringCategories: boolean,
  canAssignContributions: boolean,
): boolean {
  if (hasContributeAttention) {
    return true;
  }
  if (!hasActiveBringCategories && canAssignContributions) {
    return true;
  }
  return false;
}
