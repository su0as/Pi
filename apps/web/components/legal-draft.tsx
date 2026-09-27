/**
 * docs/CONTEXT.md section 14 — "Legal pages ... as MDX, clearly marked DRAFT" (M9's scope). These
 * route stubs exist now (linked from the footer, real metadata) so the URLs are stable; the real
 * MDX content and the DRAFT-marking UI it describes land in M9.
 */
export function LegalDraft({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Draft</p>
      <h1 className="mt-1 font-serif text-2xl font-semibold">{title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        This page is a placeholder. Real content lands in M9.
      </p>
    </main>
  );
}
