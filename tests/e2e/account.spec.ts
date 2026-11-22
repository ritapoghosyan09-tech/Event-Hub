import { test, expect, lastMail, linkIn, uniqueEmail, isMobile } from "./fixtures";
import type { Page } from "@playwright/test";

const PASSWORD = "lantern-river-42";

async function bookFree(page: Page, email: string) {
  await page.goto("/events/quiet-rooms-portrait-opening");
  const panel = page.getByRole("complementary", { name: "Tickets" });
  await panel.getByRole("button", { name: "One more Free registration" }).click();
  await panel.getByLabel("Name on tickets").fill("Guest Booker");
  await panel.getByLabel("Email").fill(email);
  await panel.getByRole("button", { name: "Get free ticket" }).click();
  await expect(page).toHaveURL(/\/bookings\/EH-/);
  return page.url().split("/").pop()!;
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account\?welcome=1/);
}

test("account pages ask you to sign in first", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back");
});

test("sign up, confirm the email, and find guest tickets in the account", async ({ page }) => {
  const email = uniqueEmail("claim");
  const code = await bookFree(page, email);

  await signUp(page, "Claire Mendes", email);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Claire Mendes");
  await expect(page.getByText("Confirm your email address")).toBeVisible();
  await expect(page.getByText("No upcoming tickets")).toBeVisible();

  // The confirmation email arrives with the booking confirmation before it.
  expect((await lastMail(email, "booking-confirmed")).subject).toContain("Quiet Rooms");
  await page.goto(linkIn(await lastMail(email, "verify-email")));
  await expect(page).toHaveURL(/\/account\?verified=1/);
  await expect(page.getByText("Email confirmed.")).toBeVisible();
  await expect(page.getByText(code)).toBeVisible();
  await expect(page.getByText("Confirm your email address")).toHaveCount(0);
});

test("sign out, wrong password, sign back in", async ({ page }, info) => {
  const email = uniqueEmail("signin");
  await signUp(page, "Sam Ortiz", email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/sign-in?next=/saved");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match an account.")).toBeVisible();

  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  if (!isMobile(info.project.name)) {
    await expect(page.getByRole("link", { name: "Your account, Sam Ortiz" })).toBeVisible();
  }
});

test("reset a forgotten password from the emailed link", async ({ page }) => {
  const email = uniqueEmail("reset");
  await signUp(page, "Rita Avetisyan", email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link is on its way");

  await page.goto(linkIn(await lastMail(email, "reset-password")));
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel("New password").fill("brand-new-pass-7");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/sign-in\?reset=1/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("brand-new-pass-7");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("saved events move into the account and follow the sign-in", async ({ page }) => {
  await page.goto("/events/quiet-rooms-portrait-opening");
  await page.getByRole("button", { name: /^Save Quiet Rooms/ }).first().click();

  const email = uniqueEmail("saves");
  await signUp(page, "Lena Vogel", email);
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: /Quiet Rooms/ })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/saved");
  await expect(page.getByText("Nothing saved yet")).toBeVisible();

  await page.goto("/sign-in?next=/saved");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("heading", { name: /Quiet Rooms/ })).toBeVisible();
});

test("signed-in booking lands in the account and can be cancelled", async ({ page }) => {
  const email = uniqueEmail("cancel");
  await signUp(page, "Noor Haddad", email);
  await page.goto("/events/quiet-rooms-portrait-opening");
  const panel = page.getByRole("complementary", { name: "Tickets" });
  await panel.getByRole("button", { name: "One more Free registration" }).click();
  await expect(panel.getByLabel("Email")).toHaveValue(email);
  await panel.getByRole("button", { name: "Get free ticket" }).click();
  await expect(page).toHaveURL(/\/bookings\/EH-/);
  const code = page.url().split("/").pop()!;

  await page.goto("/account");
  const row = page.getByRole("listitem").filter({ hasText: code });
  await row.getByRole("button", { name: "Cancel booking" }).click();
  await row.getByRole("button", { name: "Yes, cancel" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: code }).getByText("Cancelled")).toBeVisible();
  expect((await lastMail(email, "booking-cancelled")).subject).toBe(`Booking ${code} cancelled`);

  await page.goto(`/bookings/${code}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This booking is cancelled");
});
