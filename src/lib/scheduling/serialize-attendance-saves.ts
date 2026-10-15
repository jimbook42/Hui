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

/** One serializer per candidate so saves on different times can run in parallel. */
export function createPerCandidateAttendanceSaveSerializers() {
  const byCandidate = new Map<string, ReturnType<typeof createAttendanceSaveSerializer>>();

  return function runSerializedAttendanceSaveForCandidate<T>(
    candidateId: string,
    task: () => Promise<T>,
  ): Promise<T> {
    let serializer = byCandidate.get(candidateId);
    if (!serializer) {
      serializer = createAttendanceSaveSerializer();
      byCandidate.set(candidateId, serializer);
    }
    return serializer(task);
  };
}
