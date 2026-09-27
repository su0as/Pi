import { brand } from "@repo/config/brand";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="border-border mt-16 border-t">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
        <p>
          {brand.name} — {new Date().getFullYear()}
        </p>
        <div className="flex gap-4">
          <Link href="/legal/terms" className="hover:text-foreground">
            {t("legal")}
          </Link>
          <a href={`mailto:${brand.supportEmail}`} className="hover:text-foreground">
            {t("about")}
          </a>
        </div>
      </div>
    </footer>
  );
}
