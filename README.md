# EVENT HUB — web app (v0.3, backend milestone)

Event discovery, booking and an organizer studio. Every page reads from PostgreSQL, and every change goes through server-side code that checks who is asking.
Bookings are written by a transactional engine that cannot oversell. Card payments hold seats until the payment is confirmed.
Architecture, the database and test results are in the Engineering Report; the data model is in `docs/DATABASE.md`.

## What works today

| Area | Status |
| --- | --- |
| Home: featured hero, categories, featured editorial, this weekend, trending, coming up, cities, organizer band | Live data |
| Explore `/events`: search, category, date, city, price, sort; URL-based filters | Live data |
| Category pages `/categories/[slug]` | Live data |
| Event page `/events/[slug]`: gallery with lightbox, facts, map, host, related, sticky ticket panel | Live data |
| Booking: ticket types, per-order limits, live availability, confirmation with QR tickets, `.ics` calendar file | Writes to the database |
| Organizers `/organizers`, `/organizers/[slug]` | Live data |
| Saved events `/saved` | On the device when signed out, in the account when signed in |
| Accounts: `/sign-up`, `/sign-in`, password reset, email confirmation, `/account` (tickets, cancel, profile, password) | Better Auth, database sessions |
| Guest bookings | Move into the account that confirms the same email |
| Organizer studio `/studio`: profile, team roles, events, ticket types, photos, publish, cancel, dashboard, attendees + CSV, check-in | Role-checked on every request |
| Card payments | Stripe Checkout with seat holds and webhooks; pay at the venue when Stripe isn't configured |
| Emails: confirmation, day-before and 2-hour reminders, cancellations | Resend; each email sent once |
| Not found, error, loading states | Done |

**Still to decide:** payouts to organizers (Stripe Connect), commission rate, sending domain. See the Engineering Report.

## Stack

Next.js 16.4 (App Router, Cache Components, Partial Prefetching), React 19.3, TypeScript, Tailwind CSS 4, Motion 14, Prisma 7 with the `pg` driver adapter, PostgreSQL 16, Zod 4, Better Auth, Stripe, Resend (HTTP API), sharp, aws4fetch, qrcode.

## Run it

```
cp .env.example .env              # set DATABASE_URL
npm install                       # runs prisma generate
npm run db:migrate                # applies prisma/migrations/*/migration.sql
npm run db:seed                   # demo content (refuses in production)
npm run dev                       # http://localhost:3000
```

`npm run build && npm start` for production. The build reads the database, because event pages are prerendered, so build after migrating and seeding, with the same environment variables the server runs with.

Scheduled jobs (any cron that can send a header): `GET /api/cron/expire-holds` every 5 minutes and `GET /api/cron/reminders` hourly, both with `Authorization: Bearer $CRON_SECRET`. Stripe webhook: `/api/payments/webhook` (`checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_*`).

## Design system

Tokens live in `src/styles/tokens.css` and map to Tailwind in `src/styles/theme.css`.
- **Palette:** ivory, cream, beige, dusty navy, muted blue and lavender, plus night tones for immersive bands. Every text pairing passes WCAG AA.
- **Type:** Bodoni Moda for display, Hanken Grotesk for text. Both are self-hosted from `src/fonts`.
- **Radius:** 4px tags, 10px inputs, 16px cards, 28px sheets, pill buttons.
- **Signature:** the ticket-stub card, with photo, perforation and date stub.

## Motion

One timing language, set in `src/components/motion/Reveal.tsx`: 140, 240 and 600 ms with ease-out.
- **Home page load:** the headline lines rise in, staggered. This happens once.
- **Hero:** featured photos crossfade with a slow drift, and the rotation pauses on hover.
- **Scrolling:** sections reveal and card grids stagger in.
- **Event photos:** they morph from card to event page through React `<ViewTransition>`.
- **Pages:** every page eases in through `app/template.tsx`.
- **Interactions:**
  - nav hover pill
  - filter chip highlight
  - heart pop on save
  - stepper digits
  - button press
  - animated booking confirmation tick

All motion turns off under `prefers-reduced-motion`.

## Photography

Pexels and Unsplash photos, chosen per category and checked against each source's description. They are free to use under the Pexels and Unsplash licences. See `PHOTO_CREDITS.md`.
They're served at the exact width each layout needs through `src/lib/image-loader.ts`.

## Project layout

```
prisma/            schema.prisma, migrations/0001–0004 (hand-written SQL), seed.dev.ts
scripts/migrate.mjs
docs/DATABASE.md   ER diagram, tables, PostgreSQL vs MongoDB
src/app/           routes; (auth)/, account/, studio/; Server Actions; api/ (auth, payments webhook, cron, checkout)
src/components/    auth/, event/, home/, layout/, motion/, search/, studio/, ui/
src/server/        *-core.ts = data logic with the client passed in (tested directly):
                     bookings, payments, studio, notifications, accounts
                   auth.ts, session.ts (who is asking), permissions.ts (role table),
                   payments.ts + providers/, mail.ts + emails.ts, storage.ts, geocode.ts
src/styles/        tokens.css, theme.css
tests/engine/      node:test against the database (npm run test:engine)
tests/e2e/         Playwright, desktop/tablet/mobile (npm run test:e2e)
```

## Tested

- `tsc`, ESLint and `next build` are clean.
- Engine: 18 tests against PostgreSQL. They cover permissions, guest-booking claims and time zones; ticket edits after sales and two doors scanning one ticket; card holds, confirmation, abandonment and paid-after-resold refunds; event cancellation with refunds; and emails being sent once. Plus the original concurrency test: 40 buyers for 8 seats gives exactly 8.
- Browser: 91 Playwright tests at 1440, 834 and 390 px. They cover browsing, filters, saving, booking, card checkout, sign-up and email confirmation, password reset, cancellation, and the full organizer journey from profile to check-in to cancellation.
- To run the browser suite: build and start with `E2E=1 PAYMENT_PROVIDER=test` (the test checkout and the email outbox), then `npm run test:e2e`.
