/** Mailpit's REST API (docker-compose.yml's `mailpit` service) — used only by tests, to prove an
 * email actually got sent rather than trusting that `mailer.send()` resolving means anything. */
const MAILPIT_HTTP_URL = process.env.MAILPIT_HTTP_URL ?? "http://localhost:8025";

interface MailpitMessageSummary {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

interface MailpitMessage {
  Text: string;
  HTML: string;
}

async function listMessagesTo(address: string): Promise<MailpitMessageSummary[]> {
  const res = await fetch(
    `${MAILPIT_HTTP_URL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
  );
  const body = (await res.json()) as { messages: MailpitMessageSummary[] };
  return body.messages;
}

async function getMessage(id: string): Promise<MailpitMessage> {
  const res = await fetch(`${MAILPIT_HTTP_URL}/api/v1/message/${id}`);
  return (await res.json()) as MailpitMessage;
}

/** Polls (Mailpit ingests over real SMTP, so delivery isn't instant relative to the HTTP call
 * that triggered it) until a message to `address` shows up, then returns its full body. */
export async function waitForEmailTo(address: string, timeoutMs = 5000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const messages = await listMessagesTo(address);
    if (messages.length > 0) {
      const latest = messages[0];
      if (!latest) break;
      return getMessage(latest.ID);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No email arrived for ${address} within ${timeoutMs}ms`);
}
