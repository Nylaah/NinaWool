# NinaWool

Site de commandes de peluches au crochet : vitrine publique + atelier privé, installable comme une application (PWA) sur Android, iOS, Windows, Mac et Linux.

- **Frontend** : Vite + React + TypeScript + Tailwind CSS, routage `HashRouter`
- **Backend** : Supabase (Postgres, Auth, Storage)
- **Hébergement** : GitHub Pages, déployé automatiquement à chaque push sur `main`
- **Paiement** : uniquement à la livraison. Aucun paiement en ligne, aucune intégration bancaire.

## Ce que fait le site

**Côté clients**

| Page | Contenu |
| --- | --- |
| Accueil | Présentation, étapes, dernières réalisations, fourchettes de prix indicatives |
| Galerie | Réalisations publiées (photos, taille, prix payé, temps si tu l'affiches), filtres taille et prix |
| Faire une demande | Formulaire complet, image de référence (5 Mo max), prix libre, supplément prioritaire, code de suivi `NW-XXXXX` |
| Suivi | Statut, position dans la file et date de la demande à partir du code |

**Côté atelier** (`/#/admin`, un seul compte)

| Page | Contenu |
| --- | --- |
| Demandes | Section Prioritaires, file d'attente en glisser-déposer, vue liste (recherche, filtre), vue kanban, export CSV |
| Fiche demande | Infos client, image de référence, changement de statut, notes privées, prix final, historique, messages types par email |
| Chronomètre | Démarrer / Pause / Arrêter, widget flottant sur toutes les pages, sessions modifiables, ajout manuel de temps |
| Dépenses | Achats de laine et fournitures, photo du ticket, lien avec un projet, totaux par mois, export CSV |
| Galerie | Réalisations avec photos, brouillon / publiée, pré-remplissage depuis une commande terminée |
| Rentabilité | Encaissé, dépenses, bénéfice, taux horaire réel, détail par mois et par projet |
| Réglages | Ouvrir / fermer les commandes, fourchettes de prix, limite anti-spam, taux horaire visé |

## Mise en route (une seule fois)

### 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor → New query** : colle tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) et clique sur **Run**. Le script crée les tables, les règles de sécurité, les fonctions et les trois espaces de stockage. Il peut être relancé sans risque.
3. **Authentication → Users → Add user** : crée ton compte (email + mot de passe, coche « Auto Confirm User »).
4. **Authentication → Sign In / Providers** : désactive « Allow new users to sign up ». Personne d'autre ne doit pouvoir créer de compte.
5. Retourne dans **SQL Editor** et déclare ton compte comme admin (remplace l'email) :

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'ton-email@exemple.com';
   ```

6. **Project Settings → API** : note la **Project URL** et la clé **anon public**.

> La clé `service_role` ne doit jamais apparaître dans ce dépôt ni dans les secrets du site : le site n'en a pas besoin.

### 2. GitHub

1. Crée un dépôt nommé `NinaWool` et pousse ce code sur la branche `main`.
2. **Settings → Secrets and variables → Actions → New repository secret**, deux fois :
   - `VITE_SUPABASE_URL` : la Project URL
   - `VITE_SUPABASE_ANON_KEY` : la clé anon public
3. **Settings → Pages → Build and deployment → Source** : choisis **GitHub Actions**.
4. Le prochain push sur `main` (ou **Actions → Déployer sur GitHub Pages → Run workflow**) publie le site sur `https://<ton-pseudo>.github.io/NinaWool/`.

### 3. Installer l'application

- **Android / Windows / Mac / Linux (Chrome, Edge)** : bouton « Installer l'app » en bas du site, ou l'icône d'installation dans la barre d'adresse.
- **iPhone / iPad (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

## Développement local

```bash
npm install
```

```bash
cp .env.example .env.local
```

Renseigne les deux variables dans `.env.local`, puis :

```bash
npm run dev
```

`npm run build` vérifie les types et produit le site dans `dist/`.

## Comment ça marche

### File d'attente et option prioritaire

Une demande entre dans la file quand elle est **acceptée** et en sort quand elle est **terminée**. L'ordre automatique est : plus gros supplément d'abord, puis demande la plus ancienne. Tu peux réordonner à la main en faisant glisser la poignée ; tant que l'ordre manuel est actif, les nouvelles demandes acceptées se placent à la fin. Le bouton « Revenir à l'ordre automatique » efface l'ordre manuel. La position vue par le client sur la page de suivi suit exactement le même ordre.

### Chronomètre

Chaque session est une ligne en base (`started_at`, `ended_at`). Le temps affiché est calculé à partir de `started_at` : le chrono continue si tu fermes l'application ou changes d'appareil. La base interdit d'avoir deux chronos actifs ; démarrer un projet arrête automatiquement le précédent. Démarrer le chrono sur une demande « acceptée » la passe « en cours ».

### Sécurité

- Toutes les tables ont la sécurité au niveau des lignes (RLS) activée. Seul le compte listé dans `admins` peut lire ou écrire.
- Les clients ne touchent jamais aux tables : ils passent par trois fonctions (`submit_request`, `get_request_status`, `get_public_settings`). `get_request_status(code)` ne renvoie que le statut, la position, le sujet, la taille et les dates de la demande correspondant au code : jamais d'email, de nom ni de notes, et rien sur les autres demandes.
- Anti-spam : champ piège invisible (honeypot), limite de demandes par email sur 24 h (réglable, 3 par défaut) et plafond global de 40 demandes par heure, le tout vérifié dans Postgres.
- Images de référence et tickets : espaces de stockage privés. Les clients peuvent déposer une image de référence mais ni lire ni lister. Seules les photos de la galerie sont publiques.

## Structure

```
supabase/schema.sql        Base de données complète (tables, RLS, fonctions, stockage)
src/lib/                   Client Supabase, accès aux données, types, formatage
src/components/            Mise en page, widget chrono, composants partagés
src/pages/                 Pages publiques
src/pages/admin/           Pages de l'atelier
.github/workflows/         Déploiement GitHub Pages
scripts/make-icons.cjs     Régénère les icônes de l'application à partir de public/favicon.svg
```
