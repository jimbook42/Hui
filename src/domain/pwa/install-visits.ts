/**
 * Install-card visit counting: one increment per browser session, not per in-app navigation.
 * Sign-up → onboarding → dashboard must not bump the count three times on the first day.
 */

export function applySessionVisitIncrement(input: {
  visitCount: number;
  sessionAlreadyCounted: boolean;
}): { visitCount: number; sessionAlreadyCounted: boolean } {
  if (input.sessionAlreadyCounted) {
    return input;
  }
  return {
    visitCount: input.visitCount + 1,
    sessionAlreadyCounted: true,
  };
}
