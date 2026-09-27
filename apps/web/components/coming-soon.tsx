/**
 * Every route this backs is real (linked from the nav, indexable, has its own metadata) but has
 * no data model or backend route to call yet — CLAUDE.md: "design for later phases, build only
 * the current one." Each caller names which milestone actually builds it.
 */
export function ComingSoon({ heading, milestone }: { heading: string; milestone: string }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-serif text-2xl font-semibold">{heading}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Coming in {milestone}.</p>
    </main>
  );
}
