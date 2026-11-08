# Plateforme de Gestion de Cabinet d'Avocats

Plateforme interne et sécurisée de gestion pour cabinet d'avocats au Cameroun.

## Technologies principales

- **Framework**: Next.js 14 (App Router), TypeScript (Strict), Node.js LTS
- **Design & UI**: Tailwind CSS, Radix UI primitives, Lucide React
- **Validation**: Zod (partagé client et serveur), React Hook Form
- **Base de données & ORM**: PostgreSQL avec extensions `pg_trgm` et `unaccent`, Prisma ORM
- **Authentification**: Better Auth (Argon2id, 2FA TOTP), sessions sécurisées
- **Tâches d'arrière-plan**: `pg-boss` (worker asynchrone)
- **Stockage de fichiers**: `StorageProvider` (disque local chiffré / R2 sous approbation)
- **Tests**: Vitest (unitaires, intégration), Playwright (E2E)
- **Sécurité**: Enregistrement append-only des audits et transitions de statuts, zéro fuite externe sans approbation explicite.

---

## Prérequis

- **Node.js**: v20+ LTS ou v24+
- **Gestionnaire de paquets**: `npm` (npm uniquement, pas de yarn ni pnpm)
- **Docker & Docker Compose**: pour exécuter PostgreSQL et ClamAV en local

---

## Installation et démarrage

### 1. Cloner et installer les dépendances

```bash
npm install
```

### 2. Configuration d'environnement

Copiez le fichier `.env.example` en `.env` :

```bash
cp .env.example .env
```

Vérifiez et complétez les variables si nécessaire (la base de données par défaut pointe sur `localhost:5432`).

### 3. Commandes disponibles

```bash
# Lancement du serveur de développement
npm run dev

# Vérification du typage TypeScript
npm run typecheck

# Linting ESLint
npm run lint

# Exécution des tests unitaires (Vitest)
npm run test

# Exécution des tests E2E (Playwright)
npm run test:e2e

# Démarrage du worker d'arrière-plan
npm run worker

# Compilation de production
npm run build
npm run start
```

