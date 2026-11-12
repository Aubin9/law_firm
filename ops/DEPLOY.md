# Guide de Déploiement en Production Souveraine (ops/DEPLOY.md)

> **Norme de conformité** : Loi camerounaise n° 2024/017 relative à la protection des données à caractère personnel, ARCHITECTURE.md Sections 9, 15, 16.  
> **Périmètre** : Hébergement local souverain (au sein du cabinet à Douala/Yaoundé) ou Datacenter national au Cameroun, accès exclusif via Réseau Local (LAN) ou tunnel VPN WireGuard.

---

## 1. Prérequis Matériels & Système

### Configuration Matérielle Recommandée (50 utilisateurs, ~20 simultanés)
- **Serveur hôte** : Serveur rack ou tour dédié, processeur 4 à 8 cœurs (x86_64).
- **Mémoire Vive (RAM)** : 16 Go DDR4/DDR5 ECC minimum.
- **Stockage Principal (Système & Base PostgreSQL)** : 500 Go SSD NVMe en RAID 1.
- **Stockage Secondaire (Pièces et Documents de Preuve)** : 2 To SSD/HDD pour la conservation des pièces et versions antérieures.
- **Continuité Électrique** : Onduleur (UPS) communicant (minimum 30 minutes d'autonomie avec arrêt propre automatique de l'hôte).

### Système d'Exploitation
- **Distribution** : Ubuntu Server 22.04 LTS ou 24.04 LTS.
- **Chiffrement du Disque** : Chiffrement intégral des partitions de données avec **LUKS** (`dm-crypt`).

---

## 2. Préparation de l'Hôte & Sécurisation

### Étape 1 : Mise à jour du système et paquets requis
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban wireguard restic postgresql-client
```

### Étape 2 : Installation du moteur Docker & Docker Compose
```bash
# Installation officielle Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Étape 3 : Configuration du Pare-Feu (UFW)
Le serveur ne doit exposer **aucun service sur l'Internet public**. Seuls les ports nécessaires sur l'interface LAN ou WireGuard sont autorisés :

```bash
# Politique par défaut : tout bloquer en entrée
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser SSH uniquement depuis le réseau local d'administration
sudo ufw allow in on eth0 to any port 22 proto tcp

# Autoriser WireGuard (VPN) si l'accès distant est approuvé
sudo ufw allow 51820/udp

# Autoriser HTTP/HTTPS uniquement depuis l'interface LAN ou le tunnel VPN
sudo ufw allow in on eth0 to any port 80 proto tcp
sudo ufw allow in on eth0 to any port 443 proto tcp
sudo ufw allow in on wg0 to any port 80 proto tcp
sudo ufw allow in on wg0 to any port 443 proto tcp

sudo ufw enable
```

---

## 3. Déploiement de l'Application

### Étape 1 : Récupération du code et arborescence
```bash
sudo mkdir -p /opt/lawfirm
sudo chown $USER:$USER /opt/lawfirm
cd /opt/lawfirm
git clone <URL_DEPOT_CABINET> .
```

### Étape 2 : Configuration des variables d'environnement (`.env.production`)
Créer un fichier `.env.production` avec des permissions strictes (`chmod 600`) :

```bash
cat << 'EOF' > .env.production
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
HOST_BIND_IP=0.0.0.0
LAN_DOMAIN=cabinet.lan

# Base de données PostgreSQL interne
POSTGRES_USER=lawfirm
POSTGRES_PASSWORD=<MOT_DE_PASSE_DB_ULTRA_SECURISE_GENERE_PWGEN>
DATABASE_URL=postgresql://lawfirm:<MOT_DE_PASSE_DB_ULTRA_SECURISE_GENERE_PWGEN>@postgres:5432/lawfirm_db?schema=public

# Clé secrète d'authentification (Better Auth) - min 32 caractères
BETTER_AUTH_SECRET=<SECRET_ALEATOIRE_64_HEXADECIMAL>
BETTER_AUTH_URL=https://cabinet.lan

# Stockage et Antivirus interne
STORAGE_LOCAL_PATH=/app/storage/documents
CLAMAV_HOST=clamav
CLAMAV_PORT=3310

# Drapeaux de conformité souveraine (verrouillés à false par défaut)
DRIVE_SYNC_ENABLED=false
AI_ASSISTANT_ENABLED=false
EOF

chmod 600 .env.production
```

### Étape 3 : Construction et démarrage des conteneurs
```bash
# Construction des images
docker compose --env-file .env.production build

# Lancement des conteneurs en tâche de fond
docker compose --env-file .env.production up -d
```

### Étape 4 : Exécution des migrations Prisma et initialisation
```bash
# Application des migrations réversibles en production
docker compose exec app npx prisma migrate deploy

# Initialisation du référentiel initial (Rôles, Catégories, Workflows)
docker compose exec app npx prisma db seed
```

---

## 4. Vérification Post-Déploiement (Smoke Tests)

Exécuter la grille de validation suivante :
1. **Contrôle de santé HTTP** :
   ```bash
   curl -I http://localhost:80/api/health
   # Réponse attendue : HTTP/1.1 200 OK avec JSON de diagnostic sain
   ```
2. **Vérification de l'étanchéité réseau** :
   Vérifier avec `netstat -tuln` ou `ss -tuln` que seuls les ports 80 et 443 sont ouverts par Caddy, et que PostgreSQL (5432) et ClamAV (3310) ne sont **pas** exposés sur les interfaces de l'hôte.
3. **Accès navigateur utilisateur** :
   - Ouvrir `https://cabinet.lan` depuis un poste connecté au LAN.
   - S'authentifier avec un compte Associé (`partner@cabinet.cm`).
   - Confirmer l'invitation à configurer le 2FA TOTP.

---

## 5. Procédure de Mise à Jour (Zero Downtime / Rollback)

1. **Sauvegarde immédiate avant intervention** :
   ```bash
   bash ops/backup.sh
   ```
2. **Récupération des modifications** :
   ```bash
   git pull origin main
   ```
3. **Reconstruction de la nouvelle image** :
   ```bash
   docker compose build app worker
   ```
4. **Application des migrations et bascule** :
   ```bash
   docker compose exec app npx prisma migrate deploy
   docker compose up -d --no-deps app worker
   ```
5. **Procédure de retour arrière (Rollback)** :
   Si un dysfonctionnement est détecté :
   ```bash
   git checkout <TAG_VERSION_PRECEDENTE>
   docker compose up -d --build app worker
   # Si besoin de rollback base de données, restaurer le dump pris à l'étape 1 via ops/restore_test.sh
   ```

