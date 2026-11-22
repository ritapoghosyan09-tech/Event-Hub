import path from "node:path";
import { readFileSync } from "node:fs";
import pg from "pg";
import "dotenv/config";
import { test, expect, lastMail, uniqueEmail } from "./fixtures";

/**
 * The organizer journey end to end: profile → draft → photo → publish →
 * someone books → attendee list and CSV → door check-in → cancel the event.
 * Runs once (desktop); the studio pages are also rendered on tablet and
 * mobile by the route checks below.
 */
test.describe.configure({ mode: "serial" });

function inAWeek(hour: number) {
  const d = new Date(Date.now() + 7 * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, "0")}:00`;
}

async function qrTokenFor(code: string) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(`SELECT t."qrToken" FROM tickets t JOIN bookings b ON b.id = t."bookingId" WHERE b.code = $1 LIMIT 1`, [code]);
  await client.end();
  return rows[0].qrToken as string;
}

test("an organizer creates, publishes, sells, checks in and cancels an event", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one full organizer journey is enough; layouts are covered below");
  test.setTimeout(120_000);
  const email = uniqueEmail("organizer");
  const title = `Rooftop Listening Session ${Date.now().toString(36)}`;

  // Account and organizer profile
  await page.goto("/sign-up?next=/studio/new");
  await page.getByLabel("Your name").fill("Mira Hakobyan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("organizer-pass-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/studio\/new$/);
  await page.getByLabel("Organizer name").fill(`Night Owl Sessions ${Date.now().toString(36)}`);
  await page.getByLabel("Who is hosting").selectOption("COMMUNITY");
  await page.getByRole("button", { name: "Create organizer profile" }).click();
  await expect(page).toHaveURL(/\/studio\/night-owl-sessions/);
  await expect(page.getByText("Nothing scheduled yet")).toBeVisible();
  const studio = page.url();

  // Draft
  await page.getByRole("link", { name: "New event" }).click();
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Category").selectOption({ label: "Music" });
  await page.getByLabel("Summary").fill("Records played start to finish on a rooftop, with the city lights for company.");
  await page.getByLabel("Description", { exact: true }).fill("Bring a blanket. We play two albums in full on a proper system, with a short break between them.\n\nDoors open half an hour before the first side.");
  await page.getByLabel("Venue", { exact: true }).selectOption({ label: "A new venue…" });
  await page.getByLabel("Venue name").fill("Skyline Terrace");
  await page.getByLabel("Street address").fill("5 Abovyan Street");
  await page.getByLabel("City").fill("Yerevan");
  await page.getByLabel("Country code").fill("AM");
  await page.getByLabel("Starts").fill(inAWeek(20));
  await page.getByLabel("Ends").fill(inAWeek(23));
  await page.getByLabel("Time zone").selectOption("Asia/Yerevan");
  await page.getByLabel("Ticket type 1 name").fill("Blanket spot");
  await page.getByLabel("Ticket type 1 price").fill("0");
  await page.getByLabel("Ticket type 1 quantity").fill("40");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/events\/[\w-]+\?created=1$/);
  await expect(page.getByText("Draft created.")).toBeVisible();
  await expect(page.getByText("Add at least one photo.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish event" })).toBeDisabled();

  // Photo, then publish
  await page.getByLabel("Photo", { exact: true }).setInputFiles(path.join(__dirname, "placeholder.jpg"));
  await page.getByLabel("What's in the photo").fill("A rooftop terrace with chairs facing the city at dusk");
  await page.getByRole("button", { name: "Add photo" }).click();
  await expect(page.getByRole("img", { name: "A rooftop terrace with chairs facing the city at dusk" })).toBeVisible();
  await expect(page.getByText("Ready to publish")).toBeVisible();
  await page.getByRole("button", { name: "Publish event" }).click();
  await expect(page.getByText("On sale", { exact: true })).toBeVisible();
  const manage = page.url().replace(/\?.*$/, "");

  // Someone books it
  await page.getByRole("link", { name: "View public page" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const panel = page.getByRole("complementary", { name: "Tickets" });
  await panel.getByRole("button", { name: "One more Blanket spot" }).click();
  await panel.getByLabel("Name on tickets").fill("Aram Guest");
  await panel.getByLabel("Email").fill("aram.guest@example.com");
  await panel.getByRole("button", { name: "Get free ticket" }).click();
  await expect(page).toHaveURL(/\/bookings\/EH-/);
  const code = page.url().split("/").pop()!;

  // Attendees and CSV
  await page.goto(`${manage}/attendees`);
  await expect(page.getByRole("cell", { name: code })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CSV" }).click();
  const csv = readFileSync(await (await download).path(), "utf8");
  expect(csv).toContain("Aram Guest");
  expect(csv).toContain(code);

  // Door
  await page.goto(`${manage}/door`);
  const token = await qrTokenFor(code);
  await page.getByLabel("Ticket code").fill(`EVENTHUB:${code}:${token}`);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Welcome in")).toBeVisible();
  await expect(page.getByText("1 of 1 checked in")).toBeVisible();
  await page.getByLabel("Ticket code").fill(`EVENTHUB:${code}:${token}`);
  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Already checked in.")).toBeVisible();

  // Cancel the event
  await page.goto(manage);
  await page.getByRole("button", { name: "Cancel event" }).click();
  await page.getByLabel("Note to attendees (optional)").fill("The terrace is closed for repairs.");
  await page.getByLabel("Type CANCEL to confirm").fill("CANCEL");
  await page.getByRole("button", { name: "Cancel the event" }).click();
  await expect(page.getByText(/Cancelled\. 1 booking cancelled/)).toBeVisible();
  expect((await lastMail("aram.guest@example.com", "event-cancelled")).text).toContain("The terrace is closed for repairs.");

  await page.goto(`/bookings/${code}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} was cancelled`);
  await page.goto(studio);
  await expect(page.getByRole("heading", { name: "Past and cancelled" })).toBeVisible();
});

test("the studio is private to its team", async ({ page }) => {
  await page.goto("/studio/nocturne-live");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fstudio%2Fnocturne-live/);

  await page.goto("/sign-up?next=/studio/nocturne-live");
  await page.getByLabel("Your name").fill("Curious Visitor");
  await page.getByLabel("Email").fill(uniqueEmail("outsider"));
  await page.getByLabel("Password").fill("outsider-pass-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page has left the building.");
});
