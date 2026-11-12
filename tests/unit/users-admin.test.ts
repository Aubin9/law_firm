import { describe, it, expect, beforeEach } from "vitest";
import {
  listUsers,
  createUser,
  updateUser,
  setUserStatus,
  deleteUser,
} from "@/server/services/user-admin-service";
import { ForbiddenError } from "@/server/auth/errors";
import { AppSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { verify } from "@node-rs/argon2";

function makeSession(
  userId: string,
  roleKey: "PARTNER" | "LEAD_LAWYER" | "ASSOCIATE_LAWYER" | "SECRETARY" | "ACCOUNTANT" | "FUNCTIONAL_ADMIN" | "TECHNICAL_ADMIN",
  name: string
): AppSession {
  return {
    user: {
      id: userId,
      name,
      email: `${roleKey.toLowerCase()}@cabinet-avocats.cm`,
      locale: "FR",
      status: "ACTIVE",
      roleId: `role_${roleKey.toLowerCase()}`,
      roleKey,
      twoFactorEnabled: true,
    },
    session: {
      id: `sess_${userId}`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      token: `token_${userId}`,
    },
  };
}

describe("Users & Roles Administration (SPECIFICATIONS.md AUTH-05, ADM; PERMISSIONS.md 3.1)", () => {
  const fadminSession = makeSession("usr_fadmin_01", "FUNCTIONAL_ADMIN", "M. David TCHINDA");
  const secrSession = makeSession("usr_secr_01", "SECRETARY", "Mme Clarisse FOTSO");

  let leadRoleId: string;
  let partnerRoleId: string;

  beforeEach(async () => {
    const roles = await db.role.findMany();
    leadRoleId = roles.find((r) => r.key === "LEAD_LAWYER")!.id;
    partnerRoleId = roles.find((r) => r.key === "PARTNER")!.id;
  });

  it("enforces user.view permission when listing users", async () => {
    // Secretary cannot view user administration
    await expect(listUsers(secrSession)).rejects.toThrow(ForbiddenError);

    // Functional Admin can view user administration
    const users = await listUsers(fadminSession);
    expect(users.length).toBeGreaterThanOrEqual(7);
  });

  it("creates user with Argon2id hashed temporary password and audit record", async () => {
    const newEmail = "test.new.lawyer@cabinet-avocats.cm";

    try {
      const res = await createUser(fadminSession, {
        name: "Me Test Avocat",
        email: newEmail,
        roleId: leadRoleId,
        locale: "FR",
      });

      expect(res.user.id).toBeDefined();
      expect(res.temporaryPassword).toMatch(/^Temp-[A-F0-9]{8}!$/);

      // Verify Account record exists with valid Argon2id hash
      const account = await db.account.findFirst({
        where: { userId: res.user.id },
      });
      expect(account?.password).toBeDefined();
      const isValid = await verify(account!.password!, res.temporaryPassword);
      expect(isValid).toBe(true);

      // Verify Audit Log entry
      const audit = await db.auditLog.findFirst({
        where: {
          actorId: fadminSession.user.id,
          action: "user.create",
          entityId: res.user.id,
        },
      });
      expect(audit).toBeDefined();

      // Clean up
      await db.account.deleteMany({ where: { userId: res.user.id } });
      await db.user.delete({ where: { id: res.user.id } });
    } finally {
      await db.account.deleteMany({ where: { user: { email: newEmail } } });
      await db.user.deleteMany({ where: { email: newEmail } });
    }
  });

  it("refuses self-role edit and logs security audit entry", async () => {
    // Functional admin tries to change their own role to PARTNER
    await expect(
      updateUser(fadminSession, fadminSession.user.id, {
        roleId: partnerRoleId,
      })
    ).rejects.toThrow(ForbiddenError);

    // Verify self role edit blocked was audit logged
    const audit = await db.auditLog.findFirst({
      where: {
        actorId: fadminSession.user.id,
        action: "user.self_role_edit_blocked",
      },
    });
    expect(audit).toBeDefined();
  });

  it("refuses self-disable / self-suspend", async () => {
    await expect(
      setUserStatus(fadminSession, fadminSession.user.id, "DISABLED")
    ).rejects.toThrow(ForbiddenError);

    await expect(
      setUserStatus(fadminSession, fadminSession.user.id, "SUSPENDED")
    ).rejects.toThrow(ForbiddenError);
  });

  it("revokes all active sessions when a user is suspended or disabled", async () => {
    // Create a temporary user with active sessions
    const tempUser = await db.user.create({
      data: {
        id: "usr_test_sess_revoke",
        name: "User To Suspend",
        email: "to.suspend@cabinet-avocats.cm",
        roleId: leadRoleId,
        status: "ACTIVE",
        sessions: {
          createMany: {
            data: [
              { id: "sess_temp_1", token: "tok_1", expiresAt: new Date(Date.now() + 3600000) },
              { id: "sess_temp_2", token: "tok_2", expiresAt: new Date(Date.now() + 3600000) },
            ],
          },
        },
      },
    });

    try {
      expect(await db.session.count({ where: { userId: tempUser.id } })).toBe(2);

      // Suspend user
      await setUserStatus(fadminSession, tempUser.id, "SUSPENDED");

      // Verify sessions revoked
      const remainingSessions = await db.session.count({ where: { userId: tempUser.id } });
      expect(remainingSessions).toBe(0);

      // Verify audit trail
      const audit = await db.auditLog.findFirst({
        where: {
          actorId: fadminSession.user.id,
          action: "user.status_change",
          entityId: tempUser.id,
        },
      });
      expect(audit).toBeDefined();
    } finally {
      await db.session.deleteMany({ where: { userId: tempUser.id } });
      await db.user.delete({ where: { id: tempUser.id } });
    }
  });

  it("refuses deletion of users with recorded activity (AUTH-05)", async () => {
    // usr_lead_01 is lead lawyer of seeded matters
    await expect(deleteUser(fadminSession, "usr_lead_01")).rejects.toThrow(
      ForbiddenError
    );
  });
});

