const STORAGE_PREFIX = "hui.defer-host-prompt.";

export function markHostPromptDeferred(eventId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${eventId}`, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

export function isHostPromptDeferred(eventId: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return sessionStorage.getItem(`${STORAGE_PREFIX}${eventId}`) !== null;
  } catch {
    return false;
  }
}

export function clearHostPromptDeferral(eventId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${eventId}`);
  } catch {
    // ignore
  }
}
