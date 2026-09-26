/**
 * docs/CONTEXT.md section 10 — "normalize to the PI Reader Document: HTML body with stable
 * element IDs + JSON outline + figures + references (resolved to works when possible)."
 */
export interface ReaderOutlineEntry {
  id: string;
  level: number;
  title: string;
}

export interface ReaderFigure {
  id: string;
  /** Absolute URL the figure image was rewritten to point at (source-relative image paths in
   * arXiv HTML don't resolve on their own once the sanitized HTML is served from our origin). */
  src: string;
  caption: string | null;
}

export interface ReaderReference {
  id: string;
  /** Plain-text citation as it appears in the source bibliography. */
  text: string;
  /** Populated by a later resolution step (not done at normalize time) when the reference is
   * matched to a work already in our catalog — null until then. */
  workId: string | null;
}

export interface ReaderDocument {
  /** Sanitized HTML body — safe to render directly, never re-sanitized on read. */
  bodyHtml: string;
  outline: ReaderOutlineEntry[];
  figures: ReaderFigure[];
  references: ReaderReference[];
}

export interface ObjectStore {
  put(key: string, body: string, contentType: string): Promise<void>;
  get(key: string): Promise<string | null>;
}
