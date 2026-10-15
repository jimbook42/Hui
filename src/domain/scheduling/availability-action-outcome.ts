import type { EventActionState } from "@/app/events/actions";

export const ATTENDANCE_SAVE_CONNECTION_MESSAGE =
  "Couldn't save — check your connection and tap Retry.";

/** True only when the server returned an explicit success payload. */
export function isAttendanceActionSuccess(
  result: EventActionState | undefined | null,
): boolean {
  if (!result || result.error) {
    return false;
  }
  return Boolean(result.message ?? result.notice);
}

export function attendanceActionErrorMessage(
  result: EventActionState | undefined | null,
): string {
  if (result?.error?.trim()) {
    return result.error;
  }
  return ATTENDANCE_SAVE_CONNECTION_MESSAGE;
}

export function attendanceSaveCatchMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (
      !message ||
      message === "Failed to fetch" ||
      /failed to fetch/i.test(message) ||
      /network error/i.test(message)
    ) {
      return ATTENDANCE_SAVE_CONNECTION_MESSAGE;
    }
    return message;
  }
  return ATTENDANCE_SAVE_CONNECTION_MESSAGE;
}
