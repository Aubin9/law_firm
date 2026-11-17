import crypto from "crypto";
import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/auth/errors";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { logAudit } from "@/server/audit/audit-logger";
import { storageProvider } from "@/server/storage";
import {
  AiSuggestionKind,
  AiSuggestionStatus,
  TransferProvider,
  Confidentiality,
  ScanStatus,
} from "@prisma/client";
import { redactText } from "./redaction";
import { buildPrompt, PROMPT_VERSIONS } from "./prompts";
import { callAiModel } from "./client";

export const AI_FLAG_KEY = "ai.enabled";

/**
 * Checks whether global AI integration is enabled.
 */
export async function isAiEnabled(): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({
    where: { key: AI_FLAG_KEY },
  });
  if (flag !== null) return flag.enabled;
  return process.env.AI_ENABLED === "true";
}

/**
 * Retrieves the currently active formal ExternalTransferApproval for a provider.
 */
export async function getActiveTransferApproval(provider: TransferProvider) {
  return db.externalTransferApproval.findFirst({
    where: {
      provider,
      revokedAt: null,
    },
    orderBy: { approvedAt: "desc" },
    include: {
      approvedBy: { select: { id: true, name: true } },
    },
  });
}

/**
 * Validates all 5 strict preconditions before any AI call (CLAUDE §8, ARCHITECTURE §10, REC-25).
 */
export async function checkAiPreconditions(
  matterId: string,
  documentVersionIds: string[],
  session: AppSession
) {
  // 1. Global air-gap feature flag
  const enabled = await isAiEnabled();
  if (!enabled) {
    throw new ForbiddenError(
      "Le module d'intelligence artificielle est désactivé au niveau du cabinet (Drapeau global ai.enabled désactivé)."
    );
  }

  // 2. Active ExternalTransferApproval (Loi n° 2024/017)
  const approval = await getActiveTransferApproval(TransferProvider.OPENAI);
  if (!approval) {
    throw new ForbiddenError(
      "Aucune autorisation formelle de transfert externe (ExternalTransferApproval) n'est active pour OPENAI. Une revue juridique est requise."
    );
  }

  // 3. User permission check
  await authorize(session, "ai.use");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  // 4. Per-matter sovereign switch and confidentiality
  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: {
      parties: { include: { party: true } },
      category: true,
    },
  });

  if (!matter) {
    throw new NotFoundError("Dossier introuvable.");
  }

  if (!matter.aiEnabled) {
    throw new ForbiddenError(
      "L'assistance IA est désactivée pour ce dossier spécifique (Interrupteur dossier désactivé)."
    );
  }

  if (
    matter.confidentiality === Confidentiality.RESTRICTED ||
    matter.confidentiality === Confidentiality.STRICT
  ) {
    throw new ForbiddenError(
      `Traitement IA interdit : Ce dossier a un niveau de confidentialité ${matter.confidentiality} exclu de tout transfert externe.`
    );
  }

  // 5. Document-level confidentiality check
  if (documentVersionIds && documentVersionIds.length > 0) {
    const versions = await db.documentVersion.findMany({
      where: { id: { in: documentVersionIds } },
      include: { document: true },
    });

    for (const v of versions) {
      if (v.document.matterId !== matterId) {
        throw new ForbiddenError(
          `Violation d'accès : La pièce ${v.document.title} n'appartient pas au dossier ciblé.`
        );
      }
      if (
        v.document.confidentiality === Confidentiality.RESTRICTED ||
        v.document.confidentiality === Confidentiality.STRICT
      ) {
        throw new ForbiddenError(
          `Traitement IA interdit : La pièce '${v.document.title}' est classée ${v.document.confidentiality}.`
        );
      }
    }
  }

  return { matter, approval };
}

export interface RequestAiSuggestionInput {
  matterId: string;
  kind: AiSuggestionKind;
  documentVersionIds?: string[];
  customInstructions?: string;
  rawText?: string;
}

/**
 * Requests an AI suggestion with automatic data minimisation, legal prompting, and audit logging.
 */
export async function requestAiSuggestion(
  input: RequestAiSuggestionInput,
  session: AppSession
) {
  const docIds = input.documentVersionIds || [];
  const { matter } = await checkAiPreconditions(input.matterId, docIds, session);

  // 1. Gather document contents
  let gatheredText = input.rawText || "";
  const sources: Array<{ documentTitle: string; versionNumber: number; id: string }> = [];

  if (docIds.length > 0) {
    const versions = await db.documentVersion.findMany({
      where: { id: { in: docIds } },
      include: { document: true },
      orderBy: { versionNumber: "asc" },
    });

    for (const v of versions) {
      sources.push({
        documentTitle: v.document.title,
        versionNumber: v.versionNumber,
        id: v.id,
      });

      try {
        const buf = await storageProvider.getBuffer(v.storageKey);
        const text = buf.toString("utf8");
        // Simple sanity check if text contains readable ascii/utf8 characters
        if (text && !text.includes("\u0000")) {
          gatheredText += `\n\n--- DOCUMENT : ${v.document.title} (v${v.versionNumber}) ---\n${text}`;
        } else {
          gatheredText += `\n\n--- DOCUMENT : ${v.document.title} (v${v.versionNumber}) ---\n[Fichier binaire ou scanné : ${v.document.title}]`;
        }
      } catch {
        gatheredText += `\n\n--- DOCUMENT : ${v.document.title} (v${v.versionNumber}) ---\n[Contenu non extractible directement]`;
      }
    }
  }

  // 2. Data minimisation & Redaction
  const maxChars = parseInt(process.env.AI_MAX_INPUT_CHARS || "20000", 10);
  if (gatheredText.length > maxChars) {
    gatheredText = gatheredText.slice(0, maxChars) + "\n[... Texte tronqué pour minimisation de données ...]";
  }

  const knownParties = matter.parties
    .map((p) => p.party.displayName)
    .filter(Boolean) as string[];

  const { redactedText, placeholderMap } = redactText(gatheredText, knownParties);

  // 3. Prompt construction
  const promptPayload: any = {
    text: redactedText,
    instructions: input.customInstructions,
    matterContext: {
      title: matter.title,
      category: matter.category?.nameFr || matter.category?.nameEn,
    },
  };

  if (input.kind === "COMPARISON" && docIds.length >= 2) {
    const v1 = await db.documentVersion.findUnique({ where: { id: docIds[0] }, include: { document: true } });
    const v2 = await db.documentVersion.findUnique({ where: { id: docIds[1] }, include: { document: true } });
    let t1 = "";
    let t2 = "";
    try {
      if (v1) t1 = (await storageProvider.getBuffer(v1.storageKey)).toString("utf8");
      if (v2) t2 = (await storageProvider.getBuffer(v2.storageKey)).toString("utf8");
    } catch {
      // fallback
    }
    promptPayload.comparisonText = {
      original: redactText(t1, knownParties).redactedText,
      revised: redactText(t2, knownParties).redactedText,
    };
  }

  const { system, user } = buildPrompt(input.kind, promptPayload);

  // 4. Execute AI model call
  const aiRes = await callAiModel({
    systemPrompt: system,
    userPrompt: user,
    kind: input.kind,
  });

  // 5. Structure extraction facts if applicable
  let extractedFacts: any = null;
  if (input.kind === "EXTRACTION") {
    try {
      extractedFacts = JSON.parse(aiRes.content);
    } catch {
      // not strict JSON, keep facts as null
    }
  }

  // 6. Save AiSuggestion (status PENDING_REVIEW)
  const suggestion = await db.aiSuggestion.create({
    data: {
      kind: input.kind,
      matterId: matter.id,
      documentVersionIds: docIds,
      model: aiRes.model,
      promptVersion: PROMPT_VERSIONS[input.kind] || "1.0.0",
      output: aiRes.content,
      facts: extractedFacts ? (extractedFacts as any) : undefined,
      sources: sources.length > 0 ? (sources as any) : undefined,
      tokensIn: aiRes.tokensIn,
      tokensOut: aiRes.tokensOut,
      status: AiSuggestionStatus.PENDING_REVIEW,
      requestedById: session.user.id,
    },
  });

  // 7. Audit log (AUD-01, REC-25)
  await logAudit({
    actorId: session.user.id,
    action: "ai.request",
    entityType: "AiSuggestion",
    entityId: suggestion.id,
    matterId: matter.id,
    metadata: {
      kind: input.kind,
      model: aiRes.model,
      promptVersion: suggestion.promptVersion,
      tokensIn: aiRes.tokensIn,
      tokensOut: aiRes.tokensOut,
      sourcesCount: sources.length,
      redactedEntitiesCount: Object.keys(placeholderMap).length,
    },
  });

  return suggestion;
}

/**
 * Accepts an AI suggestion.
 * If kind === DRAFT, creates a new normal document draft version in the GED authored by the lawyer (BR-18).
 */
export async function acceptAiSuggestion(
  suggestionId: string,
  matterId: string,
  session: AppSession
) {
  await authorize(session, "ai.review");
  await assertMatterAccess(session, matterId, "EDIT", "general");

  const suggestion = await db.aiSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion || suggestion.matterId !== matterId) {
    throw new NotFoundError("Suggestion IA introuvable pour ce dossier.");
  }

  if (suggestion.status !== AiSuggestionStatus.PENDING_REVIEW) {
    throw new ValidationError("Cette suggestion a déjà été évaluée.");
  }

  let createdDocumentId: string | null = null;
  let createdVersionId: string | null = null;

  // If it's a DRAFT, materialize it as a genuine document version authored by the reviewing lawyer
  if (suggestion.kind === AiSuggestionKind.DRAFT) {
    const matter = await db.matter.findUnique({
      where: { id: matterId },
      include: { category: true },
    });

    const defaultCategory = await db.documentCategory.findFirst({
      where: { key: "PROCEDURE" },
    }) || await db.documentCategory.findFirst();

    const title = `Projet d'acte (validé suite à assistance IA) - ${new Date().toLocaleDateString("fr-FR")}`;
    const draftBuffer = Buffer.from(suggestion.output, "utf8");
    const sha256 = crypto.createHash("sha256").update(draftBuffer).digest("hex");
    const storageKey = `matters/${matterId}/documents/draft-${Date.now()}.txt`;

    await storageProvider.put(storageKey, draftBuffer, "text/plain; charset=utf-8");

    const doc = await db.document.create({
      data: {
        matterId,
        title,
        categoryId: defaultCategory?.id || "",
        confidentiality: matter?.confidentiality || Confidentiality.STANDARD,
        versions: {
          create: {
            versionNumber: 1,
            fileName: "projet_ia.txt",
            storageKey,
            sha256,
            sizeBytes: draftBuffer.length,
            mimeType: "text/plain",
            scanStatus: ScanStatus.CLEAN,
            status: "DRAFT" as any,
            comment: `Projet validé par ${session.user.name || "l'avocat"} (Suggestion IA #${suggestion.id.slice(0, 8)})`,
            uploadedById: session.user.id,
          },
        },
      },
      include: {
        versions: true,
      },
    });

    createdDocumentId = doc.id;
    createdVersionId = doc.versions[0]?.id || null;
  }

  const updated = await db.aiSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: AiSuggestionStatus.ACCEPTED,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "ai.review.accept",
    entityType: "AiSuggestion",
    entityId: suggestion.id,
    matterId,
    metadata: {
      kind: suggestion.kind,
      createdDocumentId,
      createdVersionId,
    },
  });

  return { suggestion: updated, createdDocumentId, createdVersionId };
}

/**
 * Rejects an AI suggestion with a recorded justification.
 */
export async function rejectAiSuggestion(
  suggestionId: string,
  matterId: string,
  reason: string,
  session: AppSession
) {
  await authorize(session, "ai.review");
  await assertMatterAccess(session, matterId, "EDIT", "general");

  const suggestion = await db.aiSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion || suggestion.matterId !== matterId) {
    throw new NotFoundError("Suggestion IA introuvable pour ce dossier.");
  }

  if (suggestion.status !== AiSuggestionStatus.PENDING_REVIEW) {
    throw new ValidationError("Cette suggestion a déjà été évaluée.");
  }

  const updated = await db.aiSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: AiSuggestionStatus.REJECTED,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "ai.review.reject",
    entityType: "AiSuggestion",
    entityId: suggestion.id,
    matterId,
    metadata: {
      kind: suggestion.kind,
      reason: reason || "Non pertinent ou non conforme aux instructions du dossier.",
    },
  });

  return { suggestion: updated };
}

/**
 * Toggles per-matter AI switch (Partner or Lead Lawyer or ai.admin).
 */
export async function toggleMatterAiSwitch(
  matterId: string,
  enabled: boolean,
  session: AppSession
) {
  const matter = await db.matter.findUnique({
    where: { id: matterId },
    select: { id: true, leadLawyerId: true, title: true },
  });

  if (!matter) {
    throw new NotFoundError("Dossier introuvable.");
  }

  const isLead = matter.leadLawyerId === session.user.id;
  const isPartner = session.user.roleKey === "PARTNER" || (session.user as any).role === "PARTNER";

  if (!isPartner && !isLead) {
    await authorize(session, "ai.admin");
  }

  const updated = await db.matter.update({
    where: { id: matterId },
    data: { aiEnabled: enabled },
  });

  await logAudit({
    actorId: session.user.id,
    action: "matter.ai.toggle",
    entityType: "Matter",
    entityId: matterId,
    matterId,
    metadata: {
      aiEnabled: enabled,
      matterTitle: matter.title,
    },
  });

  return updated;
}

/**
 * Records formal ExternalTransferApproval for cloud AI (OpenAI) under Law n° 2024/017.
 * Partner / Integration Admin only.
 */
export async function recordExternalTransferApproval(
  input: {
    provider: TransferProvider;
    purpose: string;
    dataCategories: string;
    legalReview: string;
  },
  session: AppSession
) {
  const isPartner = session.user.roleKey === "PARTNER" || (session.user as any).role === "PARTNER";
  if (!isPartner) {
    await authorize(session, "integration.admin");
  }

  const approval = await db.externalTransferApproval.create({
    data: {
      provider: input.provider,
      purpose: input.purpose,
      dataCategories: input.dataCategories,
      legalReview: input.legalReview,
      approvedById: session.user.id,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "integration.transfer_approval.record",
    entityType: "ExternalTransferApproval",
    entityId: approval.id,
    metadata: {
      provider: input.provider,
      purpose: input.purpose,
    },
  });

  return approval;
}

/**
 * Lists AI suggestions for a matter.
 */
export async function listMatterAiSuggestions(matterId: string, session: AppSession) {
  await authorize(session, "ai.use");
  await assertMatterAccess(session, matterId, "VIEW", "general");

  return db.aiSuggestion.findMany({
    where: { matterId },
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });
}
