// =============================================================================
// Source of truth for all roles, permission keys, and role-permission bindings
// Direct implementation of docs/PERMISSIONS.md sections 2 to 4
// =============================================================================

export const ROLES = [
  "PARTNER",
  "LEAD_LAWYER",
  "ASSOCIATE_LAWYER",
  "SECRETARY",
  "ACCOUNTANT",
  "FUNCTIONAL_ADMIN",
  "TECHNICAL_ADMIN",
] as const;

export type RoleKey = (typeof ROLES)[number];

export interface RoleDefinition {
  key: RoleKey;
  nameFr: string;
  nameEn: string;
  description: string;
}

export const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  PARTNER: {
    key: "PARTNER",
    nameFr: "Associé / Responsable du cabinet",
    nameEn: "Partner / Managing Partner",
    description: "Supervision générale, arbitrage, validation finale et stratégie du cabinet.",
  },
  LEAD_LAWYER: {
    key: "LEAD_LAWYER",
    nameFr: "Avocat responsable de dossier",
    nameEn: "Lead Lawyer",
    description: "Gestion opérationnelle, direction des dossiers assignés et représentation.",
  },
  ASSOCIATE_LAWYER: {
    key: "ASSOCIATE_LAWYER",
    nameFr: "Avocat collaborateur",
    nameEn: "Associate Lawyer",
    description: "Travaux de recherche, rédaction et interventions sur les dossiers affectés.",
  },
  SECRETARY: {
    key: "SECRETARY",
    nameFr: "Assistant juridique / Secrétariat",
    nameEn: "Legal Assistant / Secretary",
    description: "Accueil, standard, prise de rendez-vous et suivi administratif des dossiers.",
  },
  ACCOUNTANT: {
    key: "ACCOUNTANT",
    nameFr: "Comptable",
    nameEn: "Accountant",
    description: "Gestion financière, facturation, suivi des paiements, débours et caisse CARPA / séquestre.",
  },
  FUNCTIONAL_ADMIN: {
    key: "FUNCTIONAL_ADMIN",
    nameFr: "Administrateur fonctionnel",
    nameEn: "Functional Administrator",
    description: "Gestion des utilisateurs, rôles, processus, modèles de documents et référentiels.",
  },
  TECHNICAL_ADMIN: {
    key: "TECHNICAL_ADMIN",
    nameFr: "Administrateur technique",
    nameEn: "Technical Administrator",
    description: "Administration système, sauvegardes, infrastructure et sécurité. Sans accès aux dossiers.",
  },
};

export interface PermissionDefinition {
  key: string;
  category: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // 3.1 Administration
  { key: "user.view", category: "admin", description: "Consulter la liste et le détail des utilisateurs" },
  { key: "user.create", category: "admin", description: "Créer un nouvel utilisateur" },
  { key: "user.edit", category: "admin", description: "Modifier le profil ou statut d'un utilisateur" },
  { key: "user.disable", category: "admin", description: "Désactiver un compte utilisateur" },
  { key: "user.revoke_sessions", category: "admin", description: "Révoquer les sessions actives d'un utilisateur" },
  { key: "role.view", category: "admin", description: "Consulter la matrice des rôles et permissions" },
  { key: "role.edit", category: "admin", description: "Modifier les affectations de permissions d'un rôle" },
  { key: "settings.view", category: "admin", description: "Consulter les paramètres du cabinet" },
  { key: "settings.edit", category: "admin", description: "Modifier les paramètres du cabinet" },
  { key: "workflow.view", category: "admin", description: "Consulter les workflows configurés" },
  { key: "workflow.edit", category: "admin", description: "Configurer ou modifier les cycles de travail et transitions" },
  { key: "form_template.edit", category: "admin", description: "Gérer les modèles de documents et formulaires" },
  { key: "reference.edit", category: "admin", description: "Gérer les catégories et référentiels du cabinet" },
  { key: "integration.admin", category: "admin", description: "Administrer les intégrations externes" },
  { key: "transfer.approve", category: "admin", description: "Approuver un transfert externe de données (Loi n° 2024/017)" },
  { key: "backup.view", category: "admin", description: "Consulter l'historique et l'état des sauvegardes" },
  { key: "backup.run", category: "admin", description: "Déclencher une sauvegarde manuelle du système" },
  { key: "backup.restore_test", category: "admin", description: "Exécuter un test de restauration de sauvegarde" },
  { key: "incident.view", category: "admin", description: "Consulter le registre des incidents de sécurité" },
  { key: "incident.edit", category: "admin", description: "Mettre à jour le suivi ou la clôture d'un incident" },
  { key: "incident.create", category: "admin", description: "Déclarer un incident de sécurité ou violation" },

  // 3.2 Prospects, parties, conflicts
  { key: "party.view", category: "party", description: "Consulter les fiches des parties (clients, contacts, adverses)" },
  { key: "party.create", category: "party", description: "Créer une nouvelle partie ou contact" },
  { key: "party.edit", category: "party", description: "Modifier les coordonnées et données d'une partie" },
  { key: "party.archive", category: "party", description: "Archiver ou supprimer de manière réversible une partie" },
  { key: "party.export", category: "party", description: "Exporter le fichier des parties et clients" },
  { key: "inquiry.view", category: "inquiry", description: "Consulter les demandes et prospects reçus" },
  { key: "inquiry.create", category: "inquiry", description: "Enregistrer une nouvelle demande entrante" },
  { key: "inquiry.edit", category: "inquiry", description: "Mettre à jour une demande entrante" },
  { key: "inquiry.assign", category: "inquiry", description: "Affecter une demande à un responsable" },
  { key: "inquiry.decide", category: "inquiry", description: "Accepter formellement ou refuser une demande client" },
  { key: "conflict.run", category: "conflict", description: "Exécuter une recherche de conflit d'intérêts" },
  { key: "conflict.view", category: "conflict", description: "Consulter l'historique et les rapports de conflits d'intérêts" },
  { key: "conflict.resolve", category: "conflict", description: "Conclure l'absence ou la confirmation d'un conflit" },
  { key: "conflict.waive", category: "conflict", description: "Passer outre un conflit identifié (réservé Associé)" },

  // 3.3 Matters, missions, procedures
  { key: "matter.view", category: "matter", description: "Consulter un dossier (selon niveau d'habilitation)" },
  { key: "matter.create", category: "matter", description: "Créer un nouveau dossier" },
  { key: "matter.edit", category: "matter", description: "Modifier les caractéristiques d'un dossier" },
  { key: "matter.assign", category: "matter", description: "Désigner ou modifier l'avocat responsable d'un dossier" },
  { key: "matter.member_manage", category: "matter", description: "Ajouter ou retirer des membres intervenants sur un dossier" },
  { key: "matter.validate_closure", category: "matter", description: "Valider la clôture définitive d'un dossier" },
  { key: "matter.request_closure", category: "matter", description: "Demander la clôture d'un dossier" },
  { key: "matter.archive", category: "matter", description: "Archiver un dossier clôturé" },
  { key: "matter.export", category: "matter", description: "Exporter les données et l'historique d'un dossier" },
  { key: "mission.view", category: "matter", description: "Consulter les missions de conseil et d'assistance" },
  { key: "mission.create", category: "matter", description: "Créer une nouvelle mission de conseil" },
  { key: "mission.edit", category: "matter", description: "Modifier une mission de conseil" },
  { key: "procedure.view", category: "matter", description: "Consulter les procédures judiciaires et d'arbitrage" },
  { key: "procedure.create", category: "matter", description: "Créer une nouvelle procédure judiciaire" },
  { key: "procedure.edit", category: "matter", description: "Modifier les étapes et détails d'une procédure" },

  // 3.4 Calendar, tasks, notes, communications
  { key: "event.view", category: "calendar", description: "Consulter le calendrier, les audiences et rendez-vous" },
  { key: "event.create", category: "calendar", description: "Créer un événement, une audience ou un rendez-vous" },
  { key: "event.edit", category: "calendar", description: "Modifier les horaires et détails d'un événement" },
  { key: "event.cancel", category: "calendar", description: "Annuler un événement du calendrier" },
  { key: "event.postpone", category: "calendar", description: "Renvoyer une audience ou reporter un événement" },
  { key: "deadline.validate", category: "calendar", description: "Valider formellement un délai de procédure légal" },
  { key: "task.view", category: "task", description: "Consulter les tâches et assignations" },
  { key: "task.create", category: "task", description: "Créer une nouvelle tâche" },
  { key: "task.edit", category: "task", description: "Modifier ou réassigner une tâche" },
  { key: "task.assign", category: "task", description: "Assigner une tâche à un collaborateur" },
  { key: "task.validate", category: "task", description: "Valider formellement une tâche soumise à contrôle" },
  { key: "task.cancel", category: "task", description: "Annuler une tâche avec motif obligatoire" },
  { key: "note.view", category: "note", description: "Consulter les notes internes sur un dossier" },
  { key: "note.create", category: "note", description: "Rédiger une note interne" },
  { key: "note.share", category: "note", description: "Marquer une note comme partageable au client" },
  { key: "communication.view", category: "communication", description: "Consulter le registre des échanges et correspondances" },
  { key: "communication.create", category: "communication", description: "Consigner un échange téléphonique, email ou courrier" },

  // 3.5 Documents
  { key: "document.view", category: "document", description: "Visualiser les métadonnées et aperçus de documents" },
  { key: "document.create", category: "document", description: "Verser un document ou déposer une nouvelle version" },
  { key: "document.validate", category: "document", description: "Valider juridiquement une version d'acte ou de pièce" },
  { key: "document.download", category: "document", description: "Télécharger le fichier original d'un document" },
  { key: "document.share", category: "document", description: "Transmettre un document au client ou confrère" },
  { key: "document.export", category: "document", description: "Exporter en masse des documents d'un dossier" },
  { key: "document.delete_request", category: "document", description: "Demander la suppression sécurisée d'un document" },
  { key: "requirement.manage", category: "document", description: "Définir et suivre la liste des pièces attendues" },

  // 3.6 Finance
  { key: "fee.view", category: "finance", description: "Consulter les conventions d'honoraires et tarifs" },
  { key: "fee.create", category: "finance", description: "Créer une convention d'honoraires" },
  { key: "fee.edit", category: "finance", description: "Modifier une convention d'honoraires" },
  { key: "fee.validate", category: "finance", description: "Valider formellement une convention d'honoraires" },
  { key: "invoice.view", category: "finance", description: "Consulter les factures et états de facturation" },
  { key: "invoice.create", category: "finance", description: "Établir un projet de facture ou note d'honoraires" },
  { key: "invoice.edit", category: "finance", description: "Modifier un projet de facture" },
  { key: "invoice.validate", category: "finance", description: "Émettre et valider définitivement une facture" },
  { key: "invoice.cancel", category: "finance", description: "Annuler une facture émise (avec avoir / motif)" },
  { key: "payment.view", category: "finance", description: "Consulter l'historique des règlements" },
  { key: "payment.create", category: "finance", description: "Enregistrer un règlement reçu" },
  { key: "payment.validate", category: "finance", description: "Valider et lettrer un règlement avec une facture" },
  { key: "payment.reject", category: "finance", description: "Rejeter un règlement erroné ou impayé" },
  { key: "expense.view", category: "finance", description: "Consulter le registre des frais et débours" },
  { key: "expense.create", category: "finance", description: "Déclarer une dépense ou débours sur un dossier" },
  { key: "expense.approve", category: "finance", description: "Approuver un débours et autoriser sa refacturation" },
  { key: "fund.view", category: "finance", description: "Consulter les fonds tiers / maniements de fonds (CARPA)" },
  { key: "fund.create", category: "finance", description: "Enregistrer un mouvement de fonds tiers" },
  { key: "fund.validate", category: "finance", description: "Valider un mouvement ou prélèvement sur fonds tiers" },
  { key: "timeentry.create", category: "finance", description: "Saisir du temps passé sur un dossier ou une tâche" },
  { key: "timeentry.view", category: "finance", description: "Consulter les feuilles de temps" },

  // 3.7 Reporting, audit, retention, AI
  { key: "dashboard.view", category: "reporting", description: "Accéder au tableau de bord opérationnel de son rôle" },
  { key: "dashboard.firm", category: "reporting", description: "Accéder à la vue consolidée du cabinet" },
  { key: "report.view", category: "reporting", description: "Consulter les rapports et statistiques d'activité" },
  { key: "report.export", category: "reporting", description: "Exporter les rapports de performance et d'activité" },
  { key: "audit.view", category: "audit", description: "Consulter le journal d'audit d'un dossier" },
  { key: "audit.view_global", category: "audit", description: "Consulter le journal d'audit global du système" },
  { key: "audit.export", category: "audit", description: "Exporter le journal d'audit à des fins de contrôle" },
  { key: "accessgrant.request", category: "security", description: "Solliciter un accès administratif exceptionnel" },
  { key: "accessgrant.approve", category: "security", description: "Approuver ou révoquer un accès d'administration technique" },
  { key: "retention.manage", category: "retention", description: "Gérer les durées d'archivage et politiques de conservation" },
  { key: "destruction.request", category: "retention", description: "Demander la destruction réglementaire d'archives échues" },
  { key: "destruction.approve", category: "retention", description: "Autoriser formellement la destruction d'archives" },
  { key: "hold.place", category: "retention", description: "Poser un gel conservatoire bloquant toute destruction" },
  { key: "hold.release", category: "retention", description: "Lever un gel conservatoire sur un dossier ou document" },
  { key: "ai.use", category: "ai", description: "Générer des résumés ou suggestions d'actes par l'IA" },
  { key: "ai.review", category: "ai", description: "Approuver ou rejeter une suggestion d'assistance IA" },
  { key: "ai.admin", category: "ai", description: "Configurer l'activation de l'IA et les seuils de confidentialité" },
];

export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number]["key"];

/**
 * Exact permission key sets by role as defined in PERMISSIONS.md Section 3.
 * Note: Fine-grained constraints such as "partner approves", "own only", or "hdr only"
 * are verified dynamically in the service layer (assertMatterAccess, authorize filters).
 */
export const ROLE_PERMISSIONS_MATRIX: Record<RoleKey, readonly string[]> = {
  PARTNER: [
    // 3.1 Admin
    "user.view", "user.disable", "user.revoke_sessions", "role.view",
    "settings.view", "settings.edit", "workflow.view", "integration.admin",
    "transfer.approve", "incident.view", "incident.edit", "incident.create",

    // 3.2 Parties & Conflicts
    "party.view", "party.create", "party.edit", "party.archive", "party.export",
    "inquiry.view", "inquiry.create", "inquiry.edit", "inquiry.assign", "inquiry.decide",
    "conflict.run", "conflict.view", "conflict.resolve", "conflict.waive",

    // 3.3 Matters & Missions
    "matter.view", "matter.create", "matter.edit", "matter.assign", "matter.member_manage",
    "matter.validate_closure", "matter.request_closure", "matter.archive", "matter.export",
    "mission.view", "mission.create", "mission.edit",
    "procedure.view", "procedure.create", "procedure.edit",

    // 3.4 Calendar & Tasks
    "event.view", "event.create", "event.edit", "event.cancel", "event.postpone", "deadline.validate",
    "task.view", "task.create", "task.edit", "task.assign", "task.validate", "task.cancel",
    "note.view", "note.create", "note.share", "communication.view", "communication.create",

    // 3.5 Documents
    "document.view", "document.create", "document.validate", "document.download", "document.share",
    "document.export", "document.delete_request", "requirement.manage",

    // 3.6 Finance
    "fee.view", "fee.create", "fee.edit", "fee.validate",
    "invoice.view", "invoice.create", "invoice.edit", "invoice.validate", "invoice.cancel",
    "payment.view", "payment.validate", "payment.reject",
    "expense.view", "expense.create", "expense.approve",
    "fund.view", "fund.create", "fund.validate",
    "timeentry.create", "timeentry.view",

    // 3.7 Reporting, Audit, AI
    "dashboard.view", "dashboard.firm", "report.view", "report.export",
    "audit.view", "audit.view_global", "audit.export", "accessgrant.approve",
    "retention.manage", "destruction.request", "destruction.approve",
    "hold.place", "hold.release", "ai.use", "ai.review", "ai.admin",
  ],

  LEAD_LAWYER: [
    // 3.1 Admin
    "settings.view", "workflow.view", "incident.create",

    // 3.2 Parties & Conflicts
    "party.view", "party.create", "party.edit", "party.archive",
    "inquiry.view", "inquiry.create", "inquiry.edit", "inquiry.assign", "inquiry.decide",
    "conflict.run", "conflict.view", "conflict.resolve",

    // 3.3 Matters & Missions
    "matter.view", "matter.create", "matter.edit", "matter.assign", "matter.member_manage",
    "matter.request_closure", "matter.archive", "matter.export",
    "mission.view", "mission.create", "mission.edit",
    "procedure.view", "procedure.create", "procedure.edit",

    // 3.4 Calendar & Tasks
    "event.view", "event.create", "event.edit", "event.cancel", "event.postpone", "deadline.validate",
    "task.view", "task.create", "task.edit", "task.assign", "task.validate", "task.cancel",
    "note.view", "note.create", "note.share", "communication.view", "communication.create",

    // 3.5 Documents
    "document.view", "document.create", "document.validate", "document.download", "document.share",
    "document.export", "document.delete_request", "requirement.manage",

    // 3.6 Finance
    "fee.view", "fee.create", "fee.edit",
    "invoice.view",
    "expense.view", "expense.create",
    "timeentry.create", "timeentry.view",

    // 3.7 Reporting, Audit, AI
    "dashboard.view", "report.view", "report.export",
    "audit.view", "destruction.request", "hold.place",
    "ai.use", "ai.review",
  ],

  ASSOCIATE_LAWYER: [
    // 3.1 Admin
    "settings.view", "workflow.view", "incident.create",

    // 3.2 Parties & Conflicts
    "party.view", "party.create", "party.edit",
    "inquiry.view", "inquiry.create", "inquiry.edit",
    "conflict.run", "conflict.view",

    // 3.3 Matters & Missions
    "matter.view", "matter.edit",
    "mission.view", "mission.create", "mission.edit",
    "procedure.view", "procedure.create", "procedure.edit",

    // 3.4 Calendar & Tasks
    "event.view", "event.create", "event.edit", "event.cancel", "event.postpone", "deadline.validate",
    "task.view", "task.create", "task.edit", "task.assign", "task.cancel",
    "note.view", "note.create", "communication.view", "communication.create",

    // 3.5 Documents
    "document.view", "document.create", "document.download", "requirement.manage",

    // 3.6 Finance
    "expense.create", "timeentry.create", "timeentry.view",

    // 3.7 Reporting, Audit, AI
    "dashboard.view", "ai.use", "ai.review",
  ],

  SECRETARY: [
    // 3.1 Admin
    "settings.view", "workflow.view", "incident.create",

    // 3.2 Parties & Conflicts
    "party.view", "party.create", "party.edit",
    "inquiry.view", "inquiry.create", "inquiry.edit", "inquiry.assign",
    "conflict.run", "conflict.view",

    // 3.3 Matters & Missions
    "matter.view", "matter.create",
    "mission.view", "procedure.view",

    // 3.4 Calendar & Tasks
    "event.view", "event.create", "event.edit",
    "task.view", "task.create", "task.edit", "task.assign", "task.cancel",
    "communication.view", "communication.create",

    // 3.5 Documents
    "document.view", "document.create", "document.download", "requirement.manage",

    // 3.6 Finance
    "payment.create", "expense.create",

    // 3.7 Reporting, Audit, AI
    "dashboard.view",
  ],

  ACCOUNTANT: [
    // 3.1 Admin
    "settings.view", "workflow.view", "incident.create",

    // 3.2 Parties & Conflicts
    "party.view", "party.create", "party.edit",

    // 3.3 Matters & Missions
    "matter.view", "mission.view", "procedure.view",

    // 3.4 Calendar & Tasks
    "task.view", "task.create", "task.edit", "task.assign", "task.cancel",

    // 3.6 Finance
    "fee.view", "fee.create", "fee.edit",
    "invoice.view", "invoice.create", "invoice.edit", "invoice.validate", "invoice.cancel",
    "payment.view", "payment.create", "payment.validate", "payment.reject",
    "expense.view", "expense.create", "expense.approve",
    "fund.view", "fund.create",
    "timeentry.view",

    // 3.7 Reporting, Audit, AI
    "dashboard.view", "report.view", "report.export",
  ],

  FUNCTIONAL_ADMIN: [
    // 3.1 Admin
    "user.view", "user.create", "user.edit", "user.disable", "user.revoke_sessions",
    "role.view", "role.edit",
    "settings.view", "settings.edit",
    "workflow.view", "workflow.edit",
    "form_template.edit", "reference.edit",
    "incident.create",

    // 3.7 Reporting, Audit, AI
    "dashboard.view", "retention.manage",
  ],

  TECHNICAL_ADMIN: [
    // 3.1 Admin
    "user.view", "user.create", "user.edit", "user.disable", "user.revoke_sessions",
    "role.view", "settings.view", "workflow.view",
    "integration.admin", "backup.view", "backup.run", "backup.restore_test",
    "incident.view", "incident.edit", "incident.create",

    // 3.7 Reporting, Audit, AI
    "dashboard.view", "audit.view_global", "accessgrant.request", "ai.admin",
  ],
};

/**
 * Returns all permission keys assigned to a given role.
 */
export function getPermissionsForRole(roleKey: RoleKey): readonly string[] {
  return ROLE_PERMISSIONS_MATRIX[roleKey] ?? [];
}

/**
 * Checks if a role holds a specific permission key in the static matrix.
 */
export function hasRolePermission(roleKey: RoleKey, permissionKey: string): boolean {
  const permissions = ROLE_PERMISSIONS_MATRIX[roleKey];
  if (!permissions) return false;
  return permissions.includes(permissionKey);
}

