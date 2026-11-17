import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { parseEml, ParsedEmail } from "@/server/services/email-parser";
import { createDocument } from "@/server/services/document-service";
import { createCommunication } from "@/server/services/communication-service";
import { CommunicationChannel, CommunicationDirection } from "@prisma/client";

export interface ImportEmailInput {
  matterId: string;
  emlBuffer: Buffer;
  emlFileName: string;
  partyId?: string | null;
  directionOverride?: CommunicationDirection;
  saveAttachmentsToGed?: boolean;
  comment?: string | null;
}

/**
 * Checks if email association feature flag is enabled.
 */
export async function checkEmailAssociationPreconditions() {
  const flag = await db.featureFlag.findUnique({
    where: { key: "email.association.enabled" },
  });

  return {
    enabled: flag ? flag.enabled : false,
    flagKey: "email.association.enabled",
  };
}

/**
 * Toggles email association feature flag (Partners and Admins only).
 */
export async function toggleEmailAssociationFlag(session: AppSession, enabled: boolean) {
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN" && role !== "FUNCTIONAL_ADMIN") {
    throw new ForbiddenError("Seuls les associés et administrateurs peuvent modifier ce réglage.");
  }

  const flag = await db.featureFlag.upsert({
    where: { key: "email.association.enabled" },
    create: {
      key: "email.association.enabled",
      enabled,
      description: "Association et consignation d'e-mails (.eml) aux dossiers juridiques (INT-04).",
    },
    update: {
      enabled,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "email_association.flag_toggled",
    entityType: "FeatureFlag",
    entityId: flag.key,
    metadata: { key: flag.key, enabled },
  });

  return flag;
}

/**
 * Parses an email buffer and returns its preview metadata.
 */
export async function parseEmailPreview(emlBuffer: Buffer): Promise<ParsedEmail> {
  return parseEml(emlBuffer);
}

/**
 * Imports and associates an .eml email to a matter (INT-04).
 * Stores the .eml in the matter GED, extracts attachments, creates Communication, and logs audit.
 */
export async function importEmailToMatter(session: AppSession, input: ImportEmailInput) {
  await authorize(session, "communication.create");
  await assertMatterAccess(session, input.matterId, "EDIT", "general");

  const preconditions = await checkEmailAssociationPreconditions();
  if (!preconditions.enabled) {
    throw new ForbiddenError(
      "L'association d'e-mails aux dossiers est actuellement désactivée par la politique du cabinet (drapeau email.association.enabled = false)."
    );
  }

  const matter = await db.matter.findUnique({
    where: { id: input.matterId },
    include: {
      parties: { include: { party: true } },
    },
  });

  if (!matter) {
    throw new Error(`Dossier introuvable : ${input.matterId}`);
  }

  // Parse email content
  const parsed = parseEml(input.emlBuffer);

  // 1. Resolve Party
  let matchedPartyId = input.partyId || null;
  if (!matchedPartyId && parsed.fromEmail) {
    // Check if sender matches any matter party
    const matterParty = matter.parties.find(
      (p) => p.party.email?.toLowerCase() === parsed.fromEmail.toLowerCase()
    );
    if (matterParty) {
      matchedPartyId = matterParty.party.id;
    } else {
      // Look up party in global database
      const globalParty = await db.party.findFirst({
        where: { email: { equals: parsed.fromEmail, mode: "insensitive" } },
      });
      if (globalParty) {
        matchedPartyId = globalParty.id;
      }
    }
  }

  // 2. Resolve Direction
  let direction = input.directionOverride;
  if (!direction) {
    if (parsed.fromEmail.toLowerCase() === session.user.email.toLowerCase()) {
      direction = CommunicationDirection.OUTBOUND;
    } else {
      direction = CommunicationDirection.INBOUND;
    }
  }

  // 3. Find default category for Correspondances / Pièces
  const [correspondenceCategory, exhibitsCategory] = await Promise.all([
    db.documentCategory.findFirst({
      where: {
        OR: [
          { key: { contains: "CORRESPONDENCE" } },
          { nameFr: { contains: "Correspondance" } },
        ],
      },
    }),
    db.documentCategory.findFirst({
      where: {
        OR: [
          { key: { contains: "PIECE" } },
          { key: { contains: "EXHIBIT" } },
          { nameFr: { contains: "Pièce" } },
        ],
      },
    }),
  ]);

  // 4. Save the .eml file as a Document in GED (with AV scan, sha256)
  const safeEmlName = `${matter.reference}_email_${Date.now()}.eml`;
  const emlDocument = await createDocument(
    {
      matterId: input.matterId,
      title: `E-mail : ${parsed.subject || "Message reçu"}`,
      categoryId: correspondenceCategory?.id || null,
      fileName: safeEmlName,
      mimeType: "message/rfc822",
      buffer: input.emlBuffer,
      comment: input.comment || `Message e-mail de ${parsed.from} importé le ${new Date().toLocaleDateString("fr-FR")}`,
    },
    session
  );

  // 5. Extract and save attachments if requested (default: true)
  const shouldSaveAttachments = input.saveAttachmentsToGed !== false;
  const attachedDocIds: string[] = [];

  if (shouldSaveAttachments && parsed.attachments.length > 0) {
    for (const att of parsed.attachments) {
      try {
        const attDoc = await createDocument(
          {
            matterId: input.matterId,
            title: `Pièce : ${att.filename}`,
            categoryId: exhibitsCategory?.id || correspondenceCategory?.id || null,
            fileName: `${matter.reference}_${att.filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}`,
            mimeType: att.contentType || "application/octet-stream",
            buffer: att.buffer,
            comment: `Pièce jointe issue de l'e-mail : "${parsed.subject}"`,
          },
          session
        );
        attachedDocIds.push(attDoc.id);
      } catch (attErr) {
        console.error(`Failed to ingest attachment ${att.filename}:`, attErr);
      }
    }
  }

  // 6. Build communication body with headers metadata
  const headerSummary = [
    `De : ${parsed.from}`,
    `À : ${parsed.to}`,
    parsed.cc ? `Cc : ${parsed.cc}` : null,
    `Date du message : ${parsed.date.toLocaleString("fr-FR")}`,
    parsed.attachments.length > 0
      ? `Pièces jointes (${parsed.attachments.length}) : ${parsed.attachments.map((a) => a.filename).join(", ")}`
      : null,
    `Fichier archive : ${safeEmlName}`,
    "--------------------------------------------------------------------------------",
  ]
    .filter(Boolean)
    .join("\n");

  const fullBody = `${headerSummary}\n\n${parsed.bodyText}`;

  // 7. Create Communication record linked to the matter and the eml document
  const communication = await createCommunication(
    {
      matterId: input.matterId,
      partyId: matchedPartyId,
      channel: CommunicationChannel.EMAIL,
      direction,
      subject: parsed.subject || "E-mail sans objet",
      body: fullBody,
      occurredAt: parsed.date,
      documentId: emlDocument.id,
    },
    session
  );

  // 8. Log Audit
  await logAudit({
    actorId: session.user.id,
    action: "email.associated_to_matter",
    entityType: "Communication",
    entityId: communication.id,
    matterId: input.matterId,
    metadata: {
      subject: parsed.subject,
      from: parsed.from,
      attachmentsCount: parsed.attachments.length,
      savedAttachmentsCount: attachedDocIds.length,
      emlDocumentId: emlDocument.id,
    },
  });

  return {
    communication,
    emlDocument,
    attachedDocIds,
    parsed: {
      from: parsed.from,
      to: parsed.to,
      subject: parsed.subject,
      date: parsed.date,
      attachmentsCount: parsed.attachments.length,
    },
  };
}

