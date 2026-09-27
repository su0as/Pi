import { permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { apiClient } from "@/lib/api";

/**
 * docs/CONTEXT.md section 5.1's `/abs/[...id]`, `/doi/[...doi]`, `/html/[...id]`, `/pdf/[...id]`
 * routes all funnel through `GET /v1/works/resolve` and land on the canonical `/paper/{workId}`
 * — "any link opens the same page." A `pending` result (still-ingesting on first sight) can't
 * redirect anywhere real yet, so it renders a short "still processing" message instead.
 */
export async function resolveAndRedirect(id: string) {
  const client = await apiClient();
  const { data, error } = await client.GET("/v1/works/resolve", { params: { query: { id } } });

  if (error || !data) {
    return <ResolveFailed />;
  }
  if (data.status === "pending") {
    return <ResolvePending />;
  }
  if (data.workId) {
    permanentRedirect(`/paper/${data.workId}`);
  }
  return <ResolveFailed />;
}

async function ResolvePending() {
  const t = await getTranslations("Resolve");
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-muted-foreground">{t("pending")}</p>
    </main>
  );
}

async function ResolveFailed() {
  const t = await getTranslations("Resolve");
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-muted-foreground">{t("notFound")}</p>
    </main>
  );
}
