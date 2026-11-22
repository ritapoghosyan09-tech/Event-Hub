import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/server/session";
import { getMyOrganizations } from "@/server/me";
import { StudioSkeleton } from "@/components/studio/StudioShell";

/** /studio → your first organization, or the start-hosting form. */
export default function StudioIndex() {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <Pick />
    </Suspense>
  );
}

async function Pick(): Promise<never> {
  const user = await requireUser("/studio");
  const orgs = await getMyOrganizations(user);
  redirect(orgs[0] ? `/studio/${orgs[0].slug}` : "/studio/new");
}
