"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";

export interface SelectionAnchor {
  text: string;
  start: number;
  end: number;
  fragmentId: string | null;
  /** Viewport coordinates for placing a floating "Add note" button near the selection. */
  rect: { top: number; left: number };
}

/**
 * docs/CONTEXT.md section 7.2 — turns a live browser selection inside `containerRef` into the
 * plain `documentText`/`start`/`end` triple `@repo/core/anchoring`'s `createAnchor` needs. Kept
 * out of packages/core deliberately (see that package's `Anchor` type doc comment) — this is the
 * one piece of the anchoring pipeline that's inherently DOM-dependent.
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>,
): SelectionAnchor | null {
  const [anchor, setAnchor] = useState<SelectionAnchor | null>(null);

  useEffect(() => {
    function handleSelectionChange() {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setAnchor(null);
        return;
      }

      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setAnchor(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setAnchor(null);
        return;
      }

      // Character offset of the selection start within the container's full text content: the
      // length of everything between the container's start and the selection's start.
      const preRange = document.createRange();
      preRange.selectNodeContents(container);
      preRange.setEnd(range.startContainer, range.startOffset);
      const start = preRange.toString().length;

      const fragmentHost = (
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement
      )?.closest("[id]");

      const rect = range.getBoundingClientRect();

      setAnchor({
        text,
        start,
        end: start + text.length,
        fragmentId: fragmentHost?.id ?? null,
        rect: { top: rect.top + window.scrollY, left: rect.left + window.scrollX },
      });
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [containerRef]);

  return anchor;
}
