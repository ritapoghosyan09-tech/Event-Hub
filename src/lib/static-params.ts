/**
 * With Cache Components, generateStaticParams must return at least one param
 * or the build fails. A brand-new production database has no events or
 * organizers yet, so fall back to one slug that never exists: it prerenders
 * the ordinary "not found" page, and real slugs replace it once data exists.
 * Pages for slugs created after the build are rendered on first visit.
 */
export const PLACEHOLDER_SLUG = "_none";

export function atLeastOne(slugs: string[]) {
  return (slugs.length ? slugs : [PLACEHOLDER_SLUG]).map((slug) => ({ slug }));
}
