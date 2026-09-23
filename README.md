# IRONLOG

**Lift. Log. Repeat.** Un carnet de musculation mobile, privé et utilisable hors ligne.

## Utiliser l’application

1. Ouvrez IRONLOG et choisissez **Créer mon IRONLOG** ou **Ouvrir mon IRONLOG**.
2. Ajoutez un exercice, puis ses séries. La première série démarre automatiquement une séance.
3. Consultez la dernière performance, l’historique et le meilleur poids sur la fiche de l’exercice.
4. Touchez **Terminer l’entraînement** pour finaliser la séance et mettre à jour votre fichier.

Chaque changement est enregistré immédiatement dans le stockage local du navigateur. Le fichier `.ironlog` est la copie portable à conserver séparément. Sans ce fichier, une suppression des données du navigateur ou la perte de l’appareil peut faire perdre l’historique.

Sur les navigateurs compatibles avec les sélecteurs de fichiers modernes, IRONLOG peut garder l’accès au fichier choisi et le mettre à jour lorsque la permission est disponible. Sur iPhone/Safari, le navigateur peut lancer un téléchargement : enregistrez alors le fichier dans **Fichiers** et remplacez votre ancienne copie. IRONLOG ne peut pas vérifier que cette étape manuelle a eu lieu. **Créer une copie de sauvegarde** dans Réglages permet de conserver une deuxième copie.

Les photos sont réduites localement avant enregistrement. Le fichier contient les exercices, photos, séances, séries et réglages. Aucun compte, service de synchronisation, serveur de données, outil d’analyse ou police distante n’est utilisé.

## Installer comme application

- **iPhone** : ouvrez le site dans Safari, puis Partager → **Sur l’écran d’accueil**.
- **Android** : ouvrez le site dans Chrome, puis menu → **Installer l’application** ou **Ajouter à l’écran d’accueil**.

Après une première visite en ligne, le service worker garde l’interface et ses ressources pour l’usage hors ligne. Les données d’entraînement restent dans IndexedDB sur l’appareil.

Lorsqu’une nouvelle version est prête, IRONLOG propose **Mettre à jour** ou **Plus tard**. La page ne se recharge qu’après votre choix; les exercices et séries déjà enregistrés restent dans IndexedDB. L’application vérifie les mises à jour à l’ouverture et au retour au premier plan. Il n’est pas nécessaire de vider le cache.

## Développement local

Prérequis : Node.js 20+ et Python 3.11+.

```bash
npm ci
npm run serve
```

Ouvrez `http://127.0.0.1:8765/IRONLOG/`. Le serveur de développement monte le projet sous un sous-dossier pour reproduire GitHub Pages.

```bash
npx playwright install chromium webkit
npm test
npm run format:check
```

Les tests couvrent le parcours mobile, la sauvegarde et restauration, les photos, les unités, les fichiers invalides et le rechargement hors ligne sur Chromium. WebKit est testé pour les parcours fonctionnels; son moteur automatisé sur Windows plante lors d’un rechargement forcé avec la connexion simulée hors ligne. Un essai manuel sur iPhone réel reste recommandé avant une diffusion large.

Les icônes PNG sont générées à partir de `assets/icon.svg` avec `npm run icons`.

## Publication GitHub Pages

Le site est statique et ne requiert aucune compilation. Dans le dépôt GitHub, ouvrez **Settings → Pages**, choisissez **Deploy from a branch**, la branche `main`, puis le dossier **/(root)**. L’URL prévue est `https://kcote84.github.io/IRONLOG/`. Les chemins des ressources et du service worker sont relatifs au sous-dossier; le même code fonctionne si le dépôt est renommé en minuscules.

Ne committez jamais un fichier `.ironlog` ou une exportation contenant des données d’entraînement. Ces fichiers sont exclus par `.gitignore`.

## Format et évolution

Le fichier est un JSON portant `format: "IRONLOG"` et `version: 1`. L’import vérifie la version, les champs, les identifiants et les références avant de remplacer les données locales. Une version future pourra ajouter une migration explicite; les versions inconnues sont refusées pour protéger les données.
