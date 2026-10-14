"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  AvatarStack,
  type AvatarPerson,
} from "@/components/hui/avatar-stack";
import type { MembershipRole } from "@/domain/groups/permissions";

export type GroupMemberRosterEntry = {
  userId: string;
  displayName: string;
  role: MembershipRole;
};

function memberRoleLabel(role: MembershipRole): string {
  if (role === "owner") return "Organiser";
  if (role === "admin") return "Admin";
  return "Member";
}

type GroupMembersRosterSheetProps = {
  members: GroupMemberRosterEntry[];
  memberCount: number;
};

export function GroupMembersRosterSheet({ members, memberCount }: GroupMembersRosterSheetProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  const people: AvatarPerson[] = members.map((member) => ({
    id: member.userId,
    name: member.displayName,
  }));

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hui-focus-ring rounded-full text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <AvatarStack
          people={people}
          max={7}
          size="md"
          label={`${memberCount} ${memberCount === 1 ? "member" : "members"}. Open member list.`}
        />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close member list"
            onClick={close}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 mx-auto w-full max-w-md rounded-t-hui-2xl bg-surface px-5 pb-8 pt-5 hui-shadow-lg sm:rounded-hui-2xl sm:pb-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={titleId} className="hui-type-section text-foreground">
                Members
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="hui-focus-ring inline-flex min-h-11 items-center rounded-full px-3 text-sm font-extrabold text-muted-foreground"
              >
                Done
              </button>
            </div>
            <ul className="mt-4 max-h-[min(24rem,70vh)] space-y-2 overflow-y-auto">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 rounded-hui-lg bg-muted/60 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate font-extrabold text-foreground">
                    {member.displayName}
                  </span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {memberRoleLabel(member.role)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
