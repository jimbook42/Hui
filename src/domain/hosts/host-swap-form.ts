export type HostSwapNoReplacementStep = "idle" | "confirm";

export function hostSwapPrimaryActionLabel(
  hasReplacement: boolean,
  step: HostSwapNoReplacementStep,
  pending: boolean,
): string {
  if (pending) {
    return "Please wait…";
  }
  if (hasReplacement) {
    return "Ask to swap hosting";
  }
  return step === "confirm" ? "Yes, step back" : "Ask to swap hosting";
}

export function shouldIncludeNoReplacementAck(
  hasReplacement: boolean,
  step: HostSwapNoReplacementStep,
): boolean {
  return !hasReplacement && step === "confirm";
}
