import { resolveAndRedirect } from "@/lib/resolve-identifier";

interface PageProps {
  params: Promise<{ id: string[] }>;
}

// Same "any link opens the same page" resolution as /abs and /html. The actual PDF-fallback
// viewer/proxy (docs/CONTEXT.md section 10) isn't built yet — an explicit, flagged known gap
// carried over from M5 (see docs/adr/0008 and packages/reader's own scoping note) — so a work
// with no HTML reader document just shows /paper/{workId}'s "no reader view yet" state for now.
export default async function PdfPage({ params }: PageProps) {
  const { id } = await params;
  return resolveAndRedirect(id.join("/"));
}
