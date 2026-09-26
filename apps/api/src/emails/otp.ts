import { brand } from "@repo/config/brand";

/**
 * Plain HTML/text templates, not React Email — docs/CONTEXT.md section 12.2 lists
 * `packages/emails` for React Email templates, but M3 only needs one OTP email for two flows
 * (sign-in, affiliation verification). A `packages/emails` package is worth adding once there
 * are enough templates (digests, note-status-changed, etc. — M3/M7/M9) to share layout, not for
 * a single six-digit code.
 */
export function otpEmail(code: string, purpose: "sign-in" | "affiliation-verification") {
  const heading =
    purpose === "sign-in" ? `Sign in to ${brand.name}` : `Verify your institutional email`;

  const text = `${heading}\n\nYour code: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.`;

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="font-size: 18px;">${heading}</h1>
      <p style="font-size: 32px; letter-spacing: 4px; font-weight: 600;">${code}</p>
      <p style="color: #666; font-size: 14px;">
        This code expires in 10 minutes. If you didn't request this, you can ignore this email.
      </p>
    </div>
  `.trim();

  return { subject: heading, html, text };
}
