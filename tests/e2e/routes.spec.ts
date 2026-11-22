import { test, expect, noHorizontalOverflow } from "./fixtures";

const ROUTES: [string, RegExp][] = [
  ["/", /Find the night/],
  ["/events", /Explore events/],
  ["/events?category=music&when=month", /Explore events/],
  ["/events/signal-summit-applied-ai", /Signal Summit 2027/],
  ["/categories/workshops", /Workshops/],
  ["/organizers", /Organizers/],
  ["/organizers/nocturne-live", /Nocturne Live/],
  ["/saved", /Saved events/],
];

for (const [path, h1] of ROUTES) {
  test(`renders ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    // Only one visible page at a time (Next keeps visited pages mounted but hidden).
    await expect(page.locator("h1:visible")).toHaveCount(1);
    await noHorizontalOverflow(page);
  });
}

test("unknown pages show the not-found page", async ({ page }) => {
  const res = await page.goto("/definitely-missing");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/left the building/);
});

test("sections reveal as they scroll into view", async ({ page }) => {
  await page.goto("/");
  const cities = page.getByRole("heading", { name: "Where it's happening" });
  await cities.scrollIntoViewIfNeeded();
  await expect(cities).toBeVisible();
  await expect.poll(async () => Number(await cities.evaluate((el) => getComputedStyle(el.closest("div")!).opacity)), { timeout: 3000 }).toBe(1);
});

test("content shows immediately with reduced motion", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const animated = await page.evaluate(() => getComputedStyle(document.querySelector(".page-enter")!).animationName);
  expect(animated).toBe("none");
  await ctx.close();
});

test("calendar file downloads for a booking code", async ({ request }) => {
  const res = await request.get("/bookings/EH-NOPE/calendar");
  expect(res.status()).toBe(404);
});
