import { test, expect, dbQuery } from "./fixtures";

test("book a free ticket and get a confirmation with QR codes", async ({ page, request }) => {
  await page.goto("/events/quiet-rooms-portrait-opening");
  const panel = page.getByRole("complementary", { name: "Tickets" });
  await expect(panel.getByRole("button", { name: "Choose your tickets" })).toBeDisabled();
  await panel.getByRole("button", { name: "One more Free registration" }).click();
  await panel.getByLabel("Name on tickets").fill("Playwright Guest");
  await panel.getByLabel("Email").fill("e2e@example.com");
  await panel.getByRole("button", { name: "Get free ticket" }).click();
  await expect(page).toHaveURL(/\/bookings\/EH-[A-Z0-9]{6}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/You're going to Quiet Rooms/);
  await expect(page.getByRole("img", { name: /QR code for ticket/ })).toHaveCount(1);
  const ics = await request.get(page.url() + "/calendar");
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("SUMMARY:Quiet Rooms");
});

test("pay for 2 tickets by card and get them confirmed", async ({ page }) => {
  await page.goto("/events/arena-nights-indie-double-bill");
  const panel = page.getByRole("complementary", { name: "Tickets" });
  const plus = panel.getByRole("button", { name: "One more General admission" });
  await plus.click();
  await plus.click();
  await expect(panel).toContainText("€70");
  await expect(panel).toContainText("held for 30 minutes");
  await panel.getByLabel("Name on tickets").fill("Paid Guest");
  await panel.getByLabel("Email").fill("paid@example.com");
  await panel.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(/\/test-checkout\//);
  await page.getByRole("button", { name: "Pay €70" }).click();
  await expect(page).toHaveURL(/\/bookings\/EH-[A-Z0-9]{6}\?paid=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/You're going to/);
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code/ })).toHaveCount(2);
});

test("leaving the card checkout releases the seats", async ({ page }) => {
  await page.goto("/events/arena-nights-indie-double-bill");
  const panel = page.getByRole("complementary", { name: "Tickets" });
  await panel.getByRole("button", { name: "One more General admission" }).click();
  await panel.getByLabel("Name on tickets").fill("Changed Mind");
  await panel.getByLabel("Email").fill("changed@example.com");
  await panel.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(/\/test-checkout\//);
  await page.getByRole("link", { name: "Cancel payment" }).click();
  await expect(page).toHaveURL(/\/events\/arena-nights-indie-double-bill\?checkout=cancelled/);
  await expect(page.getByRole("status").filter({ hasText: "your seats were released" })).toBeVisible();
  await expect(page).toHaveURL(/\?checkout=cancelled$/);
  const [last] = await dbQuery<{ status: string }>(`SELECT status FROM bookings WHERE "contactEmail" = 'changed@example.com' ORDER BY "createdAt" DESC LIMIT 1`);
  expect(last.status).toBe("EXPIRED");
});

test("server-side validation explains what to fix", async ({ page }) => {
  await page.goto("/events/arena-nights-indie-double-bill");
  const panel = page.getByRole("complementary", { name: "Tickets" });
  await panel.getByRole("button", { name: "One more General admission" }).click();
  await panel.getByLabel("Name on tickets").fill("A");
  await panel.getByLabel("Email").fill("short@example.com");
  await panel.getByRole("button", { name: "Continue to payment" }).click();
  await expect(panel.getByText("Enter the name for the tickets.")).toBeVisible();
  await expect(page).toHaveURL(/\/events\/arena-nights/);
});
