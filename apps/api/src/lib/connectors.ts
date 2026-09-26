import { brand } from "@repo/config/brand";
import type { ApiEnv } from "@repo/config/env/api";
import {
  createArxivConnector,
  createCrossrefConnector,
  createOpenAlexConnector,
} from "@repo/sources";

/**
 * Builds the M4 source connectors from env — one place, so `GET /v1/works/resolve` (and later
 * `apps/worker`'s jobs, which build their own from their own env) don't each hardcode the contact
 * email / product name wiring. `fetchImpl` is exposed for tests to inject fixture responses
 * instead of hitting the real arXiv/OpenAlex/Crossref APIs.
 */
export function buildSourceConnectors(env: ApiEnv, fetchImpl?: typeof fetch) {
  const contactEmail = env.ARXIV_CONTACT_EMAIL;
  const productName = brand.shortName;

  return {
    arxiv: createArxivConnector({ contactEmail, productName, fetchImpl }),
    openalex: createOpenAlexConnector({ contactEmail, productName, fetchImpl }),
    crossref: createCrossrefConnector({ contactEmail, productName, fetchImpl }),
  };
}

export type SourceConnectors = ReturnType<typeof buildSourceConnectors>;
