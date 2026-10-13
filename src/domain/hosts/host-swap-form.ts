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
    return "Ask to swap";
  }
  return step === "confirm" ? "Yes, step back" : "Ask to swap";
}

export function shouldIncludeNoReplacementAck(
  hasReplacement: boolean,
  step: HostSwapNoReplacementStep,
): boolean {
  return !hasReplacement && step === "confirm";
}
