/**
 * Email content. Plain, readable HTML in the EVENT HUB palette with a text
 * twin for every message. Kept free of images so it renders the same in every
 * client and never trips spam filters.
 */
import type { Mail } from "./mail";

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(opts: { preheader: string; heading: string; paragraphs: string[]; action?: { label: string; url: string }; footnote?: string }) {
  const p = opts.paragraphs.map((t) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#3a4a5e">${esc(t)}</p>`).join("");
  const btn = opts.action
    ? `<p style="margin:28px 0"><a href="${esc(opts.action.url)}" style="display:inline-block;background:#293D56;color:#FAF8F4;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:999px">${esc(opts.action.label)}</a></p>`
    : "";
  const foot = opts.footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7788">${esc(opts.footnote)}</p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#F5F0E8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FAF8F4;border-radius:20px;padding:36px 32px">
<tr><td>
<p style="margin:0 0 28px;font-family:Georgia,serif;font-size:20px;letter-spacing:.02em;color:#293D56">EVENT HUB</p>
<h1 style="margin:0 0 20px;font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.15;color:#1e2d40">${esc(opts.heading)}</h1>
${p}${btn}${foot}
</td></tr></table></td></tr></table></body></html>`;
}

function text(opts: { heading: string; paragraphs: string[]; action?: { label: string; url: string }; footnote?: string }) {
  return [opts.heading, "", ...opts.paragraphs.flatMap((p) => [p, ""]), opts.action ? `${opts.action.label}: ${opts.action.url}\n` : "", opts.footnote ?? ""]
    .join("\n")
    .trim();
}

function build(to: string, subject: string, tag: string, body: Parameters<typeof layout>[0]): Mail {
  return { to, subject, tag, html: layout(body), text: text(body) };
}

export function verifyEmailMail(to: string, name: string, url: string) {
  return build(to, "Confirm your email for EVENT HUB", "verify-email", {
    preheader: "One tap to confirm your email address.",
    heading: `Confirm your email, ${name.split(" ")[0]}`,
    paragraphs: [
      "Confirming your email lets us send your tickets and reminders, and moves any tickets you booked with this address into your account.",
    ],
    action: { label: "Confirm email", url },
    footnote: "The link works for 24 hours. If you didn't create an EVENT HUB account, you can ignore this email.",
  });
}

export function resetPasswordMail(to: string, name: string, url: string) {
  return build(to, "Reset your EVENT HUB password", "reset-password", {
    preheader: "Choose a new password.",
    heading: "Choose a new password",
    paragraphs: [`Hi ${name.split(" ")[0]}, someone asked to reset the password for this account. If it was you, choose a new one below.`],
    action: { label: "Reset password", url },
    footnote: "The link works for one hour. If you didn't ask for this, your password stays the same and you can ignore this email.",
  });
}

export type BookingMailData = {
  code: string;
  contactName: string;
  contactEmail: string;
  eventTitle: string;
  when: string;
  where: string;
  ticketsLine: string;
  amountLine: string;
};

export function bookingConfirmedMail(b: BookingMailData) {
  return build(b.contactEmail, `Your tickets for ${b.eventTitle}`, "booking-confirmed", {
    preheader: `${b.ticketsLine}, ${b.when}.`,
    heading: `You're going to ${b.eventTitle}`,
    paragraphs: [`Booking ${b.code}: ${b.ticketsLine}.`, `${b.when}. ${b.where}.`, b.amountLine],
    action: { label: "View your tickets", url: appUrl(`/bookings/${b.code}`) },
    footnote: "Show the QR code on that page at the door. Keep this email: its link is how you get back to your tickets.",
  });
}

export function reminderMail(b: BookingMailData, kind: "24h" | "2h") {
  const lead = kind === "24h" ? "Tomorrow" : "In two hours";
  return build(b.contactEmail, `${lead}: ${b.eventTitle}`, `reminder-${kind}`, {
    preheader: `${b.when}. ${b.where}.`,
    heading: `${lead}: ${b.eventTitle}`,
    paragraphs: [`${b.when}. ${b.where}.`, `Booking ${b.code}: ${b.ticketsLine}.`],
    action: { label: "Open your tickets", url: appUrl(`/bookings/${b.code}`) },
  });
}

export function eventCancelledMail(b: BookingMailData, reason: string | null, refunded: boolean) {
  return build(b.contactEmail, `Cancelled: ${b.eventTitle}`, "event-cancelled", {
    preheader: "The organizer has cancelled this event.",
    heading: `${b.eventTitle} has been cancelled`,
    paragraphs: [
      `The organizer cancelled this event, so booking ${b.code} is cancelled too.`,
      ...(reason ? [`Their note: ${reason}`] : []),
      refunded ? "Your payment is being refunded to the card you used. Banks usually show it within 5 to 10 days." : "Nothing was charged for this booking.",
    ],
    action: { label: "Find another event", url: appUrl("/events") },
  });
}

export function bookingCancelledMail(b: BookingMailData, refunded: boolean) {
  return build(b.contactEmail, `Booking ${b.code} cancelled`, "booking-cancelled", {
    preheader: `Your tickets for ${b.eventTitle} are cancelled.`,
    heading: "Your booking is cancelled",
    paragraphs: [
      `Booking ${b.code} for ${b.eventTitle} (${b.ticketsLine}) is cancelled and the tickets no longer work.`,
      refunded ? "Your payment is being refunded to the card you used." : "Nothing was charged for this booking.",
    ],
    action: { label: "Browse events", url: appUrl("/events") },
  });
}
