import { resolveAndRedirect } from "@/lib/resolve-identifier";

interface PageProps {
  params: Promise<{ id: string[] }>;
}

// Old-style arXiv ids can contain a slash (e.g. /abs/cs/0301041) — the catch-all segment
// preserves that instead of a single dynamic segment, which can't.
export default async function AbsPage({ params }: PageProps) {
  const { id } = await params;
  return resolveAndRedirect(id.join("/"));
}
