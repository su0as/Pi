"use client";

import { createAnchor } from "@repo/core/anchoring";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { browserApiClient } from "@/lib/api-client-browser";
import { authClient } from "@/lib/auth-client";
import type { SelectionAnchor } from "@/lib/use-text-selection";

const NOTE_TYPES = [
  { value: "reproduced", label: "Reproduced" },
  { value: "failed_to_reproduce", label: "Failed to reproduce" },
  { value: "correction", label: "Correction" },
  { value: "missing_context", label: "Missing context" },
  { value: "code_data_issue", label: "Code/data issue" },
  { value: "helpful_resource", label: "Helpful resource" },
] as const;

const EVIDENCE_KINDS = [
  "repository",
  "log_output",
  "dataset",
  "citation",
  "publication",
  "external_link",
  "upload",
  "other",
] as const;

export function AddNoteForm({
  workId,
  documentText,
  selection,
  onDone,
}: {
  workId: string;
  /** The reader body's full plain text — needed to build the W3C TextQuoteSelector's
   * prefix/suffix context (docs/CONTEXT.md section 7.2). Null for notes with no text selection
   * (e.g. `helpful_resource`, which isn't anchored to a passage). */
  documentText: string | null;
  selection: SelectionAnchor | null;
  onDone: () => void;
}) {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [type, setType] = useState<(typeof NOTE_TYPES)[number]["value"]>("correction");
  const [body, setBody] = useState("");
  const [evidenceKind, setEvidenceKind] = useState<(typeof EVIDENCE_KINDS)[number]>("citation");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const anchor =
        selection && documentText
          ? createAnchor(documentText, selection.start, selection.end, selection.fragmentId)
          : null;
      const evidence =
        type === "helpful_resource" && !evidenceUrl
          ? []
          : [{ kind: evidenceKind, url: evidenceUrl || null, label: null }];

      const { data, error: apiError } = await browserApiClient().POST("/v1/works/{workId}/notes", {
        params: { path: { workId } },
        body: {
          workId,
          workVersionId: null,
          type,
          body,
          // `anchor`'s generated type is a generic JSON value, not @repo/core's `Anchor`
          // interface — both describe the same jsonb column, just from different tools
          // (drizzle-zod's untyped-jsonb inference vs. our own hand-written type).
          anchor: anchor as Record<string, unknown> | null,
          language: null,
          evidence,
        },
      });
      if (apiError) throw new Error(JSON.stringify(apiError));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", workId] });
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!session) {
    return <p className="text-sm text-muted-foreground">Sign in to write a note.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      {selection ? (
        <blockquote className="border-l-2 border-border pl-3 text-sm text-muted-foreground italic">
          “{selection.text}”
        </blockquote>
      ) : null}

      <select
        value={type}
        onChange={(e) => setType(e.target.value as typeof type)}
        className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
      >
        {NOTE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <textarea
        required
        minLength={10}
        maxLength={4000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you find?"
        rows={4}
        className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
      />

      <div className="flex gap-2">
        <select
          value={evidenceKind}
          onChange={(e) => setEvidenceKind(e.target.value as typeof evidenceKind)}
          className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
        >
          {EVIDENCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="Evidence link (required except for helpful resources)"
          className="border-input bg-background flex-1 rounded-md border px-2 py-1.5 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Submitting…" : "Submit note"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
