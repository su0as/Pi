import { brand } from "@repo/config/brand";
import type { WorkerEnv } from "@repo/config/env/worker";
import {
  createArxivConnector,
  createCrossrefConnector,
  createOpenAlexConnector,
} from "@repo/sources";

/** Mirrors apps/api/src/lib/connectors.ts — each app builds its own connector instances from its
 * own env, since they're separate processes with separate config, but the wiring (contact email
 * + product name) is identical. */
export function buildSourceConnectors(env: WorkerEnv, fetchImpl?: typeof fetch) {
  const contactEmail = env.ARXIV_CONTACT_EMAIL;
  const productName = brand.shortName;

  return {
    arxiv: createArxivConnector({ contactEmail, productName, fetchImpl }),
    openalex: createOpenAlexConnector({ contactEmail, productName, fetchImpl }),
    crossref: createCrossrefConnector({ contactEmail, productName, fetchImpl }),
  };
}

export type SourceConnectors = ReturnType<typeof buildSourceConnectors>;
