import { test, expect, isMobile } from "./fixtures";

test("header navigation reaches every section", async ({ page }, info) => {
  await page.goto("/");
  if (isMobile(info.project.name)) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Organizers" }).click();
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Organizers" }).click();
  }
  await expect(page).toHaveURL(/\/organizers$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Organizers");
});

test("hero search goes to filtered results", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("search").first();
  await search.getByLabel("What").fill("pottery");
  await search.getByRole("button", { name: /Search events/ }).click();
  await expect(page).toHaveURL(/\/events\?q=pottery/);
  await expect(page.getByText(/matching “pottery”/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Results" }).locator("article")).not.toHaveCount(0);
});

test("filters update the URL and results, and clear", async ({ page }) => {
  await page.goto("/events");
  await page.getByRole("radio", { name: "Festivals" }).click();
  await expect(page).toHaveURL(/category=festivals/);
  await expect(page.getByText(/^\d+ events? Festivals/)).toBeVisible();
  await page.getByRole("radio", { name: "Free" }).click();
  await expect(page).toHaveURL(/price=free/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/events$/);
});

test("save, see in Saved, and remove", async ({ page }) => {
  await page.goto("/events");
  const first = page.getByRole("region", { name: "Results" }).locator("article").first();
  const title = (await first.locator("h3").innerText()).trim();
  await first.getByRole("button", { name: /^Save / }).click();
  await expect(first.getByRole("button", { name: /^Remove / })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.locator("article h3")).toHaveText([title]);
  await page.getByRole("button", { name: /^Remove / }).click();
  await expect(page.getByRole("heading", { name: "Nothing saved yet" })).toBeVisible();
});

test("photo viewer opens, pages and closes from the keyboard", async ({ page }) => {
  await page.goto("/events/nocturne-riverside-sessions");
  await page.getByRole("button", { name: /^View photo/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Photo viewer" });
  await expect(dialog).toContainText("1 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(dialog).toContainText("2 of 3");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("hero lets visitors pick a featured event", async ({ page }) => {
  await page.goto("/");
  const aside = page.getByRole("complementary", { name: "Now featuring" });
  const buttons = aside.getByRole("button", { name: /^Show / });
  const n = await buttons.count();
  test.skip(n < 2, "needs two featured events");
  const target = (await buttons.nth(n - 1).getAttribute("aria-label"))!.replace(/^Show /, "");
  await buttons.nth(n - 1).click();
  await expect(aside.getByRole("link")).toContainText(target);
});

test("category tiles lead to category pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "Categories" }).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/categories\//);
  await expect(page.getByRole("heading", { name: "Everything on sale" })).toBeVisible();
});
