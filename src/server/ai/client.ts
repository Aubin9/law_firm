/**
 * OpenAI / Gemini Server-side AI Client (Zero external npm dependency, server-only)
 * Communicates via native fetch with strict timeout and fallback mock in test/offline modes.
 */

export interface AiClientRequest {
  systemPrompt: string;
  userPrompt: string;
  kind: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiClientResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export async function callAiModel(req: AiClientRequest): Promise<AiClientResponse> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = req.model || process.env.AI_MODEL || "gpt-4o-mini";
  const isTestOrOffline =
    process.env.NODE_ENV === "test" ||
    !apiKey ||
    apiKey.startsWith("mock-") ||
    apiKey.startsWith("test-");

  if (isTestOrOffline) {
    return generateMockAiResponse(req, model);
  }

  const endpoint = "https://api.openai.com/v1/chat/completions";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxTokens ?? 2500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      throw new Error(`OpenAI API returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const tokensIn = data.usage?.prompt_tokens || Math.ceil((req.systemPrompt.length + req.userPrompt.length) / 4);
    const tokensOut = data.usage?.completion_tokens || Math.ceil(content.length / 4);

    return {
      content,
      tokensIn,
      tokensOut,
      model,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("L'appel à l'API IA a expiré après 30 secondes (Timeout).");
    }
    throw error;
  }
}

/**
 * Deterministic legal mock generator for unit tests and offline air-gapped demo
 */
function generateMockAiResponse(req: AiClientRequest, model: string): AiClientResponse {
  let content = "";
  const tokensIn = Math.ceil((req.systemPrompt.length + req.userPrompt.length) / 4);

  switch (req.kind) {
    case "SUMMARY":
      content = `### Synthèse Juridique de l'Acte (AI-01)
1. **Nature de l'acte** : Conclusions en défense et demande reconventionnelle en paiement.
2. **Thèses principales** : Inopposabilité de la clause résolutoire faute de mise en demeure préalable conformément à l'Acte uniforme OHADA portant droit commercial général (AUDCG).
3. **Prétentions** : Rejet de la demande principale adverse et allocation de 15 000 000 FCFA à titre de dommages et intérêts pour rupture abusive.
4. **Points de vigilance** : Vérifier la date de signification par voie d'huissier afin de garantir le respect du délai de forclusion de 15 jours.`;
      break;

    case "EXTRACTION":
      content = JSON.stringify(
        {
          parties: [
            { name: "[PERSONNE_1]", role: "Demandeur", mention: "Société commerciale" },
            { name: "[PERSONNE_2]", role: "Défendeur", mention: "Commerçant individuel" },
          ],
          keyDates: [
            { date: "2024-03-15", event: "Signature du protocole d'accord", isDeadline: false },
            { date: "2024-04-30", event: "Date butoir pour le premier versement", isDeadline: true },
          ],
          amounts: [
            { amount: "25000000", currency: "XAF", description: "Créance principale en principal et intérêts" },
            { amount: "3000000", currency: "XAF", description: "Clause pénale conventionnelle" },
          ],
          obligations: [
            {
              debtor: "[PERSONNE_2]",
              creditor: "[PERSONNE_1]",
              description: "Paiement de l'échéance par virement sur le compte bancaire",
              condition: "Sous réserve de la levée préalable des saisies conservatoires",
            },
          ],
        },
        null,
        2
      );
      break;

    case "COMPARISON":
      content = `### Analyse Comparative de Versions (AI-03)
1. **Modifications substantielles** :
   - Insertion d'une clause compromissoire désignant le Centre d'Arbitrage du GICAM (Douala) à l'article 14.
   - Réduction du délai de paiement contractuel de 60 jours à 30 jours calendaires.
2. **Modifications formelles** :
   - Précision des coordonnées bancaires et correction de la dénomination sociale.
3. **Impact juridique** :
   - Renonciation expresse à la compétence des juridictions étatiques (TPI de Douala) au profit de la juridiction arbitrale OHADA.`;
      break;

    case "DRAFT":
      content = `PLAISE AU TRIBUNAL DE PREMIÈRE INSTANCE DE DOUALA-BONANJO

POUR : [PERSONNE_1], ayant pour conseil constitué le Cabinet d'Avocats Associés ;
CONTRE : [PERSONNE_2], ayant pour conseil Me X, Avocat au Barreau du Cameroun ;

---

PAR CES MOTIFS :
- Dire et juger recevable et bien fondée l'action engagée par [PERSONNE_1] ;
- Constater le non-respect des stipulations contractuelles par le défendeur ;
- Condamner solidairement [PERSONNE_2] au paiement de la somme de 25 000 000 FCFA en principal ;
- Ordonner l'exécution provisoire sur minute et avant enregistrement, nonobstant toute voie de recours.

SOUS TOUTES RÉSERVES DONT ACTE.`;
      break;

    case "CHRONOLOGY":
      content = `### Reconstitution Chronologique des Faits et Procédure (AI-05)
- **10 Janvier 2024** : Notification de la mise en demeure par exploit d'huissier.
- **25 Février 2024** : Assignation à comparaître devant la chambre commerciale.
- **12 Mars 2024** : Première audience de mise en état ; communication des pièces n° 1 à 8.
- **18 Avril 2024** : Dépôt des conclusions responsives adverses.`;
      break;

    case "INCONSISTENCY":
      content = `### Détection des Incohérences et Risques Procéduraux (AI-06)
1. **Discordance de dates** : La facture produite porte la date du 15 Mars 2024 alors que le bon de livraison visé indique une expédition le 28 Mars 2024.
2. **Contradiction de montants** : Le dispositif réclame 18 500 000 FCFA tandis que le décompte des motifs cumule 16 200 000 FCFA (écart inexpliqué de 2 300 000 FCFA).
3. **Risque d'irrecevabilité** : Absence du timbre fiscal prescrit par le Code général des impôts sur la procuration sous seing privé.`;
      break;

    default:
      content = `Suggestion d'analyse générée automatiquement pour le dossier.`;
  }

  const tokensOut = Math.ceil(content.length / 4);

  return {
    content,
    tokensIn,
    tokensOut,
    model,
  };
}

