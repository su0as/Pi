"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import { AddNoteForm } from "@/components/add-note-form";
import { Button } from "@/components/ui/button";
import { browserApiClient } from "@/lib/api-client-browser";
import { authClient } from "@/lib/auth-client";
import { useTextSelection } from "@/lib/use-text-selection";

const STATUS_LABEL: Record<string, string> = {
  currently_rated_helpful: "Helpful",
  needs_more_ratings: "Needs more ratings",
  draft: "Needs more ratings",
  currently_rated_not_helpful: "Not helpful",
};

function RatingButtons({ workId, noteId }: { workId: string; noteId: string }) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const rate = useMutation({
    mutationFn: async (value: "helpful" | "somewhat" | "not_helpful") => {
      const { error } = await browserApiClient().POST("/v1/notes/{noteId}/ratings", {
        params: { path: { noteId } },
        body: { value, reasons: [] },
      });
      if (error) throw new Error(JSON.stringify(error));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes", workId] }),
  });

  if (!session) return null;

  return (
    <div className="mt-2 flex gap-2 text-xs">
      <button
        type="button"
        disabled={rate.isPending}
        onClick={() => rate.mutate("helpful")}
        className="rounded-full border border-border px-2 py-1 hover:bg-accent"
      >
        Helpful
      </button>
      <button
        type="button"
        disabled={rate.isPending}
        onClick={() => rate.mutate("somewhat")}
        className="rounded-full border border-border px-2 py-1 hover:bg-accent"
      >
        Somewhat
      </button>
      <button
        type="button"
        disabled={rate.isPending}
        onClick={() => rate.mutate("not_helpful")}
        className="rounded-full border border-border px-2 py-1 hover:bg-accent"
      >
        Not helpful
      </button>
    </div>
  );
}

interface NoteDto {
  id: string;
  type: string;
  body: string;
  status: string;
  ratingCounts: { helpful: number; somewhat: number; not_helpful: number };
  authorReply: { body: string } | null;
}

export function NotesPanel({
  workId,
  readerContainerRef,
}: {
  workId: string;
  readerContainerRef: RefObject<HTMLElement | null>;
}) {
  const [showForm, setShowForm] = useState(false);
  const selection = useTextSelection(readerContainerRef);
  const formAnchorRef = useRef<typeof selection>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["notes", workId],
    queryFn: async () => {
      const { data, error } = await browserApiClient().GET("/v1/works/{workId}/notes", {
        params: { path: { workId } },
      });
      if (error) throw new Error(JSON.stringify(error));
      return data;
    },
  });

  const notes = (data?.data ?? []) as NoteDto[];

  return (
    <div className="flex flex-col gap-4">
      {selection && !showForm ? (
        <div
          className="fixed z-20 -translate-y-full"
          style={{ top: selection.rect.top, left: selection.rect.left }}
        >
          <Button
            size="sm"
            onClick={() => {
              formAnchorRef.current = selection;
              setShowForm(true);
            }}
          >
            Add note
          </Button>
        </div>
      ) : null}

      {showForm ? (
        <AddNoteForm
          workId={workId}
          documentText={readerContainerRef.current?.textContent ?? null}
          selection={formAnchorRef.current}
          onDone={() => {
            setShowForm(false);
            formAnchorRef.current = null;
          }}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => setShowForm(true)}
        >
          Write a note
        </Button>
      )}

      {isLoading ? <p className="text-sm text-muted-foreground">Loading notes…</p> : null}

      {!isLoading && notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet on this paper.</p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {notes.map((note) => (
          <li key={note.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {note.type.replace(/_/g, " ")}
              </span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs">
                {STATUS_LABEL[note.status] ?? note.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed">{note.body}</p>
            {note.authorReply ? (
              <div className="mt-3 rounded-md bg-accent p-3 text-sm">
                <span className="text-xs font-semibold">Author reply: </span>
                {note.authorReply.body}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {note.ratingCounts.helpful} helpful · {note.ratingCounts.somewhat} somewhat ·{" "}
              {note.ratingCounts.not_helpful} not helpful
            </p>
            <RatingButtons workId={workId} noteId={note.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
