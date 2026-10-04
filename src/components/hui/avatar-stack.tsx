import { cn } from "@/lib/ui/cn";

export type AvatarPerson = { id: string; name: string };

const TONES = [
  "bg-[var(--blob-blue)]",
  "bg-[var(--blob-clay)]",
  "bg-[var(--blob-sage)]",
] as const;

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Stable colour per person so avatars do not shuffle between renders. */
export function avatarToneClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TONES[hash % TONES.length];
}

const sizeClass = {
  sm: "h-8 w-8 text-[0.6875rem] -ml-2.5 first:ml-0",
  md: "h-10 w-10 text-xs -ml-3 first:ml-0",
  lg: "h-12 w-12 text-sm -ml-3.5 first:ml-0",
} as const;

type AvatarStackProps = {
  people: AvatarPerson[];
  max?: number;
  size?: keyof typeof sizeClass;
  className?: string;
  /** Accessible summary, e.g. "6 people coming". */
  label?: string;
};

export function AvatarStack({ people, max = 5, size = "md", className, label }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  if (people.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center", className)}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {shown.map((person) => (
        <span
          key={person.id}
          aria-hidden="true"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-foreground ring-[3px] ring-[var(--bg-surface)]",
            sizeClass[size],
            avatarToneClass(person.id || person.name),
          )}
        >
          {initialsFor(person.name)}
        </span>
      ))}
      {extra > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-extrabold text-foreground ring-[3px] ring-[var(--bg-surface)]",
            sizeClass[size],
          )}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
