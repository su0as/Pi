import { resolveAndRedirect } from "@/lib/resolve-identifier";

interface PageProps {
  params: Promise<{ id: string[] }>;
}

// docs/CONTEXT.md section 10 — "any link opens the same page": /html/{id} resolves the same way
// /abs/{id} does and lands on /paper/{workId}, which is what actually renders the HTML reader
// view (or the pending/unavailable state) — no separate viewer to keep in sync with it.
export default async function HtmlPage({ params }: PageProps) {
  const { id } = await params;
  return resolveAndRedirect(id.join("/"));
}
