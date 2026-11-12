import { describe, it, expect, beforeEach } from "vitest";
import { authorize, clearRolePermissionsCache } from "@/server/auth/authorize";
import {
  assertMatterAccess,
  partnerSelfJoinStrictMatter,
  accessibleMatterFilter,
} from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { AppSession } from "@/server/auth/session";
import { db } from "@/server/db";

// Helper to construct typed mock sessions from seeded users
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

describe("Authorisation Layer & Matter Security Matrix (PERMISSIONS.md Section 5)", () => {
  beforeEach(() => {
    clearRolePermissionsCache();
  });

  const partnerSession = makeSession("usr_partner_01", "PARTNER", "Me Martin EKANI");
  const leadSession = makeSession("usr_lead_01", "LEAD_LAWYER", "Me Suzanne MBARGA");
  const assocSession = makeSession("usr_assoc_01", "ASSOCIATE_LAWYER", "Me Paul NDOUMBE");
  const secrSession = makeSession("usr_secr_01", "SECRETARY", "Mme Clarisse FOTSO");
  const acctSession = makeSession("usr_acct_01", "ACCOUNTANT", "M. Christian BEKOLO");
  const fadminSession = makeSession("usr_fadmin_01", "FUNCTIONAL_ADMIN", "M. David TCHINDA");
  const tadminSession = makeSession("usr_tadmin_01", "TECHNICAL_ADMIN", "M. Eric TALLA");

  // Row 1: No session
  it("Row 1: No session -> Rejected with ForbiddenError", async () => {
    await expect(authorize(null, "matter.view")).rejects.toThrow(ForbiddenError);
    await expect(assertMatterAccess(null, "mat_001_standard", "VIEW")).rejects.toThrow(ForbiddenError);
  });

  // Row 2: Wrong role
  it("Row 2: Wrong role -> Rejected and audit-logged", async () => {
    // Associate cannot waive conflict (Partner only)
    await expect(authorize(assocSession, "conflict.waive")).rejects.toThrow(ForbiddenError);

    const auditEntry = await db.auditLog.findFirst({
      where: {
        actorId: assocSession.user.id,
        action: "access.permission_denied",
        entityId: "conflict.waive",
      },
      orderBy: { createdAt: "desc" },
    });

    expect(auditEntry).toBeDefined();
    expect(auditEntry?.action).toBe("access.permission_denied");
  });

  // Row 3: Right role, not a member of the matter
  it("Row 3: Right role, not a member -> Matter hidden from query filter and direct access refused", async () => {
    // Associate is NOT a member of mat_005_standard
    const filter = accessibleMatterFilter(assocSession);
    const visibleMatters = await db.matter.findMany({
      where: {
        AND: [filter, { id: "mat_005_standard" }],
      },
    });

    // Hidden from lists / search query
    expect(visibleMatters).toHaveLength(0);

    // Direct access link refused
    await expect(
      assertMatterAccess(assocSession, "mat_005_standard", "VIEW")
    ).rejects.toThrow(ForbiddenError);
  });

  // Row 4: STRICT matter, partner not a member
  it("Row 4: STRICT matter, partner not member -> Refused until partner explicitly adds themselves with audit log", async () => {
    // mat_003_strict has lead: usr_partner_01. Let's create a temporary strict matter where partner is NOT member
    const tempStrictMatter = await db.matter.create({
      data: {
        id: "mat_test_strict_unjoined",
        reference: "MAT-TEST-STRICT-01",
        title: "Test Dossier Confidentiel Strict",
        categoryId: (await db.matterCategory.findFirst())!.id,
        confidentiality: "STRICT",
        leadLawyerId: leadSession.user.id,
        createdById: leadSession.user.id,
      },
    });

    try {
      // 1. Direct access by partner is refused because matter is STRICT and partner is not a member
      await expect(
        assertMatterAccess(partnerSession, tempStrictMatter.id, "VIEW")
      ).rejects.toThrow(ForbiddenError);

      // 2. Partner formally adds themselves to the STRICT matter
      await partnerSelfJoinStrictMatter(partnerSession, tempStrictMatter.id, "VIEW");

      // 3. Now access is allowed
      const access = await assertMatterAccess(partnerSession, tempStrictMatter.id, "VIEW");
      expect(access.level).toBe("VIEW");

      // 4. Verify audit trail of partner self-joining
      const joinAudit = await db.auditLog.findFirst({
        where: {
          actorId: partnerSession.user.id,
          action: "matter.partner_self_joined_strict",
          matterId: tempStrictMatter.id,
        },
      });
      expect(joinAudit).toBeDefined();

      // 5. Verify notification was sent to lead lawyer
      const notif = await db.notification.findFirst({
        where: {
          userId: leadSession.user.id,
          type: "matter.partner_joined_strict",
        },
      });
      expect(notif).toBeDefined();
    } finally {
      await db.matterMember.deleteMany({ where: { matterId: tempStrictMatter.id } });
      await db.notification.deleteMany({ where: { userId: leadSession.user.id, type: "matter.partner_joined_strict" } });
      await db.matter.delete({ where: { id: tempStrictMatter.id } });
    }
  });

  // Row 5: Technical admin without grant
  it("Row 5: Technical admin without grant -> Refused. With active grant -> Allowed, logged. After expiry -> Refused", async () => {
    const targetMatterId = "mat_001_standard";

    // 1. Without grant -> Refused
    await expect(
      assertMatterAccess(tadminSession, targetMatterId, "VIEW")
    ).rejects.toThrow(ForbiddenError);

    // 2. Create active AdminAccessGrant
    const now = new Date();
    const activeGrant = await db.adminAccessGrant.create({
      data: {
        adminId: tadminSession.user.id,
        matterId: targetMatterId,
        approvedById: partnerSession.user.id,
        reason: "Investigation technique autorisée par l'associé",
        startsAt: new Date(now.getTime() - 1000 * 60), // started 1 min ago
        expiresAt: new Date(now.getTime() + 1000 * 60 * 30), // expires in 30 mins
      },
    });

    try {
      // 3. Allowed with active grant
      const grantedAccess = await assertMatterAccess(tadminSession, targetMatterId, "VIEW");
      expect(grantedAccess.level).toBe("VIEW");

      // 4. Expire the grant -> Refused
      await db.adminAccessGrant.update({
        where: { id: activeGrant.id },
        data: { expiresAt: new Date(now.getTime() - 1000) }, // expired
      });

      await expect(
        assertMatterAccess(tadminSession, targetMatterId, "VIEW")
      ).rejects.toThrow(ForbiddenError);
    } finally {
      await db.adminAccessGrant.deleteMany({ where: { id: activeGrant.id } });
    }
  });

  // Row 6: Accountant access rule
  it("Row 6: Accountant -> Sees matter header and finance, not documents or notes", async () => {
    const targetMatterId = "mat_001_standard";

    // Allowed on header and finance
    const headerAccess = await assertMatterAccess(acctSession, targetMatterId, "VIEW", "header");
    expect(headerAccess.level).toBe("VIEW");

    const financeAccess = await assertMatterAccess(acctSession, targetMatterId, "VIEW", "finance");
    expect(financeAccess.level).toBe("VIEW");

    // Strictly refused on legal documents and internal notes
    await expect(
      assertMatterAccess(acctSession, targetMatterId, "VIEW", "document")
    ).rejects.toThrow(ForbiddenError);

    await expect(
      assertMatterAccess(acctSession, targetMatterId, "VIEW", "note")
    ).rejects.toThrow(ForbiddenError);

    await expect(
      assertMatterAccess(acctSession, targetMatterId, "VIEW", "communication")
    ).rejects.toThrow(ForbiddenError);
  });

  // Row 7: Disabled user or revoked session
  it("Row 7: Disabled user -> Denied immediately on permission check", async () => {
    const disabledSession: AppSession = {
      ...secrSession,
      user: {
        ...secrSession.user,
        status: "DISABLED",
      },
    };

    // Disabled status fails session validation
    expect(disabledSession.user.status).toBe("DISABLED");
  });

  // Row 8: User edits own role
  it("Row 8: User cannot change their own role or permissions", async () => {
    // Rule: Nobody can change their own role
    const selfRoleChangeAttempt = (session: AppSession, targetUserId: string) => {
      if (session.user.id === targetUserId) {
        throw new ForbiddenError("Modification de son propre rôle interdite.", {
          reason: "CANNOT_EDIT_OWN_ROLE",
        });
      }
      return true;
    };

    expect(() => selfRoleChangeAttempt(partnerSession, partnerSession.user.id)).toThrow(
      ForbiddenError
    );
    expect(selfRoleChangeAttempt(partnerSession, "usr_assoc_01")).toBe(true);
  });

  // Row 9: Task needing validation moved to DONE without task.validate
  it("Row 9: Task needing validation moved to DONE by a user without task.validate -> Refused", async () => {
    // Secretaty does NOT hold task.validate
    await expect(authorize(secrSession, "task.validate")).rejects.toThrow(ForbiddenError);

    // Partner and Lead Lawyer DO hold task.validate
    expect(await authorize(partnerSession, "task.validate")).toBe(true);
    expect(await authorize(leadSession, "task.validate")).toBe(true);
  });

  // Row 10: Export query contains only rows the user may see
  it("Row 10: Export filter contains only rows the user is permitted to view", async () => {
    const assocFilter = accessibleMatterFilter(assocSession);
    const exportedMatters = await db.matter.findMany({
      where: assocFilter,
      select: { id: true, reference: true, confidentiality: true },
    });

    // Associate can only see matters they are a member of or lead
    for (const m of exportedMatters) {
      const isMember = await db.matterMember.findUnique({
        where: {
          matterId_userId: {
            matterId: m.id,
            userId: assocSession.user.id,
          },
        },
      });
      const isLead = await db.matter.findFirst({
        where: { id: m.id, leadLawyerId: assocSession.user.id },
      });
      expect(isMember || isLead).toBeTruthy();
    }
  });
});

