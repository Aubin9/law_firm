/**
 * Versioned legal prompts for Cameroon & OHADA jurisdiction (AI-01 to AI-07, ARCHITECTURE §10)
 */

export const PROMPT_VERSIONS: Record<string, string> = {
  SUMMARY: "1.0.0",
  EXTRACTION: "1.0.0",
  COMPARISON: "1.0.0",
  DRAFT: "1.0.0",
  CHRONOLOGY: "1.0.0",
  INCONSISTENCY: "1.0.0",
  SEARCH: "1.0.0",
};

export const AI_SYSTEM_INSTRUCTION = `Vous êtes l'assistant d'analyse juridique d'un cabinet d'avocats réputé exerçant au Cameroun et dans l'espace OHADA.
Vous appliquez strictement les principes déontologiques :
1. Vos réponses constituent des suggestions préliminaires à l'attention exclusive d'avocats inscrits au Barreau.
2. Vous citez fidèlement les sources textuelles fournies.
3. Vous ne formulez aucune affirmation spéculative non étayée par les pièces du dossier.
4. Vous respectez les règles du droit OHADA (Actes uniformes) et du droit positif camerounais (notamment la Loi n° 2024/017 régissant les communications électroniques et le Code de procédure civile et commerciale).
5. Vous ne modifiez jamais les marqueurs de pseudonymisation réversibles tels que [PERSONNE_1], [TELEPHONE_1], [COMPTE_BANCAIRE_1], etc.`;

export function buildPrompt(kind: string, payload: {
  text?: string;
  comparisonText?: { original: string; revised: string };
  instructions?: string;
  matterContext?: { title: string; category?: string };
}): { system: string; user: string } {
  const version = PROMPT_VERSIONS[kind] || "1.0.0";

  switch (kind) {
    case "SUMMARY":
      return {
        system: `${AI_SYSTEM_INSTRUCTION}\n[Module: AI-01 Document Summary v${version}]`,
        user: `Veuillez analyser le document juridique ci-dessous et fournir une synthèse claire et structurée comprenant :
1. La nature et l'objet de l'acte (ex: conclusions responsives, contrat commercial, assignation, ordonnance).
2. Les thèses juridiques principales ou obligations clés stipulées.
3. Les demandes, prétentions ou sanctions prévues.
4. Les réserves ou points d'attention procéduraux pour l'avocat.

DOCUMENT :
${payload.text}
`,
      };

    case "EXTRACTION":
      return {
        system: `${AI_SYSTEM_INSTRUCTION}\n[Module: AI-02 Legal Entity & Obligation Extraction v${version}]\nRépondez au format JSON strict avec la structure suivante :\n{
  "parties": [{"name": string, "role": string, "mention": string}],
  "keyDates": [{"date": string, "event": string, "isDeadline": boolean}],
  "amounts": [{"amount": string, "currency": string, "description": string}],
  "obligations": [{"debtor": string, "creditor": string, "description": string, "condition": string}]
}`,
        user: `Extrayez de manière exhaustive les entités, échéances procédurales, montants financiers (XAF) et obligations juridiques du document suivant :

DOCUMENT :
${payload.text}
`,
      };

    case "COMPARISON":
      return {
        system: `${AI_SYSTEM_INSTRUCTION}\n[Module: AI-03 Version Comparison & Delta Analysis v${version}]`,
        user: `Comparez minutieusement ces deux versions successives d'un acte juridique.
Mettez en exergue :
1. Les modifications substantielles (ajouts ou retraits de clauses, variations de montants ou de délais).
2. Les modifications de forme ou de précision terminologique.
3. L'impact juridique direct de ces modifications sur les droits et obligations des parties.

VERSION INITIALE :
${payload.comparisonText?.original || ""}

VERSION RÉVISÉE :
${payload.comparisonText?.revised || ""}
`,
      };

    case "DRAFT":
      return {
        system: `${AI_SYSTEM_INSTRUCTION}\n[Module: AI-04 Legal Drafting Assistant v${version}]`,
        user: `Contexte du dossier : ${payload.matterContext?.title || "Dossier contentieux"}.
Instructions particulières de l'avocat : ${payload.instructions || "Rédiger un projet d'acte conforme aux usages du barreau."}

Éléments de faits et pièces de référence :
${payload.text}

Rédigez un projet complet d'acte juridique (en respectant les formules sacramentelles usuelles : 'PLAISE AU TRIBUNAL', 'PAR CES MOTIFS', etc. si c'est une conclusion, ou les clauses de style OHADA si c'est un contrat). Ce projet sera soumis à la relecture et validation de l'avocat instrumentaire.`,
      };

    case "CHRONOLOGY":
      return {
        system: `${AI_SYSTEM_INSTRUCTION}\n[Module: AI-05 Matter Chronology Synthesis v${version}]`,
        user: `Dossier : ${payload.matterContext?.title || "Dossier juridique"}.
À partir des pièces et événements ci-après, reconstituez une frise chronologique détaillée des faits de la cause et des actes de procédure :

DOCUMENTS ET ÉVÉNEMENTS :
${payload.text}
`,
      };

    case "INCONSISTENCY":
      return {
        system: `${AI_SYSTEM_INSTRUCTION}\n[Module: AI-06 Inconsistency & Contradiction Detection v${version}]`,
        user: `Analysez les pièces et déclarations suivantes afin de déceler toute contradiction factuelle, discordance de dates, incohérence de montants ou contrariété de prétentions juridiques :

TEXTE À ANALYSER :
${payload.text}
`,
      };

    default:
      return {
        system: AI_SYSTEM_INSTRUCTION,
        user: payload.text || "",
      };
  }
}

