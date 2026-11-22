/**
 * Data access layer for the signed-in user. Every page, Server Action and
 * route handler that needs a user goes through here, so the session is
 * checked on the server, next to the data, every time.
 *
 * Reading the session reads the request, so callers sit inside <Suspense>.
 */
import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { can, type Action, type MemberRole } from "./permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "USER" | "ADMIN";
  city: string | null;
  image: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; city?: string | null };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    role: u.role === "ADMIN" ? "ADMIN" : "USER",
    city: u.city ?? null,
    image: u.image ?? null,
  };
}

/** The signed-in user, or a redirect to sign in that comes back to `next`. */
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return user;
}

export type OrgAccess = {
  user: CurrentUser;
  org: { id: string; slug: string; name: string; status: string; payoutsEnabled: boolean };
  role: MemberRole | null; // null = platform admin acting for support
  can: (action: Action) => boolean;
};

/**
 * Loads an organization the user belongs to. Not a member (and not a platform
 * admin) → 404, so the studio never confirms an organization to outsiders.
 * Pages then check `access.can(action)` and show a "not in your role" panel.
 */
export async function requireOrgAccess(slug: string, next: string): Promise<OrgAccess> {
  const user = await requireUser(next);
  const org = await db.organization.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, status: true, payoutsEnabled: true, members: { where: { userId: user.id }, select: { role: true } } },
  });
  const role = (org?.members[0]?.role ?? null) as MemberRole | null;
  if (!org || (!role && user.role !== "ADMIN")) notFound();
  return {
    user,
    org: { id: org.id, slug: org.slug, name: org.name, status: org.status, payoutsEnabled: org.payoutsEnabled },
    role,
    can: (a) => can(role, a, user.role),
  };
}

/** Same check for Server Actions and route handlers: throws instead of redirecting. */
export class AccessError extends Error {
  constructor(public status: 401 | 403 | 404, message: string) {
    super(message);
  }
}

export async function assertOrgAction(orgId: string, action: Action): Promise<{ user: CurrentUser; role: MemberRole | null }> {
  const user = await getCurrentUser();
  if (!user) throw new AccessError(401, "Sign in to continue.");
  const member = await db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: orgId, userId: user.id } }, select: { role: true } });
  const role = (member?.role ?? null) as MemberRole | null;
  if (!role && user.role !== "ADMIN") throw new AccessError(404, "Organization not found.");
  if (!can(role, action, user.role)) throw new AccessError(403, "Your role doesn't allow this.");
  return { user, role };
}
