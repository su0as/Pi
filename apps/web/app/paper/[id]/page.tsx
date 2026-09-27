import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { apiClient } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function loadWork(id: string) {
  const client = await apiClient();
  const { data, error, response } = await client.GET("/v1/works/{workId}", {
    params: { path: { workId: id } },
  });
  if (response.status === 404) return null;
  if (error || !data) throw new Error(`Failed to load work ${id}: ${JSON.stringify(error)}`);
  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const work = await loadWork(id);
  if (!work) return { title: "Paper not found" };

  return {
    title: work.title,
    description: work.abstract?.slice(0, 200),
    alternates: { canonical: `/paper/${work.id}` },
  };
}

/** docs/CONTEXT.md section 5.1's SEO requirement: JSON-LD ScholarlyArticle on paper pages. `json`
 * is built here from already-typed, already-loaded work metadata — never from user input. */
function ScholarlyArticleJsonLd({ json }: { json: Record<string, unknown> }) {
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: json is our own constructed object, not user input.
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}

/** bodyHtml comes from apps/api's /reader endpoint, which only ever serves packages/reader's
 * sanitizeReaderHtml output — never raw source HTML. */
function ReaderBody({ bodyHtml }: { bodyHtml: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: bodyHtml is pre-sanitized — see the doc comment above.
  return <div className="reader-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}

export default async function PaperPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations("Paper");
  const work = await loadWork(id);
  if (!work) notFound();

  const client = await apiClient();
  const { data: reader } = await client.GET("/v1/works/{workId}/reader", {
    params: { path: { workId: id } },
  });

  const arxivId = work.identifiers.find((i) => i.scheme === "arxiv")?.valueNormalized;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: work.title,
    abstract: work.abstract ?? undefined,
    datePublished: work.publishedAt ?? undefined,
    author: work.authors.map((a) => ({ "@type": "Person", name: a.name })),
    ...(arxivId ? { sameAs: `https://arxiv.org/abs/${arxivId}` } : {}),
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <ScholarlyArticleJsonLd json={jsonLd} />

      <h1 className="font-serif text-3xl font-semibold text-balance">{work.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {work.authors.map((a) => a.name).join(", ")}
        {work.publishedAt ? ` · ${new Date(work.publishedAt).getFullYear()}` : null}
      </p>

      {work.abstract ? <p className="mt-6 leading-relaxed">{work.abstract}</p> : null}

      <div className="mt-6 flex gap-3 text-sm">
        {arxivId ? (
          <a
            href={`https://arxiv.org/abs/${arxivId}`}
            className="text-primary underline underline-offset-4"
          >
            {t("readOnArxiv")}
          </a>
        ) : null}
      </div>

      <hr className="my-10 border-border" />

      <section aria-labelledby="reader-heading">
        {reader?.status === "ready" && reader.bodyHtml ? (
          <ReaderBody bodyHtml={reader.bodyHtml} />
        ) : reader?.status === "pending" ? (
          <p className="text-sm text-muted-foreground">{t("readerPending")}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("readerUnavailable")}</p>
        )}
      </section>

      <hr className="my-10 border-border" />

      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="font-serif text-xl font-semibold">
          {t("notesHeading")}
        </h2>
        {/* Real notes/ratings UI lands in M7 — packages/core's note schemas and apps/api's
            note routes don't exist yet. */}
        <p className="mt-2 text-sm text-muted-foreground">{t("noNotesYet")}</p>
      </section>
    </main>
  );
}
