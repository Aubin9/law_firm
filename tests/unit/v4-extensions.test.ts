import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/server/db";
import {
  registerOrHeartbeatDevice,
  listUserDevices,
  revokeDevice,
  isDeviceRevoked,
} from "@/server/services/device-service";
import {
  pullOfflineSnapshot,
  pushOfflineMutations,
} from "@/server/services/sync-service";
import {
  seedCanonicalLegalLibrary,
  listLegalTexts,
  searchLegalArticles,
  getLegalTextById,
} from "@/server/services/library-service";
import { AppSession } from "@/server/auth/session";

describe("Step 29 (V4 Extensions): Mobile PWA, Offline Encrypted Sync & Legal Library", () => {
  let testUser: any;
  let testSession: AppSession;
  let testMatter: any;

  beforeAll(async () => {
    // Retrieve or setup test user
    const partnerRole = await db.role.findFirst({ where: { key: "PARTNER" } });
    if (!partnerRole) throw new Error("Partner role missing");

    testUser = await db.user.upsert({
      where: { email: "avocat.test.v4@cabinet.cm" },
      update: {},
      create: {
        id: "usr_test_v4_" + Date.now(),
        email: "avocat.test.v4@cabinet.cm",
        name: "Maître Test V4",
        roleId: partnerRole.id,
      },
      include: { role: true },
    });

    testSession = {
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        roleId: testUser.roleId,
        roleKey: "PARTNER" as any,
        locale: "FR" as any,
        status: "ACTIVE" as any,
      },
      session: {
        id: "sess_v4_test",
        token: "tok_v4_test",
        expiresAt: new Date(Date.now() + 3600000),
      },
    };

    // Category
    const cat = await db.matterCategory.findFirst();

    // Test matter
    testMatter = await db.matter.create({
      data: {
        reference: "V4-" + Date.now().toString(36).toUpperCase(),
        title: "Dossier Test V4 Extension Mobile",
        categoryId: cat!.id,
        leadLawyerId: testUser.id,
        createdById: testUser.id,
        status: "OPEN",
      },
    });
  });

  describe("1. Mobile Device Session & Revocation (EXT-02)", () => {
    const deviceId = "device_courtroom_iphone_" + Date.now();

    it("registers a new mobile courtroom device", async () => {
      const res = await registerOrHeartbeatDevice({
        userId: testUser.id,
        deviceId,
        deviceName: "iPhone 15 Pro (Palais)",
        userAgent: "Mobile Safari 17.4",
        ip: "10.0.0.42",
      });

      expect(res.status).toBe("ACTIVE");
      expect(res.device.deviceId).toBe(deviceId);
      expect(res.device.isTrusted).toBe(true);
      expect(res.device.revokedAt).toBeNull();
    });

    it("heartbeats an existing device updating lastSeenAt and IP", async () => {
      const res = await registerOrHeartbeatDevice({
        userId: testUser.id,
        deviceId,
        deviceName: "iPhone 15 Pro (Palais de Justice)",
        userAgent: "Mobile Safari 17.4",
        ip: "10.0.0.99",
      });

      expect(res.status).toBe("ACTIVE");
      expect(res.device.lastIp).toBe("10.0.0.99");
      expect(res.device.deviceName).toBe("iPhone 15 Pro (Palais de Justice)");
    });

    it("lists devices belonging to the user", async () => {
      const devices = await listUserDevices(testUser.id);
      expect(devices.length).toBeGreaterThanOrEqual(1);
      const target = devices.find((d) => d.deviceId === deviceId);
      expect(target).toBeDefined();
    });

    it("revokes a lost/compromised device and returns revoked status", async () => {
      const revoked = await revokeDevice(deviceId, testUser.id);
      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.isTrusted).toBe(false);

      const isRev = await isDeviceRevoked(deviceId);
      expect(isRev).toBe(true);

      // Attempting to heartbeat now returns REVOKED
      const heartbeat = await registerOrHeartbeatDevice({
        userId: testUser.id,
        deviceId,
        deviceName: "Attempted Heartbeat",
        userAgent: "Mobile Safari",
        ip: "10.0.0.42",
      });
      expect(heartbeat.status).toBe("REVOKED");
    });
  });

  describe("2. Limited Offline Sync & Non-Silent Conflict Handling (EXT-03, 409)", () => {
    it("pulls snapshot strictly limited to assigned active matters and upcoming deadlines", async () => {
      const snapshot = await pullOfflineSnapshot(testSession);
      expect(snapshot).toHaveProperty("pulledAt");
      expect(Array.isArray(snapshot.matters)).toBe(true);
      expect(Array.isArray(snapshot.hearings)).toBe(true);
      expect(Array.isArray(snapshot.tasks)).toBe(true);

      const foundMatter = snapshot.matters.find((m) => m.id === testMatter.id);
      expect(foundMatter).toBeDefined();
      expect(foundMatter?.syncVersion).toBeDefined();
    });

    it("creates an offline note without conflict", async () => {
      const noteMutation = {
        id: "mut_note_" + Date.now(),
        entityType: "NOTE" as const,
        matterId: testMatter.id,
        clientVersion: Date.now(),
        action: "CREATE" as const,
        payload: {
          body: "Note prise à la barre du Tribunal de Première Instance de Yaoundé",
        },
      };

      const results = await pushOfflineMutations(testSession, [noteMutation]);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe("MERGED");
      expect(results[0].newVersion).toBeDefined();
    });

    it("detects concurrent modification and rejects with CONFLICT (no silent overwrite)", async () => {
      // Create a task
      const task = await db.task.create({
        data: {
          title: "Déposer conclusions récapitulatives",
          matterId: testMatter.id,
          createdById: testUser.id,
          status: "TODO",
        },
      });

      const initialCheckoutVersion = task.updatedAt.getTime();

      // Wait a fraction and simulate server modification by another lawyer
      await new Promise((r) => setTimeout(r, 50));
      await db.task.update({
        where: { id: task.id },
        data: { title: "Déposer conclusions récapitulatives (Modifié par Associé)" },
      });

      // Now client tries to replay an update made against the older version
      const staleMutation = {
        id: "mut_task_stale_" + Date.now(),
        entityType: "TASK" as const,
        entityId: task.id,
        matterId: testMatter.id,
        clientVersion: initialCheckoutVersion, // Stale!
        action: "UPDATE" as const,
        payload: {
          title: "Déposer conclusions (Modifié hors-ligne)",
          status: "IN_PROGRESS",
        },
      };

      const results = await pushOfflineMutations(testSession, [staleMutation]);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe("CONFLICT");
      expect(results[0].serverData).toBeDefined();
      expect(results[0].clientData).toBeDefined();

      // Verify server data was NOT silently overwritten
      const checkTask = await db.task.findUnique({ where: { id: task.id } });
      expect(checkTask?.title).toContain("Modifié par Associé");
    });

    it("applies changes when lawyer explicitly resolves conflict with forceOverwrite", async () => {
      const task = await db.task.findFirst({
        where: { matterId: testMatter.id },
      });
      expect(task).toBeDefined();

      const forceMutation = {
        id: "mut_task_force_" + Date.now(),
        entityType: "TASK" as const,
        entityId: task!.id,
        matterId: testMatter.id,
        clientVersion: 0, // Outdated, but forceOverwrite is true
        forceOverwrite: true,
        action: "UPDATE" as const,
        payload: {
          title: "Titre résolu après comparaison manuelle du confrère",
          status: "DONE",
        },
      };

      const results = await pushOfflineMutations(testSession, [forceMutation]);
      expect(results.length).toBe(1);
      expect(results[0].status).toBe("MERGED");

      const updated = await db.task.findUnique({ where: { id: task!.id } });
      expect(updated?.title).toBe("Titre résolu après comparaison manuelle du confrère");
      expect(updated?.status).toBe("DONE");
    });
  });

  describe("3. Digital Legal Library: OHADA, Cameroon & CEMAC (EXT-04)", () => {
    it("seeds canonical legal library without errors", async () => {
      const res = await seedCanonicalLegalLibrary(testSession);
      expect(res.success).toBe(true);
      expect(res.count).toBeGreaterThanOrEqual(5);
    });

    it("lists legal texts grouped by jurisdiction", async () => {
      const allTexts = await listLegalTexts();
      expect(allTexts.length).toBeGreaterThanOrEqual(5);

      const ohadaTexts = await listLegalTexts({ jurisdiction: "OHADA" as any });
      expect(ohadaTexts.length).toBeGreaterThanOrEqual(2);
      expect(ohadaTexts.some((t) => t.code === "OHADA-AUPRVE-2023")).toBe(true);

      const cmrTexts = await listLegalTexts({ jurisdiction: "CAMEROON" as any });
      expect(cmrTexts.length).toBeGreaterThanOrEqual(2);
      expect(cmrTexts.some((t) => t.code === "CMR-LOI-2024-017")).toBe(true);
    });

    it("retrieves a legal text with articles ordered by index", async () => {
      const auprve = await db.legalText.findUnique({
        where: { code: "OHADA-AUPRVE-2023" },
      });
      expect(auprve).toBeDefined();

      const details = await getLegalTextById(auprve!.id);
      expect(details).toBeDefined();
      expect(details?.articles.length).toBeGreaterThanOrEqual(3);
      expect(details?.articles[0].orderIndex).toBeLessThanOrEqual(details?.articles[1].orderIndex!);
    });

    it("searches legal articles across corpus by keyword or concept", async () => {
      // 1. Search 'injonction' -> should find AUPRVE Art. 1
      const injonctionResults = await searchLegalArticles("injonction");
      expect(injonctionResults.length).toBeGreaterThanOrEqual(1);
      expect(injonctionResults.some((a) => a.articleNumber === "Article 1")).toBe(true);

      // 2. Search 'secret professionnel' -> should find Law 2024/017 Art. 5
      const secretResults = await searchLegalArticles("secret professionnel");
      expect(secretResults.length).toBeGreaterThanOrEqual(1);
      expect(secretResults.some((a) => a.articleNumber === "Article 5")).toBe(true);

      // 3. Search 'abus de confiance' -> should find Cameroon Penal Code Art. 308
      const penalResults = await searchLegalArticles("abus de confiance");
      expect(penalResults.length).toBeGreaterThanOrEqual(1);
      expect(penalResults.some((a) => a.articleNumber === "Article 308")).toBe(true);
    });
  });
});
