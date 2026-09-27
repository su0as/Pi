import { getTranslations } from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="font-serif text-4xl font-semibold tracking-tight text-balance">
        {t("tagline")}
      </h1>
      <form action="/search" className="mt-8">
        <input
          type="search"
          name="q"
          placeholder={t("searchPlaceholder")}
          className="border-input bg-background w-full rounded-lg border px-4 py-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
    </main>
  );
}
