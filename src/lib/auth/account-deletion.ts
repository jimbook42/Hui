export const ACCOUNT_DELETION_CONFIRMATION = "DELETE";

export function isAccountDeletionConfirmed(confirmation: string): boolean {
  return confirmation === ACCOUNT_DELETION_CONFIRMATION;
}
