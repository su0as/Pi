"use client";

import { useRef } from "react";
import { NotesPanel } from "@/components/notes-panel";

/**
 * Combines the reader body and the notes panel in one client component because the notes panel's
 * text-selection anchoring (docs/CONTEXT.md section 7.2) needs a live ref to the reader body's
 * rendered DOM node — a ref that has to be created in the same client-component tree as the
 * element it points to, unlike the server-rendered `bodyHtml` string itself.
 */
export function PaperReaderAndNotes({ workId, bodyHtml }: { workId: string; bodyHtml: string }) {
  const readerRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={readerRef}
        className="reader-content"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: bodyHtml comes from apps/api's /reader endpoint, which only ever serves packages/reader's sanitizeReaderHtml output.
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      <hr className="my-10 border-border" />
      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="font-serif text-xl font-semibold">
          Community notes
        </h2>
        <div className="mt-4">
          <NotesPanel workId={workId} readerContainerRef={readerRef} />
        </div>
      </section>
    </>
  );
}
