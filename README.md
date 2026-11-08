# ✠ Guardian Angel

Application web gratuite, installable sur téléphone, pour suivre la messe : **l'ordinaire de la messe** (français / latin), **les lectures du jour**, et des **notes sur l'homélie** synchronisées entre vos appareils.

- **Hébergement** : Firebase Hosting (HTTPS, `https://VOTRE-PROJET.web.app`)
- **Données** : Cloud Firestore (lectures publiques + notes privées), avec cache hors ligne
- **Compte** : facultatif. Sans compte, tout fonctionne et les notes restent sur l'appareil ; avec un compte Google, elles sont synchronisées.
- **Déploiement** : chaque `git push` sur `main` met le site à jour ; chaque pull request reçoit une adresse d'aperçu
- **Coût** : 0 € au départ (plan Spark de Firebase + minutes GitHub Actions gratuites)

> **À venir — source des lectures.** Le texte intégral des lectures sera récupéré automatiquement plus tard (source et méthode de scraping à définir). Pour l'instant, les lectures viennent de fichiers JSON du dossier `data/lectures/` (références et résumés).

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Mise en ligne](#mise-en-ligne)
4. [Ajouter des lectures](#ajouter-des-lectures)
5. [Développement en local](#développement-en-local)
6. [Modèle de données](#modèle-de-données)
7. [Sécurité et vie privée](#sécurité-et-vie-privée)
8. [Dépannage](#dépannage)
9. [Feuille de route](#feuille-de-route)

---

## Fonctionnalités

| | |
|---|---|
| **Ordinaire de la messe** | Signe de croix, acte pénitentiel, Kyrie, Gloria, Credo, préparation des dons, préface, Sanctus, anamnèse, doxologie, Notre Père, paix, Agnus Dei, communion, envoi. Français, latin, ou les deux côte à côte. |
| **Calendrier liturgique** | Calculé dans le navigateur pour n'importe quelle date : temps liturgique, couleur, année A/B/C, semaine I/II, solennités et fêtes (calendrier de la France). Gloria, Credo et Alléluia apparaissent selon le jour. |
| **Lectures du jour** | Référence, introduction, refrain du psaume, résumé — ou texte intégral quand une source sera branchée. Plusieurs messes le même jour : sélecteur. |
| **Notes** | Église, célébrant, notes sur l'homélie, résolution. Enregistrement automatique, même hors ligne. Recherche, copie, export Markdown/JSON, import. |
| **Pendant la messe** | Taille du texte A−/A+, bouton ☀ pour empêcher la mise en veille, accès rapide (Ouverture, Parole, Eucharistie, Envoi, Notes), mode sombre automatique. |
| **Hors ligne** | Service worker (l'appli s'ouvre sans réseau) + cache Firestore. |
| **Vie privée** | Pas de publicité ni de mesure d'audience ; export des notes ; suppression du compte en un clic ; page `/confidentialite`. |
| **Liens** | `…/#/2026-12-25` ouvre un jour précis, `…/#/notes` ouvre les notes. |

## Architecture

```
  data/lectures/*.json ──push──▶ Action « Import des lectures » ──Admin SDK──▶ Firestore  jours/{date}   (lecture publique)
                                                                                         users/{uid}/notes/{date}  (privé)
  public/ ──push──▶ Action « Déploiement Firebase » ──▶ Firebase Hosting ──▶ navigateur ─┘
                                                                            (compte Google facultatif)
  À venir : une tâche planifiée de scraping écrira dans data/lectures/ ou directement dans jours/{date}.
```

```
guardian-angel/
├── public/                    # le site (aucune étape de build)
│   ├── index.html
│   ├── style.css
│   ├── app.js                 # interface, Firebase, notes, compte
│   ├── liturgie.js            # calcul du calendrier liturgique (testé)
│   ├── ordinaire.js           # textes de l'ordinaire FR + latin
│   ├── confidentialite.html   # confidentialité et mentions légales
│   ├── firebase-config.js     # config pour le développement hors Hosting
│   ├── sw.js                  # service worker (hors ligne)
│   ├── manifest.webmanifest   # installation sur l'écran d'accueil
│   └── icons/
├── data/lectures/             # un fichier JSON par jour
├── scripts/
│   ├── import-lectures.mjs    # data/lectures → Firestore
│   └── lectures-schema.mjs    # format attendu des fichiers (testé)
├── tests/
│   ├── liturgie.test.mjs      # calendrier (Pâques, Avent, préséances…)
│   ├── data.test.mjs          # validité des fichiers de lectures
│   └── rules.spec.mjs         # règles Firestore (émulateur)
├── .github/workflows/
│   ├── ci.yml                 # tests à chaque push / PR
│   ├── deploy.yml             # déploiement Hosting + règles sur main
│   ├── preview.yml            # adresse d'aperçu pour chaque PR
│   └── import-lectures.yml    # import des lectures dans Firestore
├── firebase.json              # Hosting, en-têtes de sécurité, émulateurs
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc
└── package.json
```

## Mise en ligne

Le guide pas à pas (clic par clic) est dans le document « Guardian Angel — mise en ligne pas à pas ». Résumé :

1. **Firebase** ([console.firebase.google.com](https://console.firebase.google.com)) : créer le projet, enregistrer une application Web (cocher Hosting), activer la connexion **Google** dans Authentication, créer la base **Firestore** en Europe (mode production).
2. **Google Cloud** : créer un compte de service `github-actions` avec les rôles *Administrateur Firebase*, *Utilisateur du compte de service* et *Lecteur de clés API* ; créer une clé JSON ; vérifier que les API *Firebase Hosting*, *Firebase Rules*, *Cloud Firestore* et *Firebase Management* sont activées.
3. **GitHub** → *Settings → Secrets and variables → Actions* :
   - secret **`FIREBASE_SERVICE_ACCOUNT`** = contenu complet du fichier JSON ;
   - variable **`FIREBASE_PROJECT_ID`** = ID du projet Firebase.
4. **Actions → Déploiement Firebase → Run workflow**, puis **Actions → Import des lectures → Run workflow**.
5. Ouvrir `https://VOTRE-PROJET.web.app`.

Projet Firebase : `guardian-angel-62a43` (déjà renseigné dans `.firebaserc` et `public/firebase-config.js`).

## Ajouter des lectures

Un jour = un fichier `data/lectures/AAAA-MM-JJ.json` :

```json
{
  "date": "2026-11-15",
  "titre": "33e dimanche du temps ordinaire",
  "saint": "Journée mondiale des pauvres",
  "lectures": [
    { "type": "lecture1", "ref": "Pr 31, 10-13.19-20.30-31", "intro": "Lecture du livre des Proverbes", "resume": "…" },
    { "type": "psaume", "ref": "Ps 127 (128)", "refrain": "Heureux qui craint le Seigneur !" },
    { "type": "lecture2", "ref": "1 Th 5, 1-6", "resume": "…" },
    { "type": "evangile", "ref": "Mt 25, 14-30", "intro": "Évangile de Jésus Christ selon saint Matthieu", "resume": "…" }
  ]
}
```

- Champs du jour, tous facultatifs sauf `date` et `lectures` : `titre`, `sousTitre`, `saint`, `rang` (`solennite`, `fete`, `memoire`, `dimanche`, `ferie`, `defunts`), `couleur` (`vert`, `violet`, `rose`, `blanc`, `rouge`, `noir`), `remarque`. Ils remplacent le calcul automatique du calendrier.
- Types de lecture : `lecture1`…`lecture7`, `psaume`…`psaume7`, `sequence`, `acclamation`, `evangile`, `entree`.
- Champs d'une lecture : `ref`, `intro`, `resume`, `refrain`, et `contenu` (texte intégral en HTML simple, pour plus tard).
- Plusieurs messes le même jour : remplacer `lectures` par `"messes": [{ "nom": "Messe de la nuit", "lectures": [...] }, …]`.

Dès que le fichier est poussé sur `main` (y compris en l'éditant directement sur GitHub), l'Action **Import des lectures** le vérifie et l'écrit dans Firestore. Les tests refusent un fichier mal formé.

## Développement en local

```bash
npm install
npm run emulators          # Hosting :5000, Firestore :8080, Auth :9099, interface :4000
npm run seed:emulator      # (autre terminal) importe data/lectures dans l'émulateur
```

Ouvrez http://localhost:5000 : sur `localhost`, l'application utilise automatiquement les émulateurs.

```bash
npm test                   # calendrier liturgique + fichiers de lectures
npm run test:rules         # règles Firestore (lance l'émulateur ; Java requis)
npm run check:lectures     # vérifie data/lectures sans rien écrire
```

Sans Firebase, `npx serve public` suffit : calendrier, ordinaire et notes locales fonctionnent.

## Modèle de données

**`jours/{AAAA-MM-JJ}`** — lecture publique, écriture réservée à l'import : le contenu d'un fichier `data/lectures/…json`, plus `source` et `importedAt`.

**`users/{uid}/notes/{AAAA-MM-JJ}`** — privé :

```json
{ "date": "2026-11-08", "titreJour": "…", "eglise": "…", "celebrant": "…", "homelie": "…", "perso": "…", "updatedAt": "<horodatage>" }
```

## Sécurité et vie privée

- **Règles Firestore** : les lectures sont lisibles par tous et modifiables par personne depuis le site ; chaque utilisateur connecté ne lit et n'écrit que ses propres notes, dont le format et la taille sont contrôlés ; tout le reste est fermé. Testées par `tests/rules.spec.mjs`.
- **La configuration Web Firebase n'est pas secrète.** Le seul secret est la clé du compte de service, stockée dans GitHub Secrets et jamais dans le dépôt (`.gitignore` bloque les fichiers de clé).
- **En-têtes HTTP** (`firebase.json`) : Content-Security-Policy stricte, `nosniff`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`.
- **Le HTML des lectures** est filtré avant affichage (balises de texte seulement, `<script>` supprimé).
- **RGPD** : page `/confidentialite`, export des notes, suppression du compte et des notes depuis l'onglet *Mes notes*.
- Recommandé avant une large diffusion : activer **App Check** (reCAPTCHA Enterprise) et une **alerte de budget** dans Google Cloud ; passer au plan Blaze si l'usage dépasse les quotas gratuits (50 000 lectures Firestore par jour).

## Dépannage

| Symptôme | Cause / solution |
|---|---|
| Le déploiement échoue : `Failed to authenticate` | Secret `FIREBASE_SERVICE_ACCOUNT` absent, mal nommé ou JSON incomplet. |
| Le déploiement échoue : `PERMISSION_DENIED` / `403` | Rôle manquant sur le compte de service, ou API désactivée : suivre le lien du journal → *Activer*. |
| `Invalid project id` | La variable `FIREBASE_PROJECT_ID` ne contient pas exactement l'ID du projet. |
| L'import échoue : « Fichiers invalides » | Le journal indique le fichier et le champ fautif ; corrigez-le et poussez à nouveau. |
| `auth/unauthorized-domain` | Authentication → Paramètres → Domaines autorisés → ajouter le domaine du site. |
| « Lecture pas encore disponible » | Aucun fichier `data/lectures/` pour ce jour (ou import pas encore lancé). |
| Une modification n'apparaît pas | Rechargez deux fois (cache hors ligne). Pour forcer, changez `VERSION` dans `public/sw.js`. |

## Feuille de route

- [ ] **Source des lectures** : récupération automatique du texte intégral (scraping), source à définir
- [ ] Prières propres du jour (collecte, prière sur les offrandes, après la communion)
- [ ] Préfaces et prières eucharistiques au choix
- [ ] Rappel de la messe du dimanche (notifications)
- [ ] Étiquettes et recherche par livre biblique dans les notes
- [ ] Publication Google Play (application Android autour du site)

## Licence

Code sous licence MIT (voir `LICENSE`).
