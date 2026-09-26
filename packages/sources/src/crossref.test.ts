import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCrossrefConnector } from "./crossref";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

function fakeFetch(status: number, body: string): typeof fetch {
  return (async () => new Response(body, { status })) as typeof fetch;
}

const ELIFE_FIXTURE = "crossref-work-10.7554-elife.52157.json";

describe("createCrossrefConnector.fetchById", () => {
  it("normalizes a real Crossref work, stripping JATS tags from the abstract", async () => {
    const connector = createCrossrefConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch(200, fixture(ELIFE_FIXTURE)),
    });

    const work = await connector.fetchById({ scheme: "doi", value: "10.7554/elife.52157" });

    expect(work).not.toBeNull();
    expect(work?.title).toBe("Open exploration");
    expect(work?.abstract).toBe(
      "Arguments in support of open science tend to focus on confirmatory research practices. Here we argue that exploratory research should also be encouraged within the framework of open science. We lay out the benefits of 'open exploration' and propose two complementary ways to implement this with little infrastructural change.",
    );
    expect(work?.workType).toBe("article");
    expect(work?.language).toBe("en");
    expect(work?.identifiers).toEqual([
      { scheme: "doi", valueNormalized: "10.7554/elife.52157", valueRaw: "10.7554/elife.52157" },
    ]);
    expect(work?.categories).toEqual(["eLife"]);
    expect(work?.authors.length).toBeGreaterThanOrEqual(3);
    expect(work?.authors[0]).toEqual({
      name: "William Hedley Thompson",
      orcid: "0000-0002-0533-6035",
      position: 1,
    });
    expect(work?.authors[1]).toEqual({ name: "Jessey Wright", orcid: undefined, position: 2 });
    expect(work?.version.license).toBe("http://creativecommons.org/licenses/by/4.0/");
    expect(work?.version.pdfUrl).toBe(
      "https://cdn.elifesciences.org/articles/52157/elife-52157-v2.pdf",
    );
    expect(work?.version.sourceUrl).toBe("https://doi.org/10.7554/elife.52157");
  });

  it("returns null for a DOI Crossref has no record of (real 404 body, plain text)", async () => {
    const connector = createCrossrefConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch(404, fixture("crossref-not-found.txt")),
    });
    const work = await connector.fetchById({ scheme: "doi", value: "10.9999/doesnotexist12345" });
    expect(work).toBeNull();
  });

  it("returns null for a non-DOI scheme", async () => {
    const connector = createCrossrefConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch(200, fixture(ELIFE_FIXTURE)),
    });
    const work = await connector.fetchById({ scheme: "arxiv", value: "1706.03762" });
    expect(work).toBeNull();
  });
});
