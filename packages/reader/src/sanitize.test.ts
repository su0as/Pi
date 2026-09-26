import { describe, expect, it } from "vitest";
import { sanitizeReaderHtml } from "./sanitize.js";

// CLAUDE.md: "Sanitize all HTML server-side before rendering." docs/CONTEXT.md section 10:
// "strict allowlist; MathML allowed; no scripts, no inline event handlers, no external iframes."
// These are non-negotiable per the plan — every case here is a real, verified attack shape, not
// a hypothetical.
describe("sanitizeReaderHtml (XSS)", () => {
  it("removes <script> tags and their content entirely", () => {
    const out = sanitizeReaderHtml("<p>hi</p><script>alert(document.cookie)</script>");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(document.cookie)");
  });

  it("strips inline event handler attributes (onclick, onerror, onload, ...)", () => {
    const out = sanitizeReaderHtml(
      '<p onclick="evil()">hi</p><img src="x.png" onerror="alert(1)">',
    );
    expect(out).not.toMatch(/on\w+\s*=/i);
    expect(out).toContain('src="x.png"');
  });

  it("removes <iframe> entirely, including same-origin-looking ones", () => {
    const out = sanitizeReaderHtml('<iframe src="https://arxiv.org/evil"></iframe><p>safe</p>');
    expect(out).not.toContain("<iframe");
    expect(out).toContain("<p>safe</p>");
  });

  it("removes <style> and <link> (no remote or embedded stylesheets)", () => {
    const out = sanitizeReaderHtml(
      '<style>body{background:url(https://evil.example/x)}</style><link rel="stylesheet" href="https://evil.example/x.css"><p>safe</p>',
    );
    expect(out).not.toContain("<style");
    expect(out).not.toContain("<link");
    expect(out).not.toContain("evil.example");
  });

  it("strips javascript: URLs from href", () => {
    const out = sanitizeReaderHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain("javascript:");
  });

  it("strips data: and other non-http(s) schemes from img src", () => {
    const out = sanitizeReaderHtml(
      '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
    );
    expect(out).not.toContain("data:");
  });

  it("removes <object> and <embed>", () => {
    const out = sanitizeReaderHtml(
      '<object data="evil.swf"></object><embed src="evil.swf"><p>safe</p>',
    );
    expect(out).not.toContain("<object");
    expect(out).not.toContain("<embed");
  });

  it("removes <form>/<input>/<button> (no phishing-style forms in reader content)", () => {
    const out = sanitizeReaderHtml(
      '<form action="https://evil.example"><input name="password"><button>Submit</button></form><p>safe</p>',
    );
    expect(out).not.toContain("<form");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("<button");
  });

  it("drops an unrecognized element (e.g. svg) along with any nested script", () => {
    const out = sanitizeReaderHtml(
      '<svg onload="alert(1)"><script>alert(2)</script></svg><p>safe</p>',
    );
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("alert(2)");
    expect(out).toContain("<p>safe</p>");
  });

  it("restricts the img style attribute to safe layout properties, dropping url()/expression()", () => {
    const out = sanitizeReaderHtml(
      '<img src="a.png" style="background:url(https://evil.example/x); aspect-ratio: 912/1344;">',
    );
    expect(out).not.toContain("evil.example");
    expect(out).not.toContain("background");
    expect(out).toContain("aspect-ratio");
  });

  it("preserves real MathML content unchanged in structure", () => {
    const mathml =
      '<math id="m1" display="inline"><semantics><msub><mi>h</mi><mi>t</mi></msub><annotation encoding="application/x-tex">h_{t}</annotation></semantics></math>';
    const out = sanitizeReaderHtml(`<p>State ${mathml}.</p>`);
    expect(out).toContain("<math");
    expect(out).toContain("<msub>");
    expect(out).toContain("<mi>h</mi>");
    expect(out).toContain("</math>");
  });

  it("preserves benign structural and text-formatting content", () => {
    const out = sanitizeReaderHtml(
      '<section id="S1"><h2>Introduction</h2><p>Hello <strong>world</strong>, see <a href="https://example.com">this</a>.</p></section>',
    );
    expect(out).toContain('<section id="S1">');
    expect(out).toContain("<h2>Introduction</h2>");
    expect(out).toContain("<strong>world</strong>");
    expect(out).toContain('href="https://example.com"');
  });
});
