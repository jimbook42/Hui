/** Chains attendance saves so only one server action runs at a time (avoids Next aborting in-flight actions). */
export function createAttendanceSaveSerializer() {
  let tail: Promise<void> = Promise.resolve();

  return function runSerializedAttendanceSave<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(() => task());
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
