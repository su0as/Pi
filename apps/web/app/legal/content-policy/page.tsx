import type { Metadata } from "next";
import { LegalDraft } from "@/components/legal-draft";

export const metadata: Metadata = { title: "Content Policy" };

export default function ContentPolicyPage() {
  return <LegalDraft title="Content Policy" />;
}
