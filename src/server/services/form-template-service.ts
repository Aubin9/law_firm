import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { logAudit } from "@/server/audit/audit-logger";

export interface FormTemplateInput {
  key: string;
  entityType: string;
  nameFr: string;
  nameEn: string;
  definition: Record<string, any>;
  defaults?: Record<string, any> | null;
  active?: boolean;
}

/**
 * Lists available active form templates, optionally filtered by entity type.
 * Requires: session authentication
 */
export async function listFormTemplates(
  session: AppSession,
  entityType?: string
) {
  if (!session || !session.user) {
    throw new Error("Authentification requise pour lister les formulaires.");
  }

  return await db.formTemplate.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      active: true,
    },
    orderBy: { nameFr: "asc" },
  });
}

/**
 * Retrieves a single form template by key.
 */
export async function getFormTemplateByKey(
  session: AppSession,
  key: string
) {
  if (!session || !session.user) {
    throw new Error("Authentification requise.");
  }

  const template = await db.formTemplate.findUnique({
    where: { key },
  });

  if (!template) {
    throw new Error(`Modèle de formulaire introuvable pour la clé "${key}".`);
  }

  return template;
}

/**
 * Upserts a form template definition (Functional Admin only).
 * Requires: system.edit
 */
export async function upsertFormTemplate(
  session: AppSession,
  input: FormTemplateInput
) {
  await authorize(session, "system.edit");

  const template = await db.formTemplate.upsert({
    where: { key: input.key },
    update: {
      entityType: input.entityType,
      nameFr: input.nameFr,
      nameEn: input.nameEn,
      definition: input.definition,
      defaults: input.defaults || undefined,
      active: input.active !== undefined ? input.active : true,
    },
    create: {
      key: input.key,
      entityType: input.entityType,
      nameFr: input.nameFr,
      nameEn: input.nameEn,
      definition: input.definition,
      defaults: input.defaults || undefined,
      active: input.active !== undefined ? input.active : true,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "form_template.upsert",
    entityType: "FormTemplate",
    entityId: template.id,
    metadata: { key: template.key, entityType: template.entityType },
  });

  return template;
}

/**
 * Seeds standard form templates if they do not yet exist.
 */
export async function ensureDefaultFormTemplates() {
  const defaults: FormTemplateInput[] = [
    {
      key: "matter_litigation_standard",
      entityType: "MATTER",
      nameFr: "Dossier de Contentieux Judiciaire (TGI / TPI / Cour d'Appel)",
      nameEn: "Standard Court Litigation Matter",
      definition: {
        steps: [
          {
            id: "step_preliminary",
            titleFr: "Informations Générales & Parties",
            titleEn: "General Information & Parties",
            fields: ["title", "clientId", "confidentiality", "priority"],
          },
          {
            id: "step_procedure",
            titleFr: "Juridiction & Équipe",
            titleEn: "Jurisdiction & Legal Team",
            fields: ["leadLawyerId", "jurisdiction", "courtCaseNumber"],
          },
        ],
      },
      defaults: {
        confidentiality: "STANDARD",
        priority: "NORMAL",
      },
      active: true,
    },
    {
      key: "matter_advisory_contract",
      entityType: "MATTER",
      nameFr: "Dossier Conseil & Rédaction d'Actes",
      nameEn: "Legal Advisory & Contract Drafting",
      definition: {
        steps: [
          {
            id: "step_basic",
            titleFr: "Objet du Conseil & Client",
            titleEn: "Advisory Scope & Client",
            fields: ["title", "clientId", "priority"],
          },
          {
            id: "step_details",
            titleFr: "Périmètre de la Mission",
            titleEn: "Mission Scope",
            fields: ["leadLawyerId", "scopeNotes"],
          },
        ],
      },
      defaults: {
        confidentiality: "STANDARD",
        priority: "NORMAL",
      },
      active: true,
    },
    {
      key: "task_hearing_prep",
      entityType: "TASK",
      nameFr: "Préparation d'Audience & Pièces",
      nameEn: "Hearing Preparation & Submissions",
      definition: {
        steps: [
          {
            id: "step_task",
            titleFr: "Détails de la tâche",
            titleEn: "Task Details",
            fields: ["title", "priority", "dueDate", "assigneeId", "matterId"],
          },
        ],
      },
      defaults: {
        priority: "HIGH",
        checklistLabels: [
          "Vérifier la constitution d'avocat",
          "Bordereau de communication de pièces",
          "Projet de conclusions",
        ],
      },
      active: true,
    },
  ];

  for (const t of defaults) {
    await db.formTemplate.upsert({
      where: { key: t.key },
      update: {
        defaults: t.defaults || undefined,
      },
      create: {
        key: t.key,
        entityType: t.entityType,
        nameFr: t.nameFr,
        nameEn: t.nameEn,
        definition: t.definition,
        defaults: t.defaults || undefined,
        active: t.active,
      },
    });
  }
}
