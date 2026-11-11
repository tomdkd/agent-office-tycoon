# Agent Office Tycoon

**Un simulateur rétro 2D d'agence de développement, en vue « God Game », qui donne vie à une équipe d'agents IA.**

Entrez dans un bureau virtuel et observez le Manager, le Product Owner, les développeurs back-end et front-end et la QA faire avancer un projet — ou prendre une pause bien méritée.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Phaser](https://img.shields.io/badge/Phaser-3-7C3AED)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

> **État du projet : prototype.** Les personnages et le cycle de travail sont simulés localement ou pilotés par des événements externes. Le chat du Manager peut être connecté à un webhook n8n ; il ne lance pas lui-même le cycle local.

## À quoi ça sert ?

- **Visualiser le développement autrement** : suivez un cycle animé, de la demande du Manager aux tests de la QA.
- **Jouer au God Game** : parlez au Manager en langage naturel ou lancez une simulation locale ; les autres agents affichent leur rôle et leur statut au clic.
- **Observer la vie du bureau** : les agents disponibles se déplacent et prennent des pauses café ou ping-pong avant de revenir à leur poste.
- **Recevoir des actions externes** : un relais HTTP/WebSocket diffuse des événements aux navigateurs, par exemple depuis n8n.

Une éventuelle connexion à un LLM relève du workflow n8n ; l'intégration à GitHub n'est **pas encore implémentée**.

## Stack technique

| Domaine | Technologies |
| --- | --- |
| Interface et outillage | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Moteur 2D | Phaser 3, sprites pixel-art procéduraux et pack Interiors |
| Déplacements | EasyStar.js, grille de collision et pathfinding |
| Serveur et conteneurisation | Node.js, Express, WebSocket, Docker non-root |
| Qualité et CI | ESLint, tests Node.js, GitHub Actions |

## Installation et démarrage rapide

### Option A — Local / développement

**Prérequis :** Node.js 20.19+ ou 22.13+, et npm. Node.js 24 est recommandé : c'est la version utilisée par la CI et le build Docker. Pour les tests de grille, utilisez Node.js 22.18+.

Depuis le dossier du projet :

```bash
npm install
npm run dev
```

Ouvrez l'adresse affichée par Vite, généralement [http://localhost:5173](http://localhost:5173).
Pour activer le relais en développement, lancez `npm start` dans un second terminal. Vite transmet `/api` et `/ws` au serveur local sur le port 8080. Sans serveur, le jeu continue en mode hors-ligne. Pour servir également l'interface depuis Node, lancez d'abord `npm run build`, puis `npm start`.

### Chat du Manager

Définissez `VITE_MANAGER_WEBHOOK_URL` dans un fichier `.env.local` à la racine, puis redémarrez Vite. Le navigateur envoie directement au webhook une requête JSON `POST` contenant `{"sessionId":"...","message":"..."}` et attend une réponse JSON `{"response":"..."}`. Configurez CORS sur le webhook pour autoriser l'origine de l'application, les requêtes `POST` et l'en-tête `Content-Type`. Le webhook doit répondre en 3 minutes. Après 12 secondes d'attente, le chat affiche un statut de création d'issue ; ce statut est basé sur le temps écoulé et ne confirme pas l'avancement réel du workflow.

La conversation et son identifiant restent en mémoire pendant que l'application est ouverte, même si le panneau est fermé. « Nouvelle session » annule toute requête en cours et efface l'historique local ; le prochain message utilise un nouvel identifiant. Le cycle de simulation reste indépendant du chat.

L'URL est intégrée au code client et visible par tous les utilisateurs : ne l'utilisez pas comme secret et ne placez pas de jeton privé dans une variable `VITE_*`. Protégez le webhook et les données de conversation selon votre contexte de déploiement.

Commandes utiles :

```bash
npm run lint                         # Vérification du code
npm test                             # Tests de grille, pathfinding et relais
npm run build                        # Compilation TypeScript et build de production
npm run preview                      # Prévisualisation du dernier build
```

### Option B — Docker

**Prérequis :** Docker et Docker Compose.

```bash
docker compose up -d --build
```

Ouvrez [http://localhost:8080](http://localhost:8080). Pour arrêter et retirer le service :

```bash
docker compose down
```

L'image est construite en deux étapes : Node.js compile l'application, puis un serveur Node.js non-root sert les fichiers et le relais. Compose utilise un système de fichiers en lecture seule et n'expose le port qu'à `127.0.0.1`.

Par défaut, le navigateur se connecte à `/ws` sur l'origine de la page. Pour un relais distinct, définissez `VITE_WS_URL` (par exemple `wss://relay.example/ws`) lors du build Vite, ou lancez `VITE_WS_URL=wss://relay.example/ws docker compose up -d --build`. Les variables `VITE_*` sont intégrées **au build**, pas au démarrage du conteneur. Les fichiers `.env*` sont exclus du contexte Docker ; ne placez aucun secret dans les variables Vite.

Pour le chat en Docker, définissez également `VITE_MANAGER_WEBHOOK_URL` dans l'environnement de Compose avant `docker compose up -d --build`. Compose transmet cette valeur comme argument de build.

**Sécurité :** le relais ne dispose d'aucune authentification. La liaison à localhost limite son exposition réseau, mais ne protège pas contre des logiciels ou pages web malveillants sur la machine. Ne l'exposez pas publiquement sans authentification, contrôle d'origine et HTTPS adaptés.

### API du relais

`GET /api/health` renvoie `{"status":"ok"}`. Envoyez une action avec :

```bash
curl -X POST http://localhost:8080/api/events \
  -H 'Content-Type: application/json' \
  -d '{"type":"agent-action","role":"qa","action":"test"}'
```

Les rôles acceptés sont `manager`, `po`, `dev_back`, `dev_front` et `qa` ; les actions sont `work`, `test`, `talk` et `break`. Aucun champ supplémentaire n'est accepté. Le serveur répond `202` après diffusion, même sans client connecté ; les événements ne sont ni stockés ni rejoués. Chaque action interrompt un cycle local en cours et remplace l'action précédente du même agent ; les actions d'agents différents peuvent coexister. L'agent rejoint son bureau (ou le café pour `break`), reste dans son état quatre secondes puis reprend sa vie autonome. Un cycle local lancé ensuite interrompt les actions externes. La reconnexion est automatique ; hors connexion, la simulation locale continue.

## Architecture

```text
  Joueur
    │
    ▼
  Interface React (HUD, dialogue, état)
    ⇄ événements typés / méthode de scène
  Canvas Phaser (bureau, agents, animations, EasyStar)
    ⇄ WebSocket /ws
  Relais Node.js ← POST /api/events ← orchestrateur (ex. n8n)
```

React gère l'interface et le cycle de vie du jeu ; Phaser gère le rendu et les déplacements. La scène utilise une grille orthogonale de 32 × 32 pixels et évite les murs et meubles fixes ; les agents peuvent toutefois partager une tuile.

La simulation locale fonctionne sans relais ni orchestrateur ; le relais permet de lui transmettre des actions en direct.

L'interface utilise les polices pixel Press Start 2P et VT323 chargées depuis Google Fonts ; sans accès réseau, une police monospace locale prend le relais.

### Intégration continue

Le workflow [CI](.github/workflows/ci-cd.yml) lance installation stricte, lint, tests et build sur les pull requests et pushes vers `develop` et `master`. Après un push validé, il crée un tag `develop-<sha>` ou `master-<sha>` avec les 12 premiers caractères du commit. Les permissions du dépôt et ses éventuelles règles de protection doivent autoriser `GITHUB_TOKEN` à créer ces tags.

## Roadmap

- [x] Recevoir des actions via un relais WebSocket.
- [x] Connecter le chat du Manager à un webhook n8n.
- [ ] Intégrer l'API GitHub et GitHub Projects pour suivre des tâches réelles.
- [ ] Brancher de véritables agents multi-rôles pilotés par des LLM.
- [ ] Enrichir les assets et animations du bureau.
