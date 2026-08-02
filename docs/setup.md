# Setup — Qistudio Paris

État couvert : le site complet, feed ICS et notifications Telegram inclus.

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

## 8. Secrets

```
npx wrangler@latest pages secret put ADMIN_PASSWORD --project-name=qistudio
```

Saisir le mot de passe de Qizhi à l'invite. Ne pas reprendre `qistudio`, valeur d'exemple présente dans l'historique du dépôt.

Générer le token du calendrier et le garder sous la main, il sert en section 10 :

```
openssl rand -hex 16
npx wrangler@latest pages secret put ICS_TOKEN --project-name=qistudio
```

Coller la valeur générée à l'invite.

Créer le bot Telegram : dans Telegram, ouvrir **@BotFather**, envoyer `/newbot`, choisir un nom et un identifiant se terminant par `bot`. BotFather renvoie le token.

```
npx wrangler@latest pages secret put TELEGRAM_BOT_TOKEN --project-name=qistudio
```

Envoyer ensuite n'importe quel message au bot depuis le compte Telegram de Qizhi, puis relever le `chat_id` :

```
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates"
```

Le nombre à récupérer est `result[0].message.chat.id`.

```
npx wrangler@latest pages secret put TELEGRAM_CHAT_ID --project-name=qistudio
```

Puis redéployer pour que les secrets soient visibles des Functions :

```
git commit --allow-empty -m "secrets" && git push origin main
```

## 9. Vérification

```
curl https://qistudio.pages.dev/api/health
curl "https://qistudio.pages.dev/api/month?m=$(date +%Y-%m)"
npx wrangler@latest d1 execute qistudio-rdv-db --remote --command "SELECT name FROM sqlite_master"
```

Attendu : `{"bookings":0}`, puis `{"bookings":[],"exceptions":[]}`, puis `booking`, `idx_slot_taken`, `slot_exception`.

Ouvrir https://qistudio.pages.dev : le calendrier du mois s'affiche, tous les créneaux disponibles. Les jours situés à plus de 31 jours de la date du jour sont grisés et ne réagissent pas au clic ; la flèche › s'arrête au mois contenant cette limite.

Toucher un créneau libre : il se déroule et affiche les styles inclus. Toucher 填写申请, remplir le formulaire, soumettre : le formulaire se ferme, une pop-up de remerciement affiche les contacts WeChat et Instagram, le créneau passe en 审核中 et la demande apparaît dans 我的申请. Toutes les pop-up se ferment en cliquant à côté.

Le bouton 价格 en haut à droite ouvre les tarifs.

Le bouton rond en haut à gauche ouvre la connexion admin. Le mot de passe est celui posé en section 8. Une fois connectée, la barre bordeaux en haut affiche le nombre de demandes en attente, et chaque demande du mois porte ses boutons 批准, 拒绝 et 取消. 批准 confirme directement le rendez-vous, qui part alors dans le feed ICS. Le bouton 关闭时段 fait basculer les créneaux au clic, 关闭日期 fait basculer les journées entières au clic.

## 10. Abonnement au calendrier

L'URL du feed, avec le token de la section 8 :

```
webcal://qistudio.pages.dev/api/calendar/<ICS_TOKEN>.ics
```

**iPhone** — Réglages → Apps → Calendrier → Comptes → Ajouter un compte → Autre → **Ajouter un abonnement à un calendrier**, coller l'URL, Suivant, Enregistrer.

Puis Réglages → Calendrier → Synchroniser → **Tous les événements**, sans quoi l'historique n'apparaît pas.

**Mac** — Calendrier → Fichier → **Nouvel abonnement au calendrier**, coller l'URL, Emplacement **Sur mon Mac** et non iCloud, Actualisation **toutes les 15 minutes**.

Le rafraîchissement va de quinze minutes à plusieurs heures. Un pull-to-refresh dans l'app Calendrier force la mise à jour.

## 11. Déploiements suivants

```
git push origin main
```

---

## Pour Qizhi

**Changer de langue** — le bouton en haut à gauche bascule la page entre le chinois et l'anglais. Le bouton 价格 en haut à droite ouvre les tarifs.

**Fenêtre de réservation** — les clientes ne peuvent réserver que dans les 31 jours qui viennent. Au-delà, les jours sont grisés et se rouvrent seuls au fil des jours.

**Se connecter** — ouvrir qistudio.pages.dev, toucher le petit bouton rond en haut à gauche, à droite du bouton de langue, saisir le mot de passe. La barre bordeaux en haut indique que le mode administration est actif. Il reste actif un mois, même après avoir fermé le navigateur.

**Traiter une demande** — les demandes du mois s'affichent sous le calendrier, les nouvelles en premier.

- 批准 : le rendez-vous passe en 已确认 et apparaît dans le calendrier de l'iPhone
- 拒绝 : le créneau redevient libre
- 取消 : annule un rendez-vous confirmé, le créneau redevient libre

**Fermer une journée** — toucher 关闭日期, puis toucher dans le calendrier les jours à fermer. Toucher un jour déjà fermé le rouvre. Un jour fermé n'affiche plus que des tirets gris et porte le badge 休息 quand on l'ouvre. Toucher 关闭日期 une seconde fois quitte ce mode.

**Fermer un seul créneau** — toucher 关闭时段, puis toucher le créneau à fermer. Le toucher à nouveau le rouvre. Toucher 关闭时段 une seconde fois quitte ce mode.

Les deux modes s'excluent : activer l'un désactive l'autre.

Un créneau qui a déjà une demande ne peut pas être fermé : traiter la demande d'abord.

**Lire le calendrier de l'iPhone** — chaque rendez-vous confirmé apparaît sur son créneau horaire sous la forme 💅 suivi de l'heure de début, sans autre détail.

**Rafraîchir le calendrier de l'iPhone** — l'app Calendrier se met à jour toute seule, entre quinze minutes et quelques heures après un changement. Pour forcer : ouvrir l'app Calendrier, aller dans la liste des événements et tirer l'écran vers le bas.

**Quitter le mode administration** — 退出 dans la barre bordeaux.
