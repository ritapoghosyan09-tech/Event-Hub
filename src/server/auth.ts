/**
 * Authentication (Better Auth): email + password, database sessions,
 * email verification and password reset. Google sign-in switches on when
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set.
 *
 * Accounts and guest bookings: people can book without an account. When an
 * address is verified, bookings made with it move into that account
 * (claimGuestBookings), so booking first never blocks signing up later.
 */
import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { sendMail } from "./mail";
import { resetPasswordMail, verifyEmailMail } from "./emails";
import { claimGuestBookings } from "./accounts";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const auth = betterAuth({
  appName: "EVENT HUB",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refreshed at most daily
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail(resetPasswordMail(user.email, user.name, url));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail(verifyEmailMail(user.email, user.name, url));
    },
    afterEmailVerification: async (user) => {
      await claimGuestBookings(user.id, user.email);
    },
  },
  socialProviders: google,
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "USER" },
      city: { type: "string", required: false, input: true },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Accounts that arrive verified (Google) claim their guest bookings straight away.
        after: async (user) => {
          if (user.emailVerified) await claimGuestBookings(user.id, user.email);
        },
      },
    },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production" && process.env.E2E !== "1",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
