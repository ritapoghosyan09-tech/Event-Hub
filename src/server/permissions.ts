/**
 * Who may do what inside an organization. Pure and framework-free, so the
 * same table drives server checks, the studio UI and the unit tests.
 *
 *   OWNER  everything, including the team and payouts
 *   ADMIN  runs events, attendees and check-in; edits the profile
 *   STAFF  door work only: sees attendees, checks tickets in
 *
 * A platform ADMIN (users.role) may act in any organization, for support.
 */
export type MemberRole = "OWNER" | "ADMIN" | "STAFF";

export const ACTIONS = [
  "stats:view",
  "attendees:view",
  "attendees:export",
  "tickets:checkin",
  "event:create",
  "event:edit",
  "event:publish",
  "event:cancel",
  "org:edit",
  "members:manage",
  "payouts:manage",
] as const;
export type Action = (typeof ACTIONS)[number];

const STAFF: Action[] = ["stats:view", "attendees:view", "tickets:checkin"];
const ADMIN: Action[] = [...STAFF, "attendees:export", "event:create", "event:edit", "event:publish", "event:cancel", "org:edit"];
const OWNER: Action[] = [...ADMIN, "members:manage", "payouts:manage"];

const MATRIX: Record<MemberRole, ReadonlySet<Action>> = {
  STAFF: new Set(STAFF),
  ADMIN: new Set(ADMIN),
  OWNER: new Set(OWNER),
};

export function can(role: MemberRole | null | undefined, action: Action, platformRole?: string | null) {
  if (platformRole === "ADMIN") return true;
  return role ? MATRIX[role].has(action) : false;
}

export const ROLE_LABEL: Record<MemberRole, string> = { OWNER: "Owner", ADMIN: "Admin", STAFF: "Door staff" };
