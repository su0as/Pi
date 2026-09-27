"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/** Client component (unlike the rest of SiteHeader) because sign-in state lives in a
 * `localStorage`-persisted bearer token, not a cookie a server component can read — see
 * lib/auth-client.ts's doc comment. */
export function UserNav() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return <span className="w-12" />;

  if (!session) {
    return (
      <Link href="/signin" className="text-muted-foreground hover:text-foreground">
        Sign in
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        localStorage.removeItem("auth_bearer_token");
        router.push("/");
        router.refresh();
      }}
      className="text-muted-foreground hover:text-foreground"
    >
      Sign out
    </button>
  );
}
