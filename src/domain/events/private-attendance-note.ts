/** Read the private note that should be sent with a save (trimmed). */
export function privateAttendanceNoteForCandidate(input: {
  multipleTimeOptions: boolean;
  candidateId: string;
  notesByCandidate: Readonly<Record<string, string>>;
  singleNote: string;
}): string {
  const raw = input.multipleTimeOptions
    ? (input.notesByCandidate[input.candidateId] ?? "")
    : input.singleNote;
  return raw.trim();
}
