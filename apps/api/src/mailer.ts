import type { ApiEnv } from "@repo/config/env/api";
import nodemailer from "nodemailer";
import { Resend } from "resend";

/**
 * Mailer — docs/CONTEXT.md section 12.3: "Resend + React Email (Mailpit locally)", and section
 * 18 decision 14 names `Mailer` as one of the interfaces swappable subsystems should sit behind.
 * Selection is automatic: `RESEND_API_KEY` set -> Resend (every non-local environment);
 * unset -> SMTP pointed at Mailpit (`docker-compose.yml`), which is also what apps/api's own
 * integration tests exercise — no Resend account needed to verify an email actually got "sent."
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export function createSmtpMailer(opts: { host: string; port: number; from: string }): Mailer {
  const transport = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: false,
  });

  return {
    async send(message) {
      await transport.sendMail({
        from: opts.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    },
  };
}

export function createResendMailer(opts: { apiKey: string; from: string }): Mailer {
  const resend = new Resend(opts.apiKey);

  return {
    async send(message) {
      const result = await resend.emails.send({
        from: opts.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      if (result.error) {
        throw new Error(`Resend failed to send email: ${result.error.message}`);
      }
    },
  };
}

export function createMailer(env: ApiEnv): Mailer {
  if (env.RESEND_API_KEY) {
    return createResendMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM });
  }
  return createSmtpMailer({ host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.EMAIL_FROM });
}
