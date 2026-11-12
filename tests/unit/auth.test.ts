import { describe, it, expect, vi, beforeEach } from "vitest";
import { loginAction } from "@/server/auth/auth-actions";
import { isTwoFactorRequired } from "@/server/auth/session";
import { db } from "@/server/db";

describe("Authentication & Security Safeguards (SPECIFICATIONS.md AUTH-01 to AUTH-06)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects wrong password with generic security message without leaking detail", async () => {
    const res = await loginAction("associe@cabinet-avocats.cm", "WrongPassword999!", "fr");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Identifiant ou mot de passe incorrect.");
  });

  it("locks out user after repeated failed attempts (brute force protection)", async () => {
    const targetEmail = "lockout-test@cabinet-avocats.cm";

    // Create a temporary test user in DB for lockout testing
    const partnerRole = await db.role.findUnique({ where: { key: "PARTNER" } });
    if (partnerRole) {
      await db.user.upsert({
        where: { email: targetEmail },
        update: { status: "ACTIVE" },
        create: {
          id: "usr_test_lockout",
          email: targetEmail,
          name: "Test Lockout User",
          roleId: partnerRole.id,
          status: "ACTIVE",
          accounts: {
            create: {
              id: "acc_test_lockout",
              accountId: "usr_test_lockout",
              providerId: "credential",
              password: "$argon2id$v=19$m=19456,t=2,p=1$CX7lNgmUx47apQdlevR8zg$pb7m8kXjJN4mxwW5Th8DJ2ldQ3B/tvWrL1nc11syK2o", // Password123!
            },
          },
        },
      });

      let lastRes;
      // Trigger 5 failed attempts
      for (let i = 0; i < 5; i++) {
        lastRes = await loginAction(targetEmail, "BadPass!", "fr");
      }

      expect(lastRes?.success).toBe(false);
      expect(lastRes?.lockedOut).toBe(true);
      expect(lastRes?.lockoutRemainingMinutes).toBe(15);
      expect(lastRes?.error).toContain("verrouillé");

      // Verify immediate rejection on the 6th attempt while locked
      const blockedRes = await loginAction(targetEmail, "Password123!", "fr");
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.lockedOut).toBe(true);

      // Clean up test user
      await db.account.deleteMany({ where: { userId: "usr_test_lockout" } });
      await db.user.deleteMany({ where: { id: "usr_test_lockout" } });
    }
  });

  it("immediately rejects disabled or suspended users on sign in", async () => {
    const targetEmail = "disabled-user@cabinet-avocats.cm";
    const secrRole = await db.role.findUnique({ where: { key: "SECRETARY" } });

    if (secrRole) {
      await db.user.upsert({
        where: { email: targetEmail },
        update: { status: "DISABLED" },
        create: {
          id: "usr_test_disabled",
          email: targetEmail,
          name: "Disabled User",
          roleId: secrRole.id,
          status: "DISABLED",
          accounts: {
            create: {
              id: "acc_test_disabled",
              accountId: "usr_test_disabled",
              providerId: "credential",
              password: "$argon2id$v=19$m=19456,t=2,p=1$CX7lNgmUx47apQdlevR8zg$pb7m8kXjJN4mxwW5Th8DJ2ldQ3B/tvWrL1nc11syK2o",
            },
          },
        },
      });

      const res = await loginAction(targetEmail, "Password123!", "fr");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Votre compte n'est pas autorisé ou est temporairement suspendu.");

      // Clean up
      await db.account.deleteMany({ where: { userId: "usr_test_disabled" } });
      await db.user.deleteMany({ where: { id: "usr_test_disabled" } });
    }
  });

  it("requires Two-Factor Authentication (TOTP) for designated sensitive roles", () => {
    expect(isTwoFactorRequired("PARTNER")).toBe(true);
    expect(isTwoFactorRequired("LEAD_LAWYER")).toBe(true);
    expect(isTwoFactorRequired("ASSOCIATE_LAWYER")).toBe(true);
    expect(isTwoFactorRequired("ACCOUNTANT")).toBe(true);
    expect(isTwoFactorRequired("FUNCTIONAL_ADMIN")).toBe(true);
    expect(isTwoFactorRequired("TECHNICAL_ADMIN")).toBe(true);
    expect(isTwoFactorRequired("CLIENT")).toBe(false);
  });

  it("authenticates seeded demo user with valid Argon2id hash and writes audit log", async () => {
    const partner = await db.user.findFirst({
      where: { role: { key: "PARTNER" }, status: "ACTIVE" },
    });
    const email = partner ? partner.email : "associe@cabinet-avocats.cm";
    const res = await loginAction(email, "Password123!", "fr");
    expect(res.success).toBe(true);
    expect(res.twoFactorRequired).toBe(true);

    // Verify AuditLog entry was written
    const auditEntry = await db.auditLog.findFirst({
      where: {
        action: "auth.login.success",
        entityType: "user",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditEntry).toBeDefined();
    expect(auditEntry?.action).toBe("auth.login.success");
  });
});

