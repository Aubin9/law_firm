import { db } from "@/server/db";
import { AppSession } from "@/server/auth/session";
import { authorize } from "@/server/auth/authorize";
import { logAudit } from "@/server/audit/audit-logger";
import {
  LegalJurisdiction,
  LegalTextCategory,
  LegalTextStatus,
  Prisma,
} from "@prisma/client";

export interface ListLegalTextsParams {
  jurisdiction?: LegalJurisdiction;
  category?: LegalTextCategory;
  query?: string;
}

export async function listLegalTexts(params: ListLegalTextsParams = {}) {
  const where: Prisma.LegalTextWhereInput = {};

  if (params.jurisdiction) {
    where.jurisdiction = params.jurisdiction;
  }

  if (params.category) {
    where.category = params.category;
  }

  if (params.query?.trim()) {
    const q = params.query.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { shortTitle: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ];
  }

  return db.legalText.findMany({
    where,
    include: {
      _count: { select: { articles: true } },
    },
    orderBy: [{ jurisdiction: "asc" }, { title: "asc" }],
  });
}

export async function getLegalTextById(id: string) {
  return db.legalText.findUnique({
    where: { id },
    include: {
      articles: {
        orderBy: { orderIndex: "asc" },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function searchLegalArticles(
  query: string,
  options?: { jurisdiction?: LegalJurisdiction; textId?: string }
) {
  if (!query || query.trim().length < 2) return [];

  const q = query.trim();

  const where: Prisma.LegalArticleWhereInput = {
    OR: [
      { articleNumber: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
      { keywords: { has: q.toLowerCase() } },
    ],
  };

  if (options?.textId) {
    where.legalTextId = options.textId;
  } else if (options?.jurisdiction) {
    where.legalText = { jurisdiction: options.jurisdiction };
  }

  return db.legalArticle.findMany({
    where,
    include: {
      legalText: {
        select: {
          id: true,
          code: true,
          title: true,
          shortTitle: true,
          jurisdiction: true,
          category: true,
        },
      },
    },
    orderBy: { orderIndex: "asc" },
    take: 40,
  });
}

/**
 * Seed canonical legal texts for Cameroon, OHADA and CEMAC (EXT-04)
 */
export async function seedCanonicalLegalLibrary(session?: AppSession) {
  // 1. OHADA AUPRVE
  const auprve = await db.legalText.upsert({
    where: { code: "OHADA-AUPRVE-2023" },
    update: {},
    create: {
      code: "OHADA-AUPRVE-2023",
      title: "Acte uniforme révisé portant organisation des procédures simplifiées de recouvrement et des voies d'exécution",
      shortTitle: "AUPRVE",
      jurisdiction: LegalJurisdiction.OHADA,
      category: LegalTextCategory.UNIFORM_ACT,
      status: LegalTextStatus.IN_FORCE,
      enactmentDate: new Date("2023-10-17"),
      inForceDate: new Date("2024-02-16"),
      gazetteRef: "J.O. OHADA n° Spécial du 15/11/2023",
      description: "Cadre harmonisé OHADA sur l'injonction de payer, l'injonction de délivrer, les saisies conservatoires, saisies-attributions et saisies immobilières.",
      sourceUrl: "https://www.ohada.org",
      articles: {
        create: [
          {
            articleNumber: "Article 1",
            orderIndex: 1,
            title: "Conditions d'ouverture de l'injonction de payer",
            content: "Le recouvrement d'une créance certaine, liquide et exigible peut être demandé suivant la procédure d'injonction de payer. La créance doit avoir une cause contractuelle ou résulter de l'émission ou de l'acceptation de tout effet de commerce ou d'un chèque.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["recouvrement", "injonction", "créance", "exigible", "chèque"],
          },
          {
            articleNumber: "Article 2",
            orderIndex: 2,
            title: "Juridiction compétente",
            content: "La demande est portée devant la juridiction compétente du domicile ou du lieu où demeure le débiteur ou l'un d'eux. Les parties ne peuvent déroger à cette compétence par convention expresse ou tacite, sauf si celle-ci a été conclue entre commerçants.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["compétence", "domicile", "débiteur", "tribunal"],
          },
          {
            articleNumber: "Article 11",
            orderIndex: 11,
            title: "Opposition à injonction de payer",
            content: "Le débiteur peut former opposition à la décision portant injonction de payer dans un délai de quinze jours à compter de la signification. L'opposition est portée devant la juridiction compétente dont le président a rendu la décision.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["opposition", "délai", "signification", "15 jours"],
          },
          {
            articleNumber: "Article 153",
            orderIndex: 153,
            title: "Saisie-attribution de créances",
            content: "Tout créancier muni d'un titre exécutoire constatant une créance liquide et exigible peut, pour en obtenir le paiement, saisir entre les mains d'un tiers les créances de son débiteur portant sur une somme d'argent.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["saisie-attribution", "titre exécutoire", "banque", "tiers saisi"],
          },
        ],
      },
    },
  });

  // 2. OHADA AUDCG
  await db.legalText.upsert({
    where: { code: "OHADA-AUDCG-2010" },
    update: {},
    create: {
      code: "OHADA-AUDCG-2010",
      title: "Acte uniforme relatif au droit commercial général",
      shortTitle: "AUDCG",
      jurisdiction: LegalJurisdiction.OHADA,
      category: LegalTextCategory.UNIFORM_ACT,
      status: LegalTextStatus.IN_FORCE,
      enactmentDate: new Date("2010-12-15"),
      inForceDate: new Date("2011-05-15"),
      description: "Statut du commerçant, de l'entreprenant, registre du commerce et du crédit mobilier (RCCM), bail à usage professionnel et vente commerciale.",
      sourceUrl: "https://www.ohada.org",
      articles: {
        create: [
          {
            articleNumber: "Article 2",
            orderIndex: 2,
            title: "Définition du commerçant",
            content: "Est commerçant celui qui fait de l'accomplissement d'actes de commerce par nature sa profession habituelle.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["commerçant", "actes de commerce", "profession"],
          },
          {
            articleNumber: "Article 101",
            orderIndex: 101,
            title: "Champ d'application du bail professionnel",
            content: "Sont soumis aux dispositions du présent livre les baux portant sur des immeubles à usage commercial, industriel, artisanal ou professionnel.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["bail commercial", "bail professionnel", "renouvellement"],
          },
        ],
      },
    },
  });

  // 3. Loi camerounaise n° 2024/017 (Profession d'Avocat)
  await db.legalText.upsert({
    where: { code: "CMR-LOI-2024-017" },
    update: {},
    create: {
      code: "CMR-LOI-2024-017",
      title: "Loi n° 2024/017 du 24 juillet 2024 portant organisation de la profession d'avocat au Cameroun",
      shortTitle: "Loi Barreau 2024",
      jurisdiction: LegalJurisdiction.CAMEROON,
      category: LegalTextCategory.STATUTE,
      status: LegalTextStatus.IN_FORCE,
      enactmentDate: new Date("2024-07-24"),
      gazetteRef: "J.O. République du Cameroun",
      description: "Organisation du Barreau du Cameroun, déontologie, secret professionnel inviolable, maniement des fonds clients CARPA, honoraires et assistance judiciaire.",
      articles: {
        create: [
          {
            articleNumber: "Article 5",
            orderIndex: 5,
            title: "Inviolabilité du secret professionnel",
            content: "L'avocat est tenu au respect du secret professionnel le plus absolu en toute matière, dans le conseil comme dans la défense. Ce secret est d'ordre public, général et illimité dans le temps. Les correspondances et pièces entre avocats ou avec le client sont strictement confidentielles.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["secret professionnel", "confidentialité", "inviolable", "déontologie"],
          },
          {
            articleNumber: "Article 18",
            orderIndex: 18,
            title: "Convention d'honoraires et CARPA",
            content: "Les honoraires sont fixés d'accord parties par une convention écrite. Tout maniement de fonds pour le compte des clients doit obligatoirement transiter par le compte spécial CARPA ouvert au nom de l'Ordre des Avocats.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["honoraires", "convention", "carpa", "fonds clients"],
          },
        ],
      },
    },
  });

  // 4. Code Pénal Camerounais (Loi n° 2016/007)
  await db.legalText.upsert({
    where: { code: "CMR-CP-2016" },
    update: {},
    create: {
      code: "CMR-CP-2016",
      title: "Code Pénal de la République du Cameroun (Loi n° 2016/007 du 12 juillet 2016)",
      shortTitle: "Code Pénal CMR",
      jurisdiction: LegalJurisdiction.CAMEROON,
      category: LegalTextCategory.CODE,
      status: LegalTextStatus.IN_FORCE,
      enactmentDate: new Date("2016-07-12"),
      articles: {
        create: [
          {
            articleNumber: "Article 308",
            orderIndex: 308,
            title: "Abus de confiance",
            content: "Est puni d'un emprisonnement de un à cinq ans et d'une amende de 50 000 à 1 000 000 de francs celui qui détourne, dissipe ou détruit une chose qui lui a été confiée à charge de la rendre, de la présenter ou d'en faire un usage déterminé.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["abus de confiance", "détournement", "pénal"],
          },
          {
            articleNumber: "Article 310",
            orderIndex: 310,
            title: "Escroquerie",
            content: "Est puni d'un emprisonnement de cinq à dix ans et d'une amende de 100 000 à 1 000 000 de francs celui qui, par des manœuvres frauduleuses, trompe une personne pour la déterminer à remettre des fonds ou des biens.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["escroquerie", "manœuvres frauduleuses", "tromperie"],
          },
        ],
      },
    },
  });

  // 5. CEMAC / COBAC Regulation
  await db.legalText.upsert({
    where: { code: "CEMAC-COBAC-R-2020-01" },
    update: {},
    create: {
      code: "CEMAC-COBAC-R-2020-01",
      title: "Règlement COBAC R-2020/01 relatif à la gouvernance des établissements de crédit",
      shortTitle: "Règlement COBAC",
      jurisdiction: LegalJurisdiction.CEMAC,
      category: LegalTextCategory.REGULATION,
      status: LegalTextStatus.IN_FORCE,
      enactmentDate: new Date("2020-07-30"),
      description: "Dispositions prudentielles de la Commission Bancaire de l'Afrique Centrale applicables aux banques du Cameroun et de la zone CEMAC.",
      articles: {
        create: [
          {
            articleNumber: "Article 12",
            orderIndex: 12,
            title: "Comité des risques et conformité",
            content: "Tout établissement de crédit est tenu de constituer un comité des risques chargé de superviser l'adéquation des systèmes de contrôle interne et le respect des normes prudentielles.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["banque", "cobac", "cemac", "risques", "conformité"],
          },
        ],
      },
    },
  });

  // 6. Internal Firm Precedent / Template
  await db.legalText.upsert({
    where: { code: "CAB-MOD-CIV-001" },
    update: {},
    create: {
      code: "CAB-MOD-CIV-001",
      title: "Modèle de Conclusions en Réplique (Tribunal de Grande Instance)",
      shortTitle: "Modèle Conclusions TGI",
      jurisdiction: LegalJurisdiction.CAMEROON,
      category: LegalTextCategory.INTERNAL_TEMPLATE,
      status: LegalTextStatus.IN_FORCE,
      description: "Trame standardisée du cabinet pour les conclusions responsives en matière civile et commerciale.",
      articles: {
        create: [
          {
            articleNumber: "Structure 1",
            orderIndex: 1,
            title: "I. Rappel des faits et de la procédure",
            content: "Attendu que par exploit d'huissier en date du [...], la partie adverse a fait assigner le concluant... Que les prétentions de la partie adverse sont totalement infondées tant en fait qu'en droit...",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["conclusions", "réplique", "modèle", "tgi"],
          },
          {
            articleNumber: "Structure 2",
            orderIndex: 2,
            title: "II. Discussion en droit et Dispositif",
            content: "PAR CES MOTIFS : Plaise au Tribunal : Rejeter l'intégralité des demandes de la partie adverse comme irrecevables et mal fondées ; Déclarer reconventionnellement le concluant fondé en son action ; Condamner la partie adverse aux dépens.",
            status: LegalTextStatus.IN_FORCE,
            keywords: ["dispositif", "par ces motifs", "dépens"],
          },
        ],
      },
    },
  });

  if (session) {
    await logAudit({
      actorId: session.user.id,
      action: "LEGAL_LIBRARY_INITIALIZED",
      entityType: "LegalLibrary",
      metadata: { source: "seedCanonicalLegalLibrary" },
    });
  }

  return { success: true, count: 6 };
}
