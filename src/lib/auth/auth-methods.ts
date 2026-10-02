import type { User } from "@supabase/supabase-js";

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email and password",
  google: "Google",
  azure: "Microsoft",
  facebook: "Facebook",
  apple: "Apple",
};

const LABEL_ORDER = [
  "Email and password",
  "Google",
  "Microsoft",
  "Facebook",
  "Apple",
] as const;

function labelForProvider(provider: string): string | null {
  const normalized = provider.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return PROVIDER_LABELS[normalized] ?? null;
}

/**
 * Human-readable sign-in methods linked to this Supabase Auth user.
 * Does not perform linking, merging, or email-based account matching.
 */
export function authMethodLabelsForUser(user: User): string[] {
  const providers = new Set<string>();

  for (const identity of user.identities ?? []) {
    const label = labelForProvider(identity.provider);
    if (label) {
      providers.add(label);
    }
  }

  if (providers.size === 0 && user.email) {
    providers.add(PROVIDER_LABELS.email);
  }

  return LABEL_ORDER.filter((label) => providers.has(label));
}
