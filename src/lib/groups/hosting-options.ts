import type { MemberHostingStanding } from "@/lib/groups/types";

/** Member-facing wording for hosting standing. Semantics live in the database; only labels here. */
export const hostingOptions: { value: MemberHostingStanding; label: string }[] = [
  { value: "default", label: "Happy to host sometimes" },
  { value: "always", label: "I always host" },
  { value: "prefer_not", label: "I'd rather not host" },
  { value: "never", label: "I don't host" },
];
