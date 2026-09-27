import type { Metadata } from "next";
import { LegalDraft } from "@/components/legal-draft";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return <LegalDraft title="Privacy Policy" />;
}
