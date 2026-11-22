/**
 * Outgoing email.
 *
 * Production sends through Resend (RESEND_API_KEY + EMAIL_FROM). Without a key
 * (local development and the test suite) messages are appended to an outbox
 * file instead, one JSON object per line, so they can be read and their links
 * followed. The outbox is never used when a key is set.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Lets a reader of the outbox (or Resend's dashboard) tell messages apart. */
  tag?: string;
};

const OUTBOX = resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.MAIL_OUTBOX_FILE ?? ".data/outbox.jsonl");

export async function sendMail(mail: Mail): Promise<{ id: string; transport: "resend" | "outbox" }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "EVENT HUB <tickets@eventhub.local>";

  if (key) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        tags: mail.tag ? [{ name: "kind", value: mail.tag }] : undefined,
      }),
    });
    if (!res.ok) throw new Error(`Email to ${mail.to} failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { id: string };
    return { id: body.id, transport: "resend" };
  }

  if (process.env.NODE_ENV === "production" && !process.env.MAIL_OUTBOX_FILE) {
    console.error(`[mail] RESEND_API_KEY is not set; "${mail.subject}" to ${mail.to} was written to the outbox only.`);
  }
  const id = `outbox_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await mkdir(dirname(OUTBOX), { recursive: true });
  await appendFile(OUTBOX, JSON.stringify({ id, at: new Date().toISOString(), from, ...mail }) + "\n");
  return { id, transport: "outbox" };
}
