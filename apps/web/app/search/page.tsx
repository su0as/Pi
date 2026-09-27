import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return <ComingSoon heading="Search" milestone="M8" />;
}
