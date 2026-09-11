# 📖 Wiki d'Installation & Déploiement — Quantura Trading Bot

Guide complet étape par étape pour installer, configurer et exécuter le robot de trading **Quantura** sur un serveur privé virtuel (VPS) Ubuntu/Debian afin de garantir un fonctionnement continu (24h/24 et 7j/7).

---

## 📋 1. Prérequis Système (Checklist)

Avant de commencer, vérifiez que votre VPS dispose des éléments suivants :

- [ ] **Système d'exploitation :** Ubuntu 22.04 LTS ou Ubuntu 24.04 LTS (recommandé).
- [ ] **Ressources matérielles minimales :**
  - Processeur : 1 vCPU
  - Mémoire vive (RAM) : 1 Go à 2 Go minimum
  - Espace disque : 10 Go SSD minimum
- [ ] **Droits d'accès :** Accès `root` ou utilisateur disposant des privilèges `sudo`.
- [ ] **Ports réseau ouverts :**
  - Port `22` (Accès SSH)
  - Port `3000` (Interface Web du Bot)

---

## 🚀 2. Procédure d'Installation Pas à Pas

### Étape 1 : Mise à jour du système et installation des paquets essentiels
Installez les outils de compilation C++ et les utilitaires nécessaires (obligatoires pour les modules natifs comme `better-sqlite3`) :

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git curl unzip

Étape 2 : Installation de Node.js (Version 22 LTS)
Les dépendances récentes du bot exigent Node.js v22 ou supérieur :

# Ajout du dépôt officiel NodeSource pour Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Installation de Node.js et npm
sudo apt install -y nodejs

# Vérification des versions installées
node -v
npm -v

Étape 3 : Installation du gestionnaire de processus PM2
PM2 permet de maintenir l'application active en arrière-plan en continu et de la relancer automatiquement en cas d'incident :

sudo npm install -g pm2

Étape 4 : Clonage du projet depuis GitHub

# Se placer dans le répertoire racine de l'utilisateur
cd ~

# Cloner le dépôt GitHub dans un dossier nommé 'bot'
git clone https://github.com/jaouad555/Quantura-bot-trading-.git bot

# Entrer dans le répertoire du projet
cd bot

Étape 5 : Installation des dépendances et compilation (Build)

# Installation des bibliothèques JavaScript/TypeScript
npm install

# Compilation optimisée pour l'environnement de production
npm run build

Étape 6 : Démarrage du Bot avec PM2

# Démarrer le bot sous la gestion de PM2
pm2 start npm --name "quantura-bot" -- start

# Vérifier l'état d'exécution (le statut doit afficher 'online' en vert)
pm2 status

Étape 7 : Configuration du redémarrage automatique après un reboot

# Sauvegarder la liste des processus actuels dans PM2
pm2 save

# Générer le script de démarrage automatique au boot
pm2 startup

Étape 8 : Sécurisation du pare-feu (UFW Firewall)

# Autoriser les ports essentiels
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp

# Activer le pare-feu
sudo ufw enable

🌐 3. Accès au Tableau de Bord

http://<VOTRE_IP_VPS>:3000
Remplacez <VOTRE_IP_VPS> par l'adresse IP publique de votre serveur).

🛠️ 4. Commandes Utiles pour la Maintenance
Commande	Description
pm2 logs quantura-bot	Affiche les logs et transactions en direct (Quitter avec Ctrl + C)
pm2 status	Vérifie la consommation RAM/CPU et l'état du bot
pm2 restart quantura-bot	Redémarre le bot (utile après modification de configuration)
pm2 stop quantura-bot	Arrête temporairement l'exécution du bot
pm2 delete quantura-bot	Supprime le processus de la liste PM2

🔄 5. Mettre à Jour le Bot (Futures Mises à Jour)
Si vous publiez de nouvelles modifications sur votre dépôt GitHub :

cd ~/bot
git pull origin main
npm install
npm run build
pm2 restart quantura-bot

🚨 6. Dépannage & Erreurs Courantes (FAQ)
❓ Erreur 1 : Could not get lock /var/lib/dpkg/lock-frontend
Cause : Une mise à jour automatique en arrière-plan d'Ubuntu bloque apt.
Solution :
sudo killall apt apt-get
sudo rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock*
sudo dpkg --configure -a

❓ Erreur 2 : not found: make lors du npm install
Cause : Les outils de compilation natifs manquent sur votre système.
Solution :

sudo apt install -y build-essential
Erreur 3 : L'interface sur le port 3000 ne s'ouvre pas
Solutions :
Vérifiez le pare-feu local : sudo ufw allow 3000/tcp.
Si votre VPS est chez un hébergeur comme AWS, Oracle Cloud ou Google Cloud, assurez-vous d'ouvrir le port 3000 dans les règles de sécurité externes (Security Groups / Ingress Rules).
