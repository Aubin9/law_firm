# Disaster Recovery & Restoration Runbook (ops/RESTORE.md)

> **Compliance**: Conforme à la Loi camerounaise n° 2024/017 relative à la protection des données à caractère personnel et à l'architecture souveraine LAN/VPN (ARCHITECTURE.md Section 9, SPECIFICATIONS.md Section 11).

---

## 1. Objectifs de Continuité d'Activité (SLA)

| Indicateur | Cible | Description |
|---|---|---|
| **RPO** (Recovery Point Objective) | **< 24 heures** | Perte maximale de données admissible en cas de sinistre majeur (couvert par la sauvegarde quotidienne nocturne à 02h00 et l'archivage WAL). |
| **RTO** (Recovery Time Objective) | **< 2 heures** | Délai maximal de remise en service complète de la plateforme applicative et de la base de données. |

---

## 2. Architecture de Sauvegarde (3-2-1)

1. **Données de production** : PostgreSQL local (`lawfirm_db`) + Stockage de fichiers local (`./storage/documents`).
2. **Copie locale sur périphérique distinct** : Dépôt chiffré Restic (`/var/backups/restic-repo`) avec politique GFS :
   - 14 générations journalières (`--keep-daily 14`)
   - 8 générations hebdomadaires (`--keep-weekly 8`)
   - 12 générations mensuelles (`--keep-monthly 12`)
3. **Copie hors site chiffrée** : Dépôt chiffré répliqué sur disque externe sécurisé hors site ou compte cloud approuvé (`drive.sync.enabled` uniquement sur dérogation écrite).

> [!IMPORTANT]
> **Gestion des clés de chiffrement** :
> La clé de déchiffrement Restic (`restic.key`) et le mot de passe de sauvegarde sont conservés sous pli scellé dans le coffre-fort physique du cabinet et chez un notaire / avocat associé référent. **Aucun secret n'est commité dans le dépôt Git ni stocké en clair sur le cloud.**

---

## 3. Scénario 1 : Restauration d'urgence après corruption ou suppression accidentelle

Si la base de production est endommagée mais que le serveur est fonctionnel :

### Étape 1 : Isoler l'application
```bash
# Arrêter les conteneurs applicatifs pour éviter tout accès concurrent
docker compose stop app worker
```

### Étape 2 : Identifier le dernier dump valide
```bash
ls -lt /var/backups/lawfirm/db_*.dump | head -n 5
```

### Étape 3 : Restaurer la base de données PostgreSQL
```bash
export PGPASSWORD="<VOTRE_MOT_DE_PASSE_DB>"
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS lawfirm_db_corrupted;"
psql -h localhost -U postgres -c "ALTER DATABASE lawfirm_db RENAME TO lawfirm_db_corrupted;"
psql -h localhost -U postgres -c "CREATE DATABASE lawfirm_db OWNER postgres;"

# Restauration du dump avec pg_restore
pg_restore -h localhost -U postgres -d lawfirm_db -v /var/backups/lawfirm/db_lawfirm_db_<TIMESTAMP>.dump
```

### Étape 4 : Redémarrer l'application et vérifier l'intégrité
```bash
docker compose start app worker
# Vérifier la santé du système
curl -I http://localhost:3000/api/health
```

---

## 4. Scénario 2 : Restauration depuis le dépôt chiffré Restic

Si les dumps locaux sont inaccessibles et doivent être extraits du dépôt chiffré Restic :

```bash
# Définir l'emplacement du dépôt et la clé
export RESTIC_REPOSITORY="/var/backups/restic-repo"
export RESTIC_PASSWORD_FILE="/etc/lawfirm/restic.key"

# Lister les instantanés disponibles
restic snapshots

# Restaurer le dernier instantané complet dans un répertoire temporaire
mkdir -p /tmp/restore-target
restic restore latest --target /tmp/restore-target

# Restaurer les documents de preuve
rsync -av /tmp/restore-target/storage/documents/ ./storage/documents/

# Restaurer la base PostgreSQL
LATEST_DUMP=$(find /tmp/restore-target -name "db_*.dump" | sort -r | head -n 1)
pg_restore -h localhost -U postgres -d lawfirm_db -v "${LATEST_DUMP}"

# Nettoyage
rm -rf /tmp/restore-target
```

---

## 5. Scénario 3 : Restauration sur nouveau matériel (Bare-Metal / Sinistre Total)

En cas de perte totale de l'hôte physique :

1. **Installation du système d'exploitation** : Ubuntu LTS 22.04 / 24.04 avec chiffrement complet du disque (LUKS).
2. **Installation des prérequis** :
   ```bash
   apt update && apt install -y docker.io docker-compose-v2 restic postgresql-client
   ```
3. **Clonage du code source applicatif** :
   ```bash
   git clone <URL_DEPOT_CABINET> /opt/lawfirm
   cd /opt/lawfirm
   ```
4. **Configuration sécurisée** :
   - Reconstituer `.env` à partir de la fiche d'exploitation scellée.
   - Positionner la clé Restic dans `/etc/lawfirm/restic.key` (droits `chmod 400`).
5. **Restauration des données** : Exécuter la procédure du Scénario 2 ci-dessus.
6. **Lancement de la plateforme** :
   ```bash
   docker compose up -d
   ```

---

## 6. Procédure de Test Trimestriel de Restauration (REC-11, REC-15)

Pour garantir la conformité à la norme ISO 27001 et aux règles du Barreau, un test de restauration à blanc est exécuté au minimum chaque trimestre :

```bash
# Exécution du script de test automatisé
bash ops/restore_test.sh
```

Le script :
- Crée une base isolée `lawfirm_restore_test`.
- Restaure le dernier dump en mesurant la durée en secondes.
- Vérifie le décompte des utilisateurs, dossiers, parties et documents.
- Consigne une ligne `RESTORE_TEST` avec statut `SUCCESS` et `restoreSeconds` dans la table `BackupRun`.
- Nettoie la base de test.

---

## 7. Grille de Contrôle Post-Restauration

- [ ] L'API de santé répond `200 OK` sur `http://localhost:3000/api/health`.
- [ ] La connexion utilisateur avocat et associé fonctionne avec TOTP.
- [ ] La liste des dossiers actifs s'affiche sans erreur.
- [ ] Les documents PDF et pièces jointes peuvent être téléchargés avec SHA-256 intègre.
- [ ] Le journal d'audit contient l'entrée de restauration sans altération d'antériorité.
