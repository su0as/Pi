import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Rate" };

export default function RatePage() {
  return <ComingSoon heading="Rate queue" milestone="M8" />;
}
