"use client";

import { useRef } from "react";
import { NotesPanel } from "@/components/notes-panel";

/** Used when there's no ready reader document to anchor against (still pending, or no HTML
 * rendering exists for this version) — notes can still be written, just never anchored to a
 * passage (e.g. a `helpful_resource` note, which isn't anchored either way). */
export function NotesOnlySection({ workId }: { workId: string }) {
  const emptyRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={emptyRef} />
      <NotesPanel workId={workId} readerContainerRef={emptyRef} />
    </>
  );
}
