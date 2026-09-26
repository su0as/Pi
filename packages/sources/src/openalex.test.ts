import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createOpenAlexConnector, fetchOpenAlexEnrichment } from "./openalex";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

function fakeFetch(status: number, body: string): typeof fetch {
  return (async () => new Response(body, { status })) as typeof fetch;
}

const ELIFE_FIXTURE = "openalex-work-W2998766662.json";

describe("createOpenAlexConnector.fetchById", () => {
  it("normalizes a real OpenAlex work, reconstructing the abstract from its inverted index", async () => {
    const connector = createOpenAlexConnector({
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
    expect(work?.identifiers).toContainEqual({
      scheme: "openalex",
      valueNormalized: "https://openalex.org/W2998766662",
      valueRaw: "https://openalex.org/W2998766662",
    });
    expect(work?.identifiers).toContainEqual({
      scheme: "doi",
      valueNormalized: "10.7554/elife.52157",
      valueRaw: "https://doi.org/10.7554/elife.52157",
    });
    expect(work?.identifiers).toContainEqual({
      scheme: "pmid",
      valueNormalized: "31916934",
      valueRaw: "https://pubmed.ncbi.nlm.nih.gov/31916934",
    });
    expect(work?.authors).toHaveLength(3);
    expect(work?.authors[0]).toEqual({
      name: "William Hedley Thompson",
      orcid: "0000-0002-0533-6035",
      position: 1,
    });
    // Real fixture's primary_location.license is the short code "cc-by" — mapped to the
    // canonical CC URL so license.ts's allowlist (URL patterns) can classify it.
    expect(work?.version.license).toBe("cc-by");
    expect(work?.version.licenseUrl).toBe("http://creativecommons.org/licenses/by/4.0/");
  });

  it("returns null for a DOI OpenAlex has no record of", async () => {
    const connector = createOpenAlexConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch(404, ""),
    });
    const work = await connector.fetchById({ scheme: "doi", value: "10.9999/doesnotexist12345" });
    expect(work).toBeNull();
  });

  it("returns null for a non-DOI scheme", async () => {
    const connector = createOpenAlexConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch(200, fixture(ELIFE_FIXTURE)),
    });
    const work = await connector.fetchById({ scheme: "arxiv", value: "1706.03762" });
    expect(work).toBeNull();
  });
});

describe("fetchOpenAlexEnrichment", () => {
  it("extracts ROR-keyed institutions and topics from a real work", async () => {
    const enrichment = await fetchOpenAlexEnrichment("10.7554/elife.52157", {
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch(200, fixture(ELIFE_FIXTURE)),
    });

    expect(enrichment).not.toBeNull();
    expect(enrichment?.openalexId).toBe("https://openalex.org/W2998766662");
    expect(enrichment?.institutions.length).toBeGreaterThan(0);
    expect(enrichment?.institutions).toContainEqual({
      rorId: "https://ror.org/056d84691",
      name: "Karolinska Institutet",
      country: "SE",
    });
    expect(enrichment?.topics.length).toBeGreaterThan(0);
    expect(enrichment?.topics[0]).toMatchObject({ code: "T10206", name: expect.any(String) });

    // First author (William Hedley Thompson) is affiliated with both Karolinska and Stanford —
    // verified directly against the real fixture.
    expect(enrichment?.authorInstitutions[0]).toEqual({
      position: 1,
      rorIds: ["https://ror.org/056d84691", "https://ror.org/00f54p054"],
    });
  });

  it("returns null when OpenAlex has no record of the DOI", async () => {
    const enrichment = await fetchOpenAlexEnrichment("10.9999/doesnotexist12345", {
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch(404, ""),
    });
    expect(enrichment).toBeNull();
  });
});
