import { resolveAndRedirect } from "@/lib/resolve-identifier";

interface PageProps {
  params: Promise<{ doi: string[] }>;
}

// DOIs contain a slash (10.xxxx/suffix) — a catch-all segment, not a single dynamic one.
export default async function DoiPage({ params }: PageProps) {
  const { doi } = await params;
  return resolveAndRedirect(doi.join("/"));
}
