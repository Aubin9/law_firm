import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/server/db";
import { env } from "@/lib/env";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        return await hash(password);
      },
      verify: async ({ password, hash: passwordHash }: { password: string; hash: string }) => {
        try {
          return await verify(passwordHash, password);
        } catch {
          return false;
        }
      },
    },
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      locale: {
        type: "string",
        required: false,
        defaultValue: "FR",
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "ACTIVE",
      },
      roleId: {
        type: "string",
        required: true,
      },
      lastLoginAt: {
        type: "date",
        required: false,
      },
    },
  },
  session: {
    expiresIn: 60 * (env.SESSION_IDLE_MINUTES || 30),
    updateAge: 60 * 5,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  rateLimit: {
    window: 60 * (env.LOGIN_LOCKOUT_MINUTES || 15),
    max: env.LOGIN_MAX_ATTEMPTS || 5,
  },
  plugins: [
    twoFactor({
      issuer: "Cabinet Avocats",
    }),
  ],
});

