import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { assertMatterAccess } from "@/server/auth/matter-access";
import { ForbiddenError } from "@/server/auth/errors";
import { logAudit } from "@/server/audit/audit-logger";
import { createDocument } from "@/server/services/document-service";
import { storageProvider } from "@/server/storage";
import { Locale } from "@prisma/client";

export interface TemplateVariableDefinition {
  key: string;
  labelFr: string;
  labelEn: string;
  required: boolean;
  defaultValue?: string;
  type: "text" | "number" | "date" | "textarea";
}

export interface BuiltinTemplateSpec {
  key: string;
  nameFr: string;
  nameEn: string;
  locale: Locale;
  content: string;
  variables: TemplateVariableDefinition[];
}

export const BUILTIN_TEMPLATES: BuiltinTemplateSpec[] = [
  {
    key: "MANDATE_REPRESENTATION_FR",
    nameFr: "Mandat de Représentation et d'Assistance en Justice",
    nameEn: "Legal Representation and Assistance Mandate",
    locale: Locale.FR,
    variables: [
      { key: "custom.powers", labelFr: "Pouvoirs spécifiques", labelEn: "Specific powers", required: false, type: "textarea", defaultValue: "Représenter le mandant devant toutes les juridictions compétentes, postuler, plaider, conclure et exercer toutes voies de recours." },
      { key: "custom.jurisdiction", labelFr: "Juridiction d'attribution", labelEn: "Assigned Jurisdiction", required: false, type: "text", defaultValue: "Tribunal de Grande Instance du Wouri / Douala" },
    ],
    content: `================================================================================
MANDAT DE REPRÉSENTATION ET D'ASSISTANCE EN JUSTICE
Barreau du Cameroun — Acte Spécial de Pouvoir
================================================================================

LE SOUSSIGNÉ :
Nom / Dénomination : {{client.name}}
Demeurant / Siège : {{client.address}}
Identifiant Fiscal (NIU) : {{client.taxId}}
RCCM : {{client.rccm}}
Représenté légalement par : {{client.representative}}

Ci-après dénommé « LE MANDANT »,

DONNE PAR LES PRÉSENTES POUVOIR SPÉCIAL ET IRRÉVOCABLE À :
Maître {{leadLawyer.name}}, Avocat au Barreau du Cameroun,
Demeurant et exerçant au sein du : {{firm.name}},
{{leadLawyer.email}}

Ci-après dénommé « LE MANDATAIRE »,

POUR ET EN SON NOM :
Dans le cadre de l'affaire référencée : {{matter.reference}}
Intitulé du dossier : {{matter.title}}
À l'encontre de : {{opposingParty.name}} (Demeurant : {{opposingParty.address}})
Devant : {{custom.jurisdiction}}

OBJET ET ÉTENDUE DU MANDAT :
{{custom.powers}}

Le Mandataire est expressément autorisé à :
1. Introduire toute action, assignation, requête, mémoire ou conclusions utiles ;
2. Représenter et assister le Mandant à toutes les audiences de mise en état, plaidoiries et référés ;
3. Recevoir notification de tous actes de procédure, jugements et ordonnances ;
4. Exercer, le cas échéant, toutes voies de recours ordinaires ou extraordinaires (Appel, Pourvoi CCJA/Cour Suprême).

Fait à Douala, en deux exemplaires originaux,
Le {{currentDateExtended}}

Pour le Mandant,                              Pour le Mandataire,
(Signature précédée de la mention            Maître {{leadLawyer.name}}
« Bon pour pouvoir »)                         Avocat au Barreau du Cameroun
`,
  },
  {
    key: "FEE_AGREEMENT_STANDARD",
    nameFr: "Convention d'Honoraires et de Prestations Juridiques",
    nameEn: "Fee Agreement and Legal Services Terms",
    locale: Locale.FR,
    variables: [
      { key: "custom.feeAmount", labelFr: "Montant des honoraires fixes (FCFA)", labelEn: "Fixed fee amount (XAF)", required: true, type: "number", defaultValue: "1500000" },
      { key: "custom.feeStructure", labelFr: "Modalités de règlement", labelEn: "Payment schedule", required: false, type: "textarea", defaultValue: "50% à l'ouverture du dossier, 50% au dépôt des premières conclusions écrites." },
      { key: "custom.successFeePercent", labelFr: "Pourcentage honoraire de résultat (%)", labelEn: "Success fee (%)", required: false, type: "number", defaultValue: "10" },
    ],
    content: `================================================================================
CONVENTION D'HONORAIRES PROFESSIONNELS
Régie par les Usages du Barreau du Cameroun et la Loi n° 2024/017
================================================================================

ENTRE LES SOUSSIGNÉS :

1. Le Cabinet : {{firm.name}}
   Représenté par Maître {{leadLawyer.name}}, Avocat au Barreau du Cameroun
   D'une part,

ET :

2. Le Client : {{client.name}}
   Adresse : {{client.address}}
   NIU : {{client.taxId}} | RCCM : {{client.rccm}}
   D'autre part.

IL A ÉTÉ ARRÊTÉ ET CONVENU CE QUI SUIT :

ARTICLE 1 : OBJET DE LA MISSION
Le Cabinet est chargé d'assurer l'assistance et la représentation du Client dans le cadre du dossier :
- Référence interne : {{matter.reference}}
- Intitulé : {{matter.title}}
- Partie adverse identifiée : {{opposingParty.name}}

ARTICLE 2 : HONORAIRES FIXES
Pour l'accomplissement des diligences requises, le montant forfaitaire des honoraires convenus s'élève à :
{{custom.feeAmount}} FCFA (Hors taxes et débours).

Modalités d'échelonnement :
{{custom.feeStructure}}

ARTICLE 3 : HONORAIRE DE RÉSULTAT
En sus de l'honoraire fixe, il est expressément convenu un honoraire complémentaire de résultat fixé à :
{{custom.successFeePercent}} % des sommes effectivement recouvrées, obtenues ou évitées en faveur du Client.

ARTICLE 4 : DÉBOURS ET FRAIS DE JUSTICE
Les frais d'huissier, d'expertise, de greffe, d'enregistrement fiscal et de déplacement demeurent à la charge exclusive du Client.

ARTICLE 5 : CONFIDENTIALITÉ & PROTECTION DES DONNÉES (LOI 2024/017)
Les informations et pièces transmises par le Client sont couvertes par le secret professionnel absolu et traitées selon les normes de cybersécurité de la loi camerounaise n° 2024/017.

Fait à Douala, le {{currentDate}}

Pour le Cabinet,                              Le Client,
Maître {{leadLawyer.name}}                    (Lu et approuvé, bon pour accord)
`,
  },
  {
    key: "FORMAL_NOTICE_DEFAULT",
    nameFr: "Mise en Demeure Précontentieuse avec Sommation sous Huitaine",
    nameEn: "Formal Notice and Demand Letter (8-Day Cure)",
    locale: Locale.FR,
    variables: [
      { key: "custom.claimAmount", labelFr: "Montant de la créance principale (FCFA)", labelEn: "Claim amount (XAF)", required: true, type: "number", defaultValue: "5000000" },
      { key: "custom.remedyPeriodDays", labelFr: "Délai accordé pour régularisation (jours)", labelEn: "Remedy period (days)", required: false, type: "number", defaultValue: "8" },
      { key: "custom.claimCause", labelFr: "Cause et fondement de la créance", labelEn: "Cause of claim", required: true, type: "textarea", defaultValue: "Factures impayées et inexécution des obligations contractuelles malgré relances amiables préalables." },
    ],
    content: `================================================================================
LETTRE DE MISE EN DEMEURE VALANT SOMMATION DE PAYER
SOUS TOUTES RÉSERVES DE DROIT ET D'ACTION
================================================================================

Douala, le {{currentDateExtended}}

À L'ATTENTION DE :
{{opposingParty.name}}
Adresse : {{opposingParty.address}}

PAR LE MINISTÈRE DE :
{{firm.name}}
Pour le compte de notre client : {{client.name}} (Dossier réf : {{matter.reference}})

OBJET : MISE EN DEMEURE FORMELLE DE PAYER
Montant exigible : {{custom.claimAmount}} FCFA

Madame, Monsieur,

Nous intervenons en qualité de conseils de {{client.name}}.

Il ressort de nos pièces que vous restez redevable à ce jour envers notre client de la somme principale de :
{{custom.claimAmount}} FCFA.

Cause de la créance :
{{custom.claimCause}}

En dépit des précédentes relances et tentatives de règlement à l'amiable, ce montant demeure impayé à cette date.

PAR CES MOTIFS :
Nous vous mettons formellement EN DEMEURE, par la présente valant sommation de payer avec toutes conséquences de droit, d'avoir à procéder au règlement intégral de ladite somme dans un DÉLAI STRICT ET IMPÉRATIF DE {{custom.remedyPeriodDays}} JOURS à compter de la réception de ce pli.

À défaut de paiement intégral dans ce délai impératif, nous avons reçu instruction ferme de notre client de saisir immédiatement la juridiction compétente afin de solliciter :
1. La condamnation au paiement du principal augmenté des intérêts légaux ;
2. L'application des mesures conservatoires prévues par l'Acte Uniforme OHADA portant organisation des sûretés et des voies d'exécution (saisie conservatoire de créances et de comptes bancaires) ;
3. L'allocation de dommages-intérêts compensatoires pour résistance abusive.

La présente vous est adressée sous toutes réserves et sans novation aucune.

Veuillez agréer, Madame, Monsieur, nos salutations distinguées.

Pour {{firm.name}},
Maître {{leadLawyer.name}}
Avocat au Barreau du Cameroun
`,
  },
  {
    key: "OHADA_PIECES_SCHEDULE",
    nameFr: "Bordereau de Communication de Pièces (Procédure OHADA)",
    nameEn: "Schedule of Communicated Exhibits (OHADA Procedure)",
    locale: Locale.FR,
    variables: [
      { key: "custom.piecesList", labelFr: "Liste numérotée des pièces communiquées", labelEn: "List of numbered exhibits", required: true, type: "textarea", defaultValue: "Pièce n° 1 : Contrat commercial initial signé des parties\nPièce n° 2 : Factures n° FAC-2026-001 et avis de réception\nPièce n° 3 : Mise en demeure du [Date] avec décharge de signification" },
      { key: "custom.courtInstance", labelFr: "Juridiction saisie", labelEn: "Court instance", required: false, type: "text", defaultValue: "Tribunal de Grande Instance / Cour d'Appel" },
    ],
    content: `================================================================================
BORDEREAU RÉCAPITULATIF DE COMMUNICATION DE PIÈCES
Conforme aux règles de procédure civile et Actes Uniformes OHADA
================================================================================

JURIDICTION : {{custom.courtInstance}}
DOSSIER RÉFÉRENCE : {{matter.reference}}
AFFAIRE : {{matter.title}}

POUR :
{{client.name}}, Demeurant à {{client.address}},
Ayant pour Conseil : {{firm.name}} (Maître {{leadLawyer.name}})

CONTRE :
{{opposingParty.name}}, Demeurant à {{opposingParty.address}}
Conseil adverse : {{opposingParty.counsel}}

--------------------------------------------------------------------------------
BORDEREAU DES PIÈCES COMMUNIQUÉES ENTRE LES PARTIES :
--------------------------------------------------------------------------------

{{custom.piecesList}}

--------------------------------------------------------------------------------

Sous toutes réserves dont acte,
À Douala, le {{currentDate}}

Pour {{client.name}},
Son Conseil constitué :
Maître {{leadLawyer.name}}
Avocat au Barreau du Cameroun
`,
  },
];

/**
 * Checks if document generation feature is enabled.
 */
export async function checkTemplateGenerationPreconditions() {
  const flag = await db.featureFlag.findUnique({
    where: { key: "templates.generation.enabled" },
  });

  return {
    enabled: flag ? flag.enabled : false,
    flagKey: "templates.generation.enabled",
  };
}

/**
 * Toggles template generation feature flag (Partner or Admin only).
 */
export async function toggleTemplateGenerationFlag(session: AppSession, enabled: boolean) {
  const role = session.user.roleKey;
  if (role !== "PARTNER" && role !== "TECHNICAL_ADMIN" && role !== "FUNCTIONAL_ADMIN") {
    throw new ForbiddenError("Seuls les associés et administrateurs peuvent modifier ce réglage.");
  }

  const flag = await db.featureFlag.upsert({
    where: { key: "templates.generation.enabled" },
    create: {
      key: "templates.generation.enabled",
      enabled,
      description: "Génération documentaire automatique à partir de modèles (INT-05).",
    },
    update: {
      enabled,
    },
  });

  await logAudit({
    actorId: session.user.id,
    action: "template_generation.flag_toggled",
    entityType: "FeatureFlag",
    entityId: flag.key,
    metadata: { key: flag.key, enabled },
  });

  return flag;
}

/**
 * Seeds built-in legal templates into the database and storage.
 */
export async function seedBuiltinTemplates() {
  for (const template of BUILTIN_TEMPLATES) {
    const storageKey = `template_${template.key.toLowerCase()}`;

    // Write template text to storage if not existing
    const buffer = Buffer.from(template.content, "utf-8");
    await storageProvider.put(storageKey, buffer, "text/plain");

    await db.documentTemplate.upsert({
      where: { key: template.key },
      create: {
        key: template.key,
        nameFr: template.nameFr,
        nameEn: template.nameEn,
        locale: template.locale,
        storageKey,
        variables: template.variables as any,
        active: true,
      },
      update: {
        nameFr: template.nameFr,
        nameEn: template.nameEn,
        variables: template.variables as any,
        storageKey,
      },
    });
  }
}

/**
 * Lists all active document templates.
 */
export async function listDocumentTemplates(session: AppSession) {
  await authorize(session, "document.create");

  // Ensure builtins exist
  const count = await db.documentTemplate.count();
  if (count === 0) {
    await seedBuiltinTemplates();
  }

  return await db.documentTemplate.findMany({
    where: { active: true },
    orderBy: { nameFr: "asc" },
  });
}

/**
 * Builds the contextual variables dictionary from a matter.
 */
export async function buildMatterContextVariables(matterId: string, customVariables: Record<string, any> = {}) {
  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: {
      parties: {
        include: { party: true },
      },
      leadLawyer: true,
      procedures: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      missions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!matter) {
    throw new Error(`Dossier non trouvé : ${matterId}`);
  }

  const clientParty = matter.parties.find((p) => p.role === "CLIENT")?.party;
  const opposingParty = matter.parties.find((p) => p.role === "OPPOSING_PARTY")?.party;
  const procedure = matter.procedures[0];
  const now = new Date();

  const vars: Record<string, string> = {
    "matter.reference": matter.reference,
    "matter.title": matter.title,
    "matter.court": procedure?.jurisdiction || "Tribunal de Grande Instance",
    "matter.procedureType": procedure?.kind || "Procédure contentieuse",
    "client.name": clientParty?.displayName || clientParty?.companyName || "Client non spécifié",
    "client.address": clientParty?.address || "Non renseignée",
    "client.taxId": clientParty?.taxId || "Non renseigné",
    "client.rccm": clientParty?.registrationNumber || "Non renseigné",
    "client.representative": clientParty?.displayName || "",
    "opposingParty.name": opposingParty?.displayName || opposingParty?.companyName || "Partie adverse non désignée",
    "opposingParty.address": opposingParty?.address || "Non renseignée",
    "opposingParty.counsel": "Conseil adverse non constitué",
    "leadLawyer.name": matter.leadLawyer?.name || "Maître l'Avocat Associé",
    "leadLawyer.email": matter.leadLawyer?.email || "",
    "firm.name": "Cabinet d'Avocats & Associés",
    "firm.bar": "Barreau du Cameroun",
    "currentDate": now.toLocaleDateString("fr-FR"),
    "currentDateExtended": now.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };

  // Merge custom variables
  for (const [k, v] of Object.entries(customVariables)) {
    if (v !== undefined && v !== null) {
      vars[k] = String(v);
    }
  }

  return { matter, vars };
}

/**
 * Replaces variables inside a template string.
 */
export function substituteVariables(templateContent: string, vars: Record<string, string>) {
  let rendered = templateContent;
  const missingVariables: string[] = [];

  // Match all {{variable}} or {{ variable }}
  rendered = rendered.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, varName) => {
    if (vars[varName] !== undefined && vars[varName].trim().length > 0) {
      return vars[varName];
    }
    missingVariables.push(varName);
    return `[À COMPLÉTER: ${varName}]`;
  });

  return {
    rendered,
    missingVariables: Array.from(new Set(missingVariables)),
  };
}

/**
 * Previews a rendered template for a given matter.
 */
export async function getTemplatePreview(
  session: AppSession,
  templateId: string,
  matterId: string,
  customVariables: Record<string, any> = {}
) {
  await authorize(session, "document.create");
  await assertMatterAccess(session, matterId, "VIEW", "document");

  const template = await db.documentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error(`Modèle de document introuvable : ${templateId}`);
  }

  // Load template content from storage
  let content: string;
  try {
    const buf = await storageProvider.getBuffer(template.storageKey);
    content = buf.toString("utf-8");
  } catch {
    // Fallback to builtin template content if storage file missing
    const builtin = BUILTIN_TEMPLATES.find((b) => b.key === template.key);
    if (!builtin) {
      throw new Error(`Contenu du modèle introuvable pour la clé ${template.storageKey}`);
    }
    content = builtin.content;
  }

  // Merge template variable defaults
  const templateVars = Array.isArray(template.variables) ? (template.variables as any[]) : [];
  const mergedCustom: Record<string, any> = { ...customVariables };
  for (const def of templateVars) {
    if (def.key && def.defaultValue && (mergedCustom[def.key] === undefined || mergedCustom[def.key] === null || mergedCustom[def.key] === "")) {
      mergedCustom[def.key] = def.defaultValue;
    }
  }

  const { vars } = await buildMatterContextVariables(matterId, mergedCustom);
  const { rendered, missingVariables } = substituteVariables(content, vars);

  return {
    template,
    rendered,
    missingVariables,
    vars,
  };
}

export interface GenerateDocumentInput {
  templateId: string;
  matterId: string;
  customVariables?: Record<string, any>;
  title?: string;
  categoryId?: string | null;
  comment?: string;
}

/**
 * Generates a document from a template, stores it locally,
 * and creates a Document and initial DocumentVersion in the matter.
 */
export async function generateDocumentFromTemplate(
  session: AppSession,
  input: GenerateDocumentInput
) {
  await authorize(session, "document.create");
  await assertMatterAccess(session, input.matterId, "EDIT", "document");

  // Check preconditions (flag)
  const preconditions = await checkTemplateGenerationPreconditions();
  if (!preconditions.enabled) {
    throw new Error(
      "La génération documentaire à partir de modèles est actuellement désactivée par la politique du cabinet (drapeau templates.generation.enabled = false)."
    );
  }

  const template = await db.documentTemplate.findUnique({
    where: { id: input.templateId },
  });

  if (!template) {
    throw new Error(`Modèle de document introuvable : ${input.templateId}`);
  }

  // Load template text
  let content: string;
  try {
    const buf = await storageProvider.getBuffer(template.storageKey);
    content = buf.toString("utf-8");
  } catch {
    const builtin = BUILTIN_TEMPLATES.find((b) => b.key === template.key);
    if (!builtin) {
      throw new Error(`Contenu du modèle introuvable pour la clé ${template.storageKey}`);
    }
    content = builtin.content;
  }

  // Merge template variable defaults
  const templateVars = Array.isArray(template.variables) ? (template.variables as any[]) : [];
  const mergedCustom: Record<string, any> = { ...(input.customVariables || {}) };
  for (const def of templateVars) {
    if (def.key && def.defaultValue && (mergedCustom[def.key] === undefined || mergedCustom[def.key] === null || mergedCustom[def.key] === "")) {
      mergedCustom[def.key] = def.defaultValue;
    }
  }

  // Build context variables and substitute
  const { matter, vars } = await buildMatterContextVariables(
    input.matterId,
    mergedCustom
  );
  const { rendered, missingVariables } = substituteVariables(content, vars);

  // Document metadata
  const docTitle =
    input.title?.trim() ||
    `${template.nameFr} — ${matter.reference}`;
  const safeFilename = `${matter.reference.replace(/[^a-zA-Z0-9_-]/g, "_")}_${template.key.toLowerCase()}.txt`;
  const buffer = Buffer.from(rendered, "utf-8");

  // Create document in the matter via document-service (runs AV scan, sha256, version 1)
  const document = await createDocument(
    {
      matterId: input.matterId,
      title: docTitle,
      categoryId: input.categoryId || null,
      fileName: safeFilename,
      mimeType: "text/plain",
      buffer,
      comment: input.comment || `Généré automatiquement depuis le modèle "${template.nameFr}".`,
    },
    session
  );

  // Audit log for template generation
  await logAudit({
    actorId: session.user.id,
    action: "document.generated_from_template",
    entityType: "Document",
    entityId: document.id,
    matterId: input.matterId,
    metadata: {
      templateKey: template.key,
      templateName: template.nameFr,
      missingVariables,
    },
  });

  return {
    document,
    missingVariables,
  };
}
