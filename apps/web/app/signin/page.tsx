import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Sign in" };

// apps/api's auth (email OTP, Google, Apple) has been live since M3 — this page just hasn't been
// wired to it yet. A real sign-in form is the natural first thing M7 needs (notes/ratings require
// a signed-in session), so it lands there rather than being built in isolation here.
export default function SignInPage() {
  return <ComingSoon heading="Sign in" milestone="M7" />;
}
