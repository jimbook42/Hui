/** Map database finalise errors to plain language for the UI. */
export function friendlyFinaliseErrorMessage(message: string): string {
  if (message.includes("waiting on the host to say yes")) {
    return "The host can't make that time. Ask them to answer Yes or swap hosting first.";
  }
  return message;
}
