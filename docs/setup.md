# Setup — Qistudio Paris

État couvert : le site public est servi sur `qistudio.pages.dev`, la base D1 est créée et son schéma appliqué, `/api/health` répond depuis la production.

## 1. Comptes

- GitHub : https://github.com/signup
- Cloudflare : https://dash.cloudflare.com/sign-up — plan gratuit, aucune carte bancaire

## 2. Machine

Node 20 ou plus, et git.

```
node --version
git --version
```

## 3. Accès git

Sans clé SSH existante :

```
ssh-keygen -t ed25519 -C "<ton-email>"
cat ~/.ssh/id_ed25519.pub
```

Coller la clé sur https://github.com/settings/keys → **New SSH key**.

Dans chaque terminal d'où tu pousses :

```
eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519
```

## 4. Repo

Sur la page GitHub du projet : **Fork**. Puis :

```
git clone git@github.com:<ton-compte>/qistudio.git
cd qistudio
```

## 5. Connexion Cloudflare

```
npx wrangler@latest login
npx wrangler@latest whoami
```

## 6. Base D1

```
npx wrangler@latest d1 create qistudio-rdv-db --location=weur
```

Reporter le `database_id` renvoyé dans `wrangler.toml`. Ne pas coller le bloc suggéré par wrangler tel quel : le binding doit rester `DB`, c'est le nom lu par les Functions.

```toml
[[d1_databases]]
binding = "DB"
database_name = "qistudio-rdv-db"
database_id = "<le-tien>"
```

Appliquer le schéma sur la base distante :

```
npx wrangler@latest d1 execute qistudio-rdv-db --remote --file schema.sql
```

Pousser :

```
git commit -am "database_id" && git push origin main
```

## 7. Projet Cloudflare Pages

Sur https://dash.cloudflare.com :

1. **Workers & Pages** → **Create** → onglet **Pages** → **Connect to Git**
2. Autoriser l'application GitHub Cloudflare Pages, cocher le dépôt `qistudio`
3. **Project name** : `qistudio` — il détermine l'URL `qistudio.pages.dev`. S'il est déjà pris, choisir un autre nom ; l'URL devient `<nom>.pages.dev`
4. **Production branch** : `main`
5. **Framework preset** : `None`
6. **Build command** : laisser vide
7. **Build output directory** : `public`
8. **Save and Deploy**

Le binding D1 `DB` vient de `wrangler.toml` et n'est pas à créer dans le dashboard.

## 8. Vérification

```
curl https://qistudio.pages.dev/api/health
npx wrangler@latest d1 execute qistudio-rdv-db --remote --command "SELECT name FROM sqlite_master"
```

Attendu : `{"bookings":0}`, puis `booking`, `idx_slot_taken`, `slot_exception`.

## 9. Déploiements suivants

```
git push origin main
```
