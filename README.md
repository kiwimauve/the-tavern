# The Tavern — site d'outils D&D 2024 (v1.1.0)

Site statique, avec des comptes optionnels (nom d'usager + mot de passe) gérés par Firebase.

```
index.html                       page d'accueil + panneau de compte
account.js                       comptes : connexion, code de récupération, synchronisation des outils
firebase-config.js               TES paramètres Firebase (à remplir, étape B4)
firestore.rules                  règles de sécurité à coller dans Firebase (étape B3)
404.html, .nojekyll              pages et réglage pour GitHub Pages
tools/character-sheet/index.html fiche personnage (v1.14.0)
tools/combat-tracker/index.html  DM Combat Tracker (v1.7.0)
```

Tant que `firebase-config.js` est vide, le site marche comme avant : tout est sauvegardé dans le navigateur et le panneau de compte n'apparaît pas.

---

## A. Mettre le site en ligne (GitHub Pages)

1. Sur github.com, clique **New repository**, nomme-le `the-tavern`, coche **Public**, puis **Create repository**.
2. Clique **uploading an existing file** et glisse **le contenu** du dossier `site` (tous les fichiers et le dossier `tools`). Clique **Commit changes**.
   - Si `.nojekyll` n'apparaît pas, active « Éléments masqués » dans l'Explorateur Windows (menu Affichage).
3. **Settings → Pages** : sous **Branch**, choisis `main` et `/ (root)`, puis **Save**.
4. Après une ou deux minutes, le site est à `https://TON-NOM.github.io/the-tavern/`.

## B. Activer les comptes (Firebase, gratuit, environ 10 minutes)

### B1. Créer le projet
1. Va sur **console.firebase.google.com** et connecte-toi avec ton compte Google.
2. **Créer un projet** (Create a project). Nom : `the-tavern`.
3. Quand on te propose **Google Analytics**, désactive-le (moins de données collectées). Clique **Créer le projet**.
4. Reste sur le plan gratuit **Spark** : aucune carte de crédit n'est demandée.

### B2. Activer la connexion par mot de passe
1. Menu de gauche : **Build → Authentication**, puis **Get started**.
2. Onglet **Sign-in method** : choisis **Email/Password**.
3. Active **seulement le premier interrupteur** (Email/Password). Laisse « Email link (passwordless sign-in) » désactivé. Clique **Save**.

Personne n'entre de courriel : le site transforme le nom d'usager en adresse interne (`nom@players.tavern.local`) qui ne reçoit jamais rien.

### B3. Créer la base de données et coller les règles
1. Menu de gauche : **Build → Firestore Database**, puis **Create database**.
2. Emplacement : choisis **northamerica-northeast1 (Montréal)** pour garder les données au Canada. On ne peut plus le changer après.
3. Choisis **Start in production mode**, puis **Create**.
4. Onglet **Rules** : efface tout, colle le contenu complet de `firestore.rules`, puis clique **Publish**.

Les règles garantissent que chaque personne ne peut lire et modifier que ses propres données.

### B4. Brancher le site sur Firebase
1. Clique la roue dentée en haut à gauche → **Project settings**.
2. Section **Your apps** : clique l'icône web **`</>`**. Surnom : `the-tavern`. Ne coche pas Firebase Hosting. Clique **Register app**.
3. Firebase affiche un bloc `firebaseConfig` avec `apiKey`, `authDomain`, `projectId`, etc.
4. Ouvre `firebase-config.js` avec le Bloc-notes et copie chaque valeur entre les guillemets correspondants. Enregistre.
5. Sur GitHub, remplace `firebase-config.js` par ta version (dans le dépôt : clique le fichier → crayon ✏️, ou glisse le nouveau fichier avec **Add file → Upload files**).

Ces valeurs sont faites pour être publiques : ce sont les règles de l'étape B3 qui protègent les données.

### B5. Autoriser l'adresse de ton site
1. **Authentication → Settings → Authorized domains**.
2. **Add domain** : `TON-NOM.github.io` (sans `https://` ni `/the-tavern`).

### B6. Tester
Ouvre ton site, clique **Create an account**, crée un compte, puis ouvre la fiche. L'étiquette en haut doit passer à **Synced**. Si un message d'erreur affiche un code entre parenthèses, note-le.

---

## Comment marchent les comptes

- **Inscription** : un nom d'usager (3 à 20 caractères) et un mot de passe (6 caractères minimum). Pas de courriel, pas de vrai nom.
- **Code de récupération** : à l'inscription, le site affiche un code comme `K7MR-2QXD-9PHT-WB4N`. On le copie ou on le télécharge. Avec ce code, on choisit un nouveau mot de passe dans **I forgot my password**.
- **Si la personne perd son mot de passe ET son code**, personne ne peut récupérer le compte, pas même toi. C'est le prix d'un système sans courriel. Elle crée un nouveau compte ; ce qui est encore dans son navigateur y sera transféré.
- **Account settings** : se déconnecter, changer de mot de passe, obtenir un nouveau code, supprimer son compte et toutes ses données.
- **Sécurité** : le mot de passe n'est jamais envoyé à Firebase. Il sert, dans le navigateur, à déverrouiller une clé aléatoire qui, elle, ouvre le compte. Un mot de passe « simple » protège bien des fiches de D&D, mais il ne faut pas réutiliser celui d'un autre compte.
- **Ordinateur partagé** : se déconnecter efface les fiches et rencontres de ce navigateur (elles restent dans le compte). Les personnages d'un autre compte ne sont jamais copiés dans le tien.
- **Sans compte**, tout marche comme avant, sauvegardé dans le navigateur. Au premier compte créé sur ce navigateur, ces personnages y sont transférés.

## Ce que tu peux voir comme administrateur

Dans **Authentication → Users**, tu vois les noms d'usager (sous la forme `nom@players.tavern.local`) et leurs dates de connexion. Dans **Firestore**, tu vois les données, mais les mots de passe et codes n'y sont que sous forme chiffrée. Pour supprimer un compte abandonné : supprime l'utilisateur dans Authentication, son document dans `logins`, et ses dossiers dans `tools`.

## Ajouter un outil

1. Crée `tools/nom-de-l-outil/index.html`.
2. Ajoute une entrée dans la liste `TOOLS` de `index.html` (à la racine).
3. Pour qu'il utilise les comptes : mets dans son `<head>` les deux lignes
   `<script src="../../firebase-config.js"></script>` et `<script src="../../account.js"></script>`,
   et ajoute le nom de son dossier dans `TOOL_IDS` au début de `account.js` (pour que « Delete my account » efface aussi ses données).
4. Pour mettre à jour un outil : remplace son `index.html`, garde ces deux lignes dans son `<head>`, et change sa version dans `TOOLS`.
