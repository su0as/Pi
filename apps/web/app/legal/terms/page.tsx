import type { Metadata } from "next";
import { LegalDraft } from "@/components/legal-draft";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return <LegalDraft title="Terms of Service" />;
}
