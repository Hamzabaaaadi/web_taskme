# Déployer sur Railway — Guide rapide

Ce guide explique comment déployer ton backend Node/Express sur Railway et éviter les problèmes courants (versions Node, variables d'environnement, MongoDB, Socket.IO).

## Fichiers ajoutés
- `Procfile` : indique à Railway la commande de démarrage `web: npm start`.
- `package.json` : champ `engines.node` ajouté (`18.x`) pour forcer une version Node compatible.

## Avant de commencer
- Ton projet a déjà un script `start` : `node server.js` (vérifié).
- Ton fichier `backend/.env.example` contient les variables d'environnement attendues (MONGODB_URI, JWT_SECRET, IMAGEKIT_*, EMAIL_*, HF_API_KEY, NODE_ENV).
- Railway supporte les services long-running, donc `socket.io` fonctionnera correctement (contrairement à Vercel serverless).

## Étapes (depuis ton repo GitHub)
1. Pousse tes changements (`Procfile`, `package.json` modifié, README) sur GitHub :
```powershell
git add Procfile package.json README_RAILWAY.md
git commit -m "Add Railway deploy files and docs"
git push
```
2. Sur Railway (https://railway.app) :
   - Crée un nouveau projet → "Deploy from GitHub" → sélectionne ton repo et la branche.
   - Railway détectera la build Node.js et utilisera `package.json` + `Procfile`.
3. Configure les variables d'environnement dans Railway (Project → Variables) — copie les valeurs réelles depuis ton `.env` local :
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_ENDPOINT`
   - `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
   - `HF_API_KEY`
   - `NODE_ENV` = `production`

## MongoDB
- Option A (recommandée si tu veux tout centraliser sur Railway) : utiliser l'add-on MongoDB de Railway (ou configurer une base Mongo gérée par Railway). Suis l'interface Railway pour ajouter une DB et récupère la `MONGODB_URI` fournie.
- Option B : utiliser MongoDB Atlas externe (tu as déjà une URI). Assure-toi que l'IP ou les règles d'accès autorisent le service Railway si nécessaire.

## Socket.IO / WebSockets
- Railway supporte des processus long-running — ton `socket.io` dans `server.js` fonctionnera normalement.
- Vérifie que `server.js` écoute `process.env.PORT || 5001` (c'est le cas) — Railway fournira `PORT` automatiquement.

## Bonnes pratiques
- Ne commite jamais de secrets (tokens, mots de passe). Utilise `backend/.env.example` comme référence pour les clés à configurer sur Railway.
- Teste localement avant de déployer :
```powershell
npm install
npm run dev
```
- Si tu veux contrôler la version exacte de Node, modifie `engines.node` dans `package.json` (déjà mis à `18.x`).

## Commandes utiles Railway CLI (optionnel)
```powershell
npm i -g railway
railway login
railway init    # initialiser dans un dossier existant
railway up      # déployer localement (ou via Git selon config)
```

Si tu veux, je peux :
- ajouter un `Procfile` ou `Dockerfile` personnalisé,
- préparer la configuration pour séparer REST et WebSocket (si tu veux découpler),
- ou exécuter les commits/pushs Git depuis cette machine.
