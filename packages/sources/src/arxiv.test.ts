import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createArxivConnector } from "./arxiv";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

function fakeFetch(responses: Record<string, string>): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    for (const [match, body] of Object.entries(responses)) {
      if (url.includes(match)) {
        return new Response(body, { status: 200, headers: { "content-type": "application/xml" } });
      }
    }
    throw new Error(`fakeFetch: no fixture registered for ${url}`);
  }) as typeof fetch;
}

describe("createArxivConnector.fetchById", () => {
  it("normalizes a real Atom entry into a NormalizedWork", async () => {
    const connector = createArxivConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch({ "id_list=1706.03762": fixture("arxiv-atom-1706.03762.xml") }),
    });

    const work = await connector.fetchById({ scheme: "arxiv", value: "1706.03762" });

    expect(work).not.toBeNull();
    expect(work?.title).toBe("Attention Is All You Need");
    expect(work?.identifiers).toEqual([
      {
        scheme: "arxiv",
        valueNormalized: "1706.03762",
        valueRaw: "http://arxiv.org/abs/1706.03762v7",
      },
    ]);
    expect(work?.authors).toHaveLength(8);
    expect(work?.authors[0]).toEqual({ name: "Ashish Vaswani", position: 1 });
    expect(work?.categories).toEqual(["cs.CL", "cs.LG"]);
    expect(work?.version.versionLabel).toBe("v7");
    expect(work?.version.pdfUrl).toBe("https://arxiv.org/pdf/1706.03762v7");
    expect(work?.version.htmlUrl).toBe("https://arxiv.org/abs/1706.03762v7");
    // Not available via the Atom API — see arxiv.ts's comment.
    expect(work?.version.license).toBeNull();
  });

  it("returns null for an id arXiv has no record of", async () => {
    const connector = createArxivConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch({ "id_list=9999.99999": fixture("arxiv-atom-not-found.xml") }),
    });

    const work = await connector.fetchById({ scheme: "arxiv", value: "9999.99999" });
    expect(work).toBeNull();
  });

  it("returns null for a non-arXiv scheme", async () => {
    const connector = createArxivConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch({}),
    });
    const work = await connector.fetchById({ scheme: "doi", value: "10.1038/nphys1170" });
    expect(work).toBeNull();
  });

  it("sends a descriptive User-Agent with the configured contact email", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const connector = createArxivConnector({
      contactEmail: "contact@example.com",
      productName: "TestBot",
      fetchImpl: (async (_input: string | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers as Record<string, string> | undefined;
        return new Response(fixture("arxiv-atom-1706.03762.xml"), { status: 200 });
      }) as typeof fetch,
    });
    await connector.fetchById({ scheme: "arxiv", value: "1706.03762" });
    const ua = capturedHeaders?.["User-Agent"];
    expect(ua).toContain("TestBot");
    expect(ua).toContain("contact@example.com");
  });
});

describe("createArxivConnector.harvestIncremental", () => {
  it("normalizes real OAI-PMH records, including license and DOI extraction", async () => {
    const connector = createArxivConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch({
        "set=cs%3Acs%3ARO": fixture("arxiv-oai-listrecords-page.xml"),
      }),
    });

    const works = [];
    if (!connector.harvestIncremental) throw new Error("harvestIncremental not implemented");
    for await (const work of connector.harvestIncremental(new Date("2026-09-24"), ["cs.RO"])) {
      works.push(work);
    }

    expect(works).toHaveLength(3);

    const ccByWork = works.find((w) => w.identifiers[0]?.valueNormalized === "2309.10164");
    expect(ccByWork?.version.license).toBe("http://creativecommons.org/licenses/by/4.0/");

    const withDoi = works.find((w) => w.identifiers[0]?.valueNormalized === "2402.17937");
    expect(withDoi?.identifiers).toContainEqual({
      scheme: "doi",
      valueNormalized: "10.3389/frobt.2026.1802622",
      valueRaw: "10.3389/frobt.2026.1802622",
    });

    const restrictiveLicense = works.find(
      (w) => w.identifiers[0]?.valueNormalized === "2609.28467",
    );
    expect(restrictiveLicense?.version.license).toBe(
      "http://arxiv.org/licenses/nonexclusive-distrib/1.0/",
    );
  });

  it("follows resumptionToken across pages and stops when it's empty", async () => {
    const connector = createArxivConnector({
      contactEmail: "test@example.com",
      productName: "TestBot",
      fetchImpl: fakeFetch({
        "resumptionToken=test-resumption-token-abc123": fixture(
          "arxiv-oai-listrecords-paginated-page2.xml",
        ),
        "set=cs%3Acs%3ARO": fixture("arxiv-oai-listrecords-paginated-page1.xml"),
      }),
    });

    const ids: string[] = [];
    if (!connector.harvestIncremental) throw new Error("harvestIncremental not implemented");
    for await (const work of connector.harvestIncremental(new Date("2026-09-24"), ["cs.RO"])) {
      ids.push(work.identifiers[0]?.valueNormalized ?? "");
    }

    expect(ids).toEqual(["2309.10164", "2609.28467"]);
  });
});
