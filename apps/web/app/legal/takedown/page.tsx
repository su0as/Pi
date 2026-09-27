import type { Metadata } from "next";
import { LegalDraft } from "@/components/legal-draft";

export const metadata: Metadata = { title: "Takedown Requests" };

export default function TakedownPage() {
  return <LegalDraft title="Takedown Requests" />;
}
