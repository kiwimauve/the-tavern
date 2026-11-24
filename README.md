# The Tavern — site d'outils D&D 2024 (v1.3.0)

Site statique, avec des comptes optionnels (nom d'usager + mot de passe) gérés par Firebase.

```
index.html                       page d'accueil + panneau de compte
account.js                       comptes : connexion, code de récupération, synchronisation des outils
feedback.js                      bouton « Feedback » et fenêtre de commentaires (avec capture d'écran), sur toutes les pages
admin/index.html                 page propriétaire : statistiques et messages (réservée à ton compte)
firebase-config.js               TES paramètres Firebase (à remplir, étape B4)
firestore.rules                  règles de sécurité à coller dans Firebase (étape B3)
404.html, .nojekyll              pages et réglage pour GitHub Pages
tools/character-sheet/index.html fiche personnage (v1.16.0)
tools/combat-tracker/index.html  DM Combat Tracker (v1.9.0)
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

## Page propriétaire : messages et statistiques

Adresse : `https://kiwimauve.github.io/the-tavern/admin/`. Quand tu es connecté avec ton compte propriétaire, un bouton **Owner page** apparaît aussi sur l'accueil.

### Activer ton accès (une seule fois)
1. Recolle `firestore.rules` dans Firebase → **Firestore Database → Rules**, puis clique **Publish**.
2. Toujours dans Firestore Database, onglet **Data** : clique **+ Start collection** (ou **+ Add collection**).
3. ID de la collection : `admins`. ID du document : **ton nom d'usager du site**, en minuscules (celui affiché en haut de l'accueil, par exemple `kiwi`).
4. Ajoute un champ, par exemple `since` (type string) avec la date du jour. Clique **Save**.
5. Ouvre la page propriétaire. Si quelqu'un d'autre l'ouvre, il voit seulement « This page is only for the site owner ».

Pour ajouter un autre administrateur plus tard, crée un autre document dans `admins` avec son nom d'usager. Le site ne permet pas de modifier cette liste : seulement la console Firebase.

### Statistiques
- **Accounts in total** : nombre de comptes existants.
- **Visitors** : navigateurs qui ont ouvert le site ce jour-là, comptés une fois par jour. Une personne avec un ordi et un cellulaire compte pour deux.
- **Signed-in visitors** : même chose, mais seulement les navigateurs connectés à un compte.
- **Sign-ins** : connexions faites avec le formulaire (les gens restent connectés d'une fois à l'autre, donc ce nombre reste petit).
- **New accounts**, **Messages**, et **visites par page** (accueil, fiche, tracker).
- Périodes : 7 jours, 30 jours ou 12 semaines, avec un graphique et un tableau.

Ce sont seulement des compteurs par jour, dans la collection `stats` : aucun nom, aucune adresse IP, rien qui identifie qui que ce soit. Les compteurs ne font que monter de 1 ; personne ne peut les lire à part toi. Tes propres visites sur la page propriétaire ne sont pas comptées.

### Messages
- Filtres **To read / Done / All** et par type (idées, problèmes, autre).
- **Show the screenshot** affiche la capture jointe ; clique dessus pour l'agrandir.
- **Mark as done** range le message ; **Delete** le supprime pour de bon, avec sa capture.

Les captures sont réduites dans le navigateur avant l'envoi (moins de 850 Ko) et stockées dans Firestore (`feedbackShots`). On n'utilise pas Firebase Storage, parce qu'il exige maintenant le plan payant Blaze. Le plan gratuit Spark donne 1 Go dans Firestore, soit plus de mille captures.

## Ajouter un outil

1. Crée `tools/nom-de-l-outil/index.html`.
2. Ajoute une entrée dans la liste `TOOLS` de `index.html` (à la racine).
3. Pour qu'il utilise les comptes : mets dans son `<head>` les deux lignes
   `<script src="../../firebase-config.js"></script>`, `<script src="../../account.js"></script>` et `<script src="../../feedback.js"></script>`,
   et ajoute le nom de son dossier dans `TOOL_IDS` au début de `account.js` (pour que « Delete my account » efface aussi ses données).
   Pour compter ses visites : ajoute `'v_nom_du_dossier'` (tirets remplacés par `_`) dans `statKeys()` de `firestore.rules`, et dans la liste `METRICS` et le tableau « Visits per page » de `admin/index.html`.
4. Pour mettre à jour un outil : remplace son `index.html`, garde ces trois lignes dans son `<head>`, et change sa version dans `TOOLS`.
