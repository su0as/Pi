import { z } from "zod";
import { brand } from "../brand.js";
import { objectStorageEnvShape } from "./object-storage.js";

// docs/CONTEXT.md section 9.2's seed categories: "cs.AI, cs.LG, cs.CV, cs.CL, cs.RO, cs.HC,
// eess.SY, eess.SP, eess.IV, stat.ML, q-bio.*" — the same leaf codes packages/db's seed script
// uses (packages/db/src/seed/fixtures/topics.ts), reused here as the default harvest set so the
// two don't drift apart by accident.
const DEFAULT_HARVEST_CATEGORIES =
  "cs.AI,cs.LG,cs.CV,cs.CL,cs.RO,cs.HC,eess.SY,eess.SP,eess.IV,stat.ML,q-bio.GN,q-bio.NC,q-bio.QM";

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),

  // --- M4: ingestion (docs/CONTEXT.md section 9.3/9.4) ---
  ARXIV_CONTACT_EMAIL: z.string().default(brand.arxivContactEmail),
  // Comma-separated arXiv category codes to harvest — see DEFAULT_HARVEST_CATEGORIES above.
  HARVEST_CATEGORIES: z
    .string()
    .default(DEFAULT_HARVEST_CATEGORIES)
    .transform((value) =>
      value
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  // "daily arxiv.harvest cron (configurable time)" — a 5-field cron expression and IANA tz.
  HARVEST_CRON: z.string().default("0 3 * * *"),
  HARVEST_CRON_TZ: z.string().default("UTC"),
  // "Configurable 6-month bulk window" — how far back the *first-ever* harvest run looks; every
  // run after that resumes from `ingestion_checkpoints`, not this window, so it only matters once
  // per fresh install.
  HARVEST_BULK_WINDOW_MONTHS: z.coerce.number().int().positive().default(6),

  // --- M5: reader pipeline (docs/CONTEXT.md section 10) ---
  ...objectStorageEnvShape,
  // pipeline_version — bump this whenever normalize.ts's output shape changes meaningfully, so
  // existing reader_documents rows are known-stale rather than silently served as current.
  READER_PIPELINE_VERSION: z.coerce.number().int().positive().default(1),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);
  if (!result.success) {
    console.error("Invalid apps/worker environment:", z.treeifyError(result.error));
    throw new Error("apps/worker failed to boot: invalid environment variables");
  }
  return result.data;
}
