import { test as base, expect, type Page } from "@playwright/test";
import path from "node:path";

/** Every test fails on uncaught page errors or console errors (expected 404s and failed sign-ins aside). */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !/status of (404|401)/.test(m.text())) errors.push(`console: ${m.text()}`);
      });
      if (process.env.E2E_OFFLINE_IMAGES) {
        const img = path.join(__dirname, "placeholder.jpg");
        await page.route(/images\.(pexels|unsplash)\.com/, (r) => r.fulfill({ path: img, contentType: "image/jpeg" }));
        await page.route(/openstreetmap\.org/, (r) => r.fulfill({ body: "<html></html>", contentType: "text/html" }));
      }
      await use(errors);
      expect(errors, "page/console errors").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function noHorizontalOverflow(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, "horizontal overflow").toBeLessThanOrEqual(client + 1);
}

export const isMobile = (name: string) => name === "mobile";

/** Emails the server wrote to its outbox (no RESEND_API_KEY in tests). */
import { readFileSync, existsSync } from "node:fs";
type OutboxMail = { to: string; subject: string; text: string; tag?: string; at: string };
export async function lastMail(to: string, tag: string, timeoutMs = 8000): Promise<OutboxMail> {
  const file = path.join(process.cwd(), ".data/outbox.jsonl");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const mails = readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as OutboxMail);
      const hit = mails.reverse().find((m) => m.to === to && m.tag === tag);
      if (hit) return hit;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No "${tag}" email to ${to} in the outbox`);
}

export function linkIn(mail: { text: string }) {
  const m = mail.text.match(/https?:\/\/\S+/);
  if (!m) throw new Error("No link in email");
  return m[0];
}

export const uniqueEmail = (label: string) => `${label}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;

/** One query against the app's database, for checks the UI can't show (DATABASE_URL from .env). */
export async function dbQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await import("dotenv/config");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}
