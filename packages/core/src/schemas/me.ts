import { z } from "zod";
import { affiliationPositionSchema } from "./enums.js";

/** docs/CONTEXT.md section 5.1: handle rules, enforced again server-side by
 * packages/core's `isValidHandle` at the point of use — this schema is the request-shape gate. */
export const updateHandleInputSchema = z.object({
  handle: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_]+$/, "lowercase letters, numbers, and underscores only"),
});

/** docs/CONTEXT.md section 5.1 / M3: institutional affiliation verification, step 1 — start
 * sends an OTP to the given institutional email. Separate from login (CONTEXT.md: "separate
 * from login"). */
export const startAffiliationVerificationInputSchema = z.object({
  institutionEmail: z.email(),
});

/** Step 2 — confirms the OTP and records the affiliation (department/position are
 * self-declared, per CONTEXT.md section 6.2's field list for `affiliations`). */
export const confirmAffiliationVerificationInputSchema = z.object({
  code: z.string().length(6),
  department: z.string().min(1).max(200),
  position: affiliationPositionSchema,
});
