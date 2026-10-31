# Déploiement — Qistudio Paris

## 1. Comptes et outils

Créer un compte [GitHub](https://github.com/signup) et un compte [Cloudflare](https://dash.cloudflare.com/sign-up) gratuit.
Installer Node.js 22 et Git, puis cloner le dépôt :

```sh
git clone git@github.com:smnvictor/qistudio.git
cd qistudio
npx wrangler@latest login
npx wrangler@latest whoami
```

## 2. Base de données — première installation

```sh
npx wrangler@latest d1 create qistudio-rdv-db --location=weur
```

Reporter l’identifiant obtenu dans `wrangler.toml`, en conservant le binding `DB` et le nom `qistudio-rdv-db`.

```sh
npx wrangler@latest d1 execute qistudio-rdv-db --remote --file schema.sql
```

Passer à la section 4. Ne pas appliquer la migration de la section 3 sur une base créée avec ce schéma.

## 3. Base de données — mise à jour du site existant

Depuis la version antérieure aux durées personnalisées et à l’expiration automatique, appliquer une seule fois cette migration **avant** de publier le nouveau site :

```sh
npx wrangler@latest d1 execute qistudio-rdv-db --remote --file migrations/0001_schedule_and_expiry.sql
```

## 4. Projet Pages et secrets

Pour une première installation :

```sh
npx wrangler@latest pages project create qistudio --production-branch main
```

Sur un projet existant, conserver les secrets déjà définis.

Définir le mot de passe administrateur :

```sh
npx wrangler@latest pages secret put ADMIN_PASSWORD --project-name qistudio
```

Générer le token du calendrier, le conserver pour l’abonnement, puis le saisir à l’invite :

```sh
openssl rand -hex 16
npx wrangler@latest pages secret put ICS_TOKEN --project-name qistudio
```

Dans Telegram, ouvrir **@BotFather**, envoyer `/newbot`, choisir un nom et un identifiant se terminant par `bot`. Conserver le token renvoyé et le saisir à l’invite :

```sh
npx wrangler@latest pages secret put TELEGRAM_BOT_TOKEN --project-name qistudio
```

Envoyer un message au nouveau bot depuis le compte administrateur, puis ouvrir `https://api.telegram.org/bot<TOKEN>/getUpdates` et relever `result[0].message.chat.id`. Saisir cet identifiant à l’invite :

```sh
npx wrangler@latest pages secret put TELEGRAM_CHAT_ID --project-name qistudio
```

## 5. Publication du site

```sh
npx wrangler@latest pages deploy public --project-name qistudio --branch main
```

## 6. Annulation automatique et notification Telegram

Vérifier `SITE_URL` dans `wrangler.expiry.toml` : `https://qistudio.pages.dev`.

Publier le Worker planifié :

```sh
npx wrangler@latest deploy --config wrangler.expiry.toml
```

Générer un secret partagé, puis saisir la même valeur aux deux invites :

```sh
openssl rand -hex 32
npx wrangler@latest pages secret put EXPIRY_TOKEN --project-name qistudio
npx wrangler@latest secret put EXPIRY_TOKEN --config wrangler.expiry.toml
npx wrangler@latest pages deploy public --project-name qistudio --branch main
```

Le traitement utilise les identifiants Telegram déjà configurés sur Pages.

Attendre jusqu’à 15 minutes pour l’activation initiale du déclencheur planifié.

## 7. Vérification

```sh
curl https://qistudio.pages.dev/api/health
curl 'https://qistudio.pages.dev/api/month?m=2026-11'
```

Ouvrir le site et vérifier les deux langues avec le bouton de langue. Se connecter depuis le bouton rond avec le mot de passe administrateur.

Vérifier qu’un dimanche affiche 11 h simple, 13 h custom et 16 h simple ouverts par défaut, et 19 h custom fermé par défaut. En mode « Close slots », ouvrir puis refermer le créneau de 19 h. En mode « Close days », fermer puis rouvrir le dimanche entier.

Activer « Adjust duration », choisir un créneau, ajouter 30 minutes et vérifier l’aperçu avant/après. Fermer sans enregistrer, puis refaire et enregistrer. Vérifier que les créneaux suivants sont décalés et que le changement persiste après rechargement.

Entre 00:00 et 06:00 à Paris, vérifier que les demandes sont refusées avec un message dans la langue affichée.

Dans Cloudflare → **Workers & Pages** → **qistudio-expiry** → **Settings** → **Trigger Events**, vérifier le cron `* * * * *`. Vérifier qu’une demande laissée en attente 24 heures passe en annulation et déclenche une notification Telegram avec identifiant, cliente, WeChat, date, heures, formule, durée, acompte, note et motif.

## 8. Calendrier Apple

Avec le token conservé en section 4 :

```text
webcal://qistudio.pages.dev/api/calendar/<ICS_TOKEN>.ics
```

**iPhone** : Réglages → Apps → Calendrier → Comptes → Ajouter un compte → Autre → Ajouter un abonnement à un calendrier. Coller l’URL, Suivant, Enregistrer. Puis Réglages → Calendrier → Synchroniser → Tous les événements.

**Mac** : Calendrier → Fichier → Nouvel abonnement à un calendrier. Coller l’URL, choisir « Sur mon Mac » et une actualisation toutes les 15 minutes.

Laisser le calendrier se rafraîchir ou tirer la liste des événements vers le bas sur iPhone. Vérifier que les rendez-vous confirmés reflètent les horaires et les durées ajustés.

## Pour Qizhi

- Le bouton de langue bascule entre le chinois et l’anglais. Le choix est mémorisé sur l’appareil.
- Les demandes clientes sont ouvertes entre 6 h et minuit, heure de Paris, pour les 31 jours à venir.
- Le dimanche, 11 h, 13 h et 16 h sont ouverts par défaut ; seul 19 h est fermé par défaut. « Close slots » permet d’ouvrir le créneau de 19 h ou de fermer un autre créneau ; « Close days » ouvre ou ferme une journée entière.
- « Adjust duration » permet de choisir un créneau et de modifier sa durée par pas de 30 minutes. Vérifier l’aperçu, puis enregistrer. Les réservations déjà prises et le calendrier Apple suivent le décalage. Prévenir les clientes concernées par WeChat.
- Les trois modes d’édition s’excluent. Fermer la fenêtre, toucher Annuler ou appuyer sur Échap quitte la modification sans enregistrer.
- « Approve » valide une demande et l’ajoute au calendrier Apple ; « Decline » ou « Cancel » libère le créneau.
- Après 24 heures sans confirmation, la demande est annulée. Le Worker vérifie chaque minute, même sans visite sur le site. Une notification Telegram identifie la demande annulée ; un envoi échoué est retenté au passage suivant.
- « Log out » quitte le mode administration.
