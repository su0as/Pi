import { brand } from "@repo/config/brand";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserNav } from "@/components/user-nav";

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="border-border sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-serif text-lg font-semibold">
          {brand.shortName}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/search" className="text-muted-foreground hover:text-foreground">
            {t("search")}
          </Link>
          <Link href="/library" className="text-muted-foreground hover:text-foreground">
            {t("library")}
          </Link>
          <Link href="/rate" className="text-muted-foreground hover:text-foreground">
            {t("rate")}
          </Link>
          <UserNav />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
