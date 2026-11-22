"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", input: false },
        city: { type: "string", required: false },
      },
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
