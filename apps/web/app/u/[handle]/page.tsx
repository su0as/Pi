import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

export default async function ProfilePage({ params }: PageProps) {
  const { handle } = await params;
  return <ComingSoon heading={`@${handle}`} milestone="M8" />;
}
