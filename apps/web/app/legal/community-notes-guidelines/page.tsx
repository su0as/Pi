import type { Metadata } from "next";
import { LegalDraft } from "@/components/legal-draft";

export const metadata: Metadata = { title: "Community Notes Guidelines" };

export default function CommunityNotesGuidelinesPage() {
  return <LegalDraft title="Community Notes Guidelines" />;
}
