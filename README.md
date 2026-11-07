# Agent Office Tycoon

**Un simulateur rétro 2D d'agence de développement, en vue « God Game », qui donne vie à une équipe d'agents IA.**

Entrez dans un bureau virtuel et observez le Manager, le Product Owner, les développeurs back-end et front-end et la QA faire avancer un projet — ou prendre une pause bien méritée.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Phaser](https://img.shields.io/badge/Phaser-3-7C3AED)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

> **État du projet : prototype.** Les personnages et le cycle de travail sont simulés localement. Le dialogue du Manager utilise une réponse prédéfinie : le message saisi ne pilote pas encore de véritables agents IA.

## À quoi ça sert ?

- **Visualiser le développement autrement** : suivez un cycle animé, de la demande du Manager aux tests de la QA.
- **Jouer au God Game** : parlez au Manager en langage naturel, confirmez votre demande et lancez la simulation ; les autres agents affichent leur rôle et leur statut au clic.
- **Observer la vie du bureau** : les agents disponibles se déplacent et prennent des pauses café ou ping-pong avant de revenir à leur poste.
- **Préparer de futures intégrations** : l'architecture sépare l'interface et la scène pour faciliter, à terme, la connexion à un orchestrateur externe via WebSockets, par exemple avec des webhooks n8n ou GitHub Projects.

Les connexions à un LLM, aux WebSockets et aux services externes ne sont **pas encore implémentées**.

## Stack technique

| Domaine | Technologies |
| --- | --- |
| Interface et outillage | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Moteur 2D | Phaser 3, sprites pixel-art procéduraux et pack Interiors |
| Déplacements | EasyStar.js, grille de collision et pathfinding |
| Conteneurisation | Docker, Docker Compose, Nginx non-root |
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

Commandes utiles :

```bash
npm run lint                         # Vérification du code
node --test tests/officeLayout.test.mjs  # Tests de grille et de pathfinding
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

L'image est construite en deux étapes : Node.js compile l'application, puis Nginx sert les fichiers statiques en utilisateur non-root. Compose utilise un système de fichiers en lecture seule et un espace temporaire en mémoire. Le fallback SPA et le cache des assets versionnés sont configurés dans [docker/nginx.conf](docker/nginx.conf).

Les variables `VITE_*` sont intégrées **au build**, pas au démarrage du conteneur. Les fichiers `.env*` sont exclus du contexte Docker ; configurez explicitement le build si nécessaire et n'y placez aucun secret destiné à rester privé. Pour un déploiement public, configurez HTTPS et HSTS sur le proxy ou la plateforme.

## Architecture

```text
  Joueur
    │
    ▼
  Interface React (HUD, dialogue, état)
    ⇄ événements typés / méthode de scène
  Canvas Phaser (bureau, agents, animations, EasyStar)
    ⋯
  Relais WebSockets / n8n / GitHub Projects  [à venir]
```

React gère l'interface et le cycle de vie du jeu ; Phaser gère le rendu et les déplacements. La scène utilise une grille orthogonale de 32 × 32 pixels et évite les murs et meubles fixes ; les agents peuvent toutefois partager une tuile.

La simulation s'exécute dans le navigateur, sans relais ni orchestrateur. Le futur relais est représenté en pointillés pour distinguer cette cible de l'architecture actuelle.

### Intégration continue

Le workflow [CI](.github/workflows/ci-cd.yml) lance installation stricte, lint, tests et build sur les pull requests et pushes vers `develop` et `master`. Après un push validé, il crée un tag `develop-<sha>` ou `master-<sha>` avec les 12 premiers caractères du commit. Les permissions du dépôt et ses éventuelles règles de protection doivent autoriser `GITHUB_TOKEN` à créer ces tags.

## Roadmap

- [ ] Connecter la simulation à un relais WebSockets et à des orchestrateurs externes, dont n8n.
- [ ] Intégrer l'API GitHub et GitHub Projects pour suivre des tâches réelles.
- [ ] Brancher de véritables agents multi-rôles pilotés par des LLM.
- [ ] Enrichir les assets et animations du bureau.
