# Roadmap — Qistudio Paris

Dix étapes, chacune de la taille d'une PR. Une étape se fait dans une session neuve, se termine sur un état déployé et fonctionnel, et se valide sur `qistudio.pages.dev` — pas seulement en local.

Après chaque étape : mettre `docs/setup.md` à jour selon la règle du `CLAUDE.md`, puis `/clear`.

L'ordre est strict. Aucune étape ne doit inventer un stub pour quelque chose qui n'existe pas encore : si un prérequis manque, c'est que l'étape est mal placée, il faut le signaler et non le simuler.

---

## Étape 1 — Squelette déployé

Faire vivre l'infrastructure complète avant toute fonctionnalité, pour que chaque étape suivante se valide sur l'environnement réel.

**Sous-étapes**

1. Initialiser le repo : `public/index.html` (le prototype tel quel, sans modification), `functions/`, `schema.sql`, `wrangler.toml`, `docs/`
2. Créer le projet Cloudflare Pages, connecté au repo ou déployé par `wrangler pages deploy`
3. Créer la base D1, la lier au projet sous le binding `DB`
4. Écrire `schema.sql` : tables `booking` et `slot_exception` conformes au northstar, plus l'index unique partiel

```sql
CREATE UNIQUE INDEX idx_slot_taken ON booking(date, time)
  WHERE status IN ('pending','approved','confirmed');
```

5. Appliquer le schéma sur la base distante
6. Écrire `functions/api/health.js` : une route qui exécute un `SELECT count(*) FROM booking` et renvoie le résultat en JSON

**Critères de validation**

- `qistudio.pages.dev` affiche le prototype
- `curl https://qistudio.pages.dev/api/health` renvoie `{"bookings":0}` — donc le binding D1 fonctionne en production, pas seulement en local
- Le schéma appliqué est visible via `wrangler d1 execute --remote --command "SELECT name FROM sqlite_master"`

**Ne fais pas** : ne touche pas au HTML du prototype, ne crée aucune autre route, n'installe aucune dépendance npm.

---

## Étape 2 — Lecture du mois

Le calendrier affiche l'état réel de la base au lieu du stockage local du prototype. Lecture seule.

**Sous-étapes**

1. `GET /api/month?m=YYYY-MM` renvoie les réservations de statut actif (`pending`, `approved`, `confirmed`) et les exceptions du mois. Ne jamais renvoyer `client_name`, `wechat_id` ni `note` sur cette route : elle est publique
2. Côté frontend, remplacer `load()` et `window.storage.get` par un `fetch` de cette route
3. Conserver la structure `db = {req, blocked, off}` du prototype pour ne pas réécrire `slotState()` et `renderMonth()`
4. Gérer l'échec réseau : un message dans le langage visuel du site, pas un `alert()`

**Critères de validation**

- Insérer une réservation à la main en SQL, recharger la page : le créneau apparaît en 已约
- La passer en `declined` en SQL, recharger : le créneau redevient disponible
- Dans l'onglet Réseau, la réponse de `/api/month` ne contient aucun nom ni identifiant WeChat
- Changer de mois déclenche un seul appel réseau

**Ne fais pas** : aucune écriture, aucune route admin, ne remanie pas les fonctions de rendu du prototype.

---

## Étape 3 — Soumission d'une demande et suivi client

**Sous-étapes**

1. `POST /api/request` : valide la date (dans la fenêtre de trois mois), l'heure (présente dans les règles du jour), la formule, le nom et le WeChat non vides
2. Vérifie en base que le créneau est libre et non fermé, puis insère avec `status = 'pending'`
3. Si l'insertion viole l'index unique, renvoyer un 409 ; le frontend affiche 抱歉，这个时段刚被人约走了 et recharge le mois
4. À la première visite, le serveur pose un cookie `qs_client` : UUID aléatoire, `Max-Age=31536000`, `HttpOnly`, `Secure`, `SameSite=Lax`. La valeur est stockée dans `booking.client_token`
5. `GET /api/mine` renvoie les demandes rattachées au cookie, avec leur statut
6. Brancher la section 我的申请 du prototype sur cette route

**Critères de validation**

- Soumettre une demande depuis un iPhone : le créneau passe en 审核中 en moins de deux secondes
- Fermer l'onglet, rouvrir l'URL : la demande est toujours listée dans 我的申请
- Ouvrir en navigation privée : aucune demande visible
- Soumettre deux fois le même créneau depuis deux navigateurs : une seule ligne en base, la seconde reçoit un 409 et un message lisible
- Soumettre une heure absente des règles du jour via `curl` : refusé par le serveur

**Ne fais pas** : ne sauvegarde pas le formulaire en cours de saisie, ne pré-remplis pas les champs, n'envoie aucune notification à cette étape.

---

## Étape 4 — Authentification admin côté serveur

C'est la correction de la faille du prototype. À faire avant toute action admin, jamais après.

**Sous-étapes**

1. Créer le secret `ADMIN_PASSWORD` sur le projet Pages. Il n'apparaît nulle part dans `public/`
2. `POST /api/admin/login` compare le mot de passe reçu au secret et, en cas de succès, pose un cookie `qs_admin` valant `HMAC-SHA256(ADMIN_PASSWORD, "qistudio-admin")` en hexadécimal, avec `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=2592000`. Web Crypto suffit, aucune librairie
3. Écrire un helper `requireAdmin(request, env)` qui recalcule le HMAC et le compare au cookie. Toute route d'écriture admin l'appelle en première ligne et renvoie 401 sinon
4. Remplacer le `prompt()` du prototype par un champ dans le langage visuel du site, et supprimer la constante `ADMIN_CODE` du frontend
5. `GET /api/admin/session` indique si le cookie est valide, pour restaurer le mode admin au rechargement
6. Bouton de déconnexion qui efface le cookie

**Critères de validation**

- `grep -ri "qistudio" public/` ne fait apparaître aucun mot de passe ; le bundle téléchargé par le navigateur non plus
- Un mauvais mot de passe ne pose pas de cookie et n'ouvre pas le mode admin
- Recharger la page en mode admin le conserve
- `curl -X POST` sur une route admin sans cookie renvoie 401
- Forger un cookie `qs_admin` avec une valeur arbitraire renvoie 401

**Ne fais pas** : pas de JWT, pas de table de sessions, pas de librairie d'authentification, pas de gestion multi-utilisateur.

---

## Étape 5 — Actions admin sur les demandes

**Sous-étapes**

1. `GET /api/admin/month?m=YYYY-MM` renvoie les demandes complètes du mois, nom et WeChat inclus, protégée par `requireAdmin`
2. `POST /api/admin/booking/:id/status` applique une transition. Le serveur valide la transition demandée contre la machine à états du northstar et refuse tout le reste : `pending → approved | declined`, `approved → confirmed | cancelled`, `confirmed → cancelled`
3. Brancher l'inbox du prototype sur ces routes, demandes en attente en tête
4. Le compteur 待处理 n de la barre admin reflète le nombre réel
5. Remplacer le `confirm()` d'annulation par une confirmation dans le langage visuel du site

**Critères de validation**

- Approuver puis marquer le dépôt reçu, entièrement au pouce sur iPhone
- Une annulation remet le créneau disponible côté cliente après rechargement
- Le statut vu par la cliente dans 我的申请 suit les transitions
- `POST` d'une transition invalide, par exemple `pending → confirmed`, renvoie 400 et ne modifie rien en base
- Aucune ligne n'est jamais supprimée : `SELECT count(*)` ne décroît jamais

**Ne fais pas** : pas de modification de réservation (ni la date, ni le nom, ni la formule), pas de création de réservation par l'admin, pas de suppression.

---

## Étape 6 — Feed ICS et abonnement

**Sous-étapes**

1. Créer le secret `ICS_TOKEN`, une chaîne aléatoire de 32 caractères
2. `functions/api/calendar/[token].js` sert `/api/calendar/<token>.ics`. Le paramètre de route inclut l'extension : la retirer avant de comparer au secret, en comparaison à temps constant
3. Émettre un VCALENDAR de **toutes** les réservations `confirmed`, sans filtre de date, au format du northstar : UID stable, heures locales flottantes sans TZID, `DTSTAMP`, `PRODID`
4. Fins de ligne CRLF, et pliage des lignes de plus de 75 octets — les caractères chinois y arrivent vite dans `SUMMARY` et `DESCRIPTION`
5. En-têtes `Content-Type: text/calendar; charset=utf-8` et `Cache-Control: no-cache`
6. Un token invalide renvoie 404, pas 401 : l'existence du feed ne doit pas être confirmée
7. Documenter dans `docs/setup.md` les deux abonnements locaux, sans passer par iCloud :
   - **iPhone** : `Réglages > Apps > Calendrier > Comptes > Ajouter un compte > Autre > Ajouter un abonnement à un calendrier`, coller l'URL en `webcal://`
   - **Mac** : Calendrier, `Fichier > Nouvel abonnement au calendrier`, Emplacement **Sur mon Mac** et non iCloud, rafraîchissement toutes les 15 minutes
   - Préciser `Réglages > Calendrier > Synchroniser > Tous les événements` sur iPhone pour voir l'historique
   - Préciser que le pull-to-refresh force la mise à jour, et que le délai normal va de 15 minutes à quelques heures

**Critères de validation**

- `curl` sur l'URL du feed renvoie un VCALENDAR valide, testé sur un validateur ICS
- Confirmer une réservation, s'abonner sur iPhone : l'événement apparaît avec le bon titre, la bonne heure de début et de fin, l'adresse et le WeChat en description
- Annuler cette réservation, pull-to-refresh : l'événement disparaît
- Changer le nom d'une réservation confirmée en SQL, rafraîchir : l'événement est mis à jour et non dupliqué
- Une réservation confirmée le mois dernier est toujours dans le feed
- Le même feed fonctionne simultanément sur iPhone et sur Mac
- `/api/calendar/mauvais.ics` renvoie 404

**Ne fais pas** : ni Google Calendar, ni CalDAV, ni bouton de téléchargement d'un `.ics` unitaire — le doublon d'UID dans deux agendas afficherait l'événement deux fois.

---

## Étape 7 — Fermetures de créneaux et de journées

**Sous-étapes**

1. `POST /api/admin/exception` bascule une exception : avec `time`, un créneau isolé ; sans `time`, la journée entière
2. Refuser la fermeture d'un créneau occupé par une demande active, avec un message explicite
3. Brancher le mode 关闭时段 et le bouton 当天休息 du prototype
4. Une journée fermée porte le badge 休息 dans la grille du mois

**Critères de validation**

- Fermer jeudi 17:00 et 19:00 : les deux affichent 不开放 côté cliente
- Les réouvrir : les deux redeviennent réservables
- Fermer une journée entière : badge 休息 dans la grille, aucun créneau réservable
- Tenter de fermer un créneau ayant une demande en attente : refusé avec un message clair
- Les règles récurrentes en configuration ne sont jamais modifiées ; tout est en base dans `slot_exception`

**Ne fais pas** : pas de fermeture récurrente, pas de plage de dates, pas d'édition des horaires hebdomadaires depuis l'admin.

---

## Étape 8 — Notification Telegram

**Sous-étapes**

1. Créer le bot via BotFather, récupérer le token, obtenir le `chat_id` en envoyant un message au bot puis en lisant `getUpdates`. Documenter les deux dans `docs/setup.md`
2. Secrets `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`
3. Dans `POST /api/request`, après une insertion réussie, appeler `sendMessage` au format validé :

```
💅 新预约申请

姓名 · {nom}
微信 · {wechat}
时间 · {M}月{D}日 周{J} {début} — {fin}
款式 · {formule}（约{n}小时）
定金 · {montant} €
备注 · {note}

→ 去管理页确认
```

4. La ligne 备注 disparaît si la note est vide. La dernière ligne pointe vers `qistudio.pages.dev`
5. L'envoi ne doit jamais faire échouer la réservation : erreur avalée et journalisée, réponse 200 à la cliente quoi qu'il arrive

**Critères de validation**

- Une nouvelle demande déclenche une notification sur son téléphone en moins d'une minute
- Le format est exactement celui ci-dessus, une information par ligne
- Une demande sans note ne produit pas de ligne 备注 vide
- Avec un `TELEGRAM_BOT_TOKEN` volontairement erroné, la réservation aboutit quand même

**Ne fais pas** : ne notifie que les nouvelles demandes. Aucune notification sur approbation, confirmation ou annulation — c'est elle qui les déclenche.

---

## Étape 9 — Passe esthétique

Le prototype porte la bonne direction mais garde des traces de son statut de prototype. Cette étape les efface, sans rien réinventer.

**Sous-étapes**

1. Éliminer tout `alert()`, `confirm()` et `prompt()` restant. Deux composants suffisent : un bandeau de message éphémère et une confirmation en feuille modale, dans le langage visuel existant
2. Ramener les espacements à une échelle unique de multiples de 4 px, en remplacement des valeurs ad hoc du prototype
3. Ajouter des états de focus clavier visibles sur tous les éléments interactifs
4. Vérifier les cibles tactiles à 44 px minimum, en particulier les lignes de créneau et les boutons de la barre admin
5. Ajouter un état de chargement sobre pendant les appels réseau — opacité réduite sur la grille, pas de spinner
6. Vérifier le rendu dans le webview WeChat sur iOS, pas seulement dans Safari

**Critères de validation**

- `grep -E "alert\(|confirm\(|prompt\(" public/index.html` ne renvoie rien
- Navigation complète du parcours cliente au clavier, focus toujours visible
- Aucun dégradé, aucune ombre décorative, aucun emoji dans l'interface, aucune icône importée
- Trois niveaux de hiérarchie typographique au maximum
- Le parcours de réservation est confortable au pouce sur un iPhone SE comme sur un iPhone Pro Max
- Aucun décalage de mise en page pendant le chargement

**Ne fais pas** : ne change pas les jetons de couleur, ne change pas les polices, n'ajoute aucune librairie CSS ou JS, ne remanie pas la structure du HTML.

---

## Étape 10 — Recette finale

**Sous-étapes**

1. Repartir d'une base vide et rejouer les huit critères de réussite du northstar dans l'ordre, sur un vrai iPhone
2. Relire `docs/setup.md` en le suivant à la lettre depuis un compte Cloudflare neuf, et corriger tout ce qui manque
3. Vérifier que les quatre secrets sont documentés, avec l'endroit exact où les créer et les poser
4. Vérifier qu'aucun secret n'a été committé : `git log -p | grep -iE "token|password"`
5. Rédiger dans `docs/setup.md` la courte section d'usage destinée à Qizhi : se connecter à l'admin, traiter une demande, fermer une journée, forcer un rafraîchissement du calendrier

**Critères de validation**

- Les huit critères du northstar passent
- Un tiers partant du repo et de `docs/setup.md` seuls redéploie le site complet, feed ICS et notifications inclus, sans poser de question
- Aucun secret dans l'historique git
- Le coût réel affiché sur le tableau de bord Cloudflare est nul

**Ne fais pas** : pas de suite de tests automatisés, pas de CI, pas de monitoring, pas de page d'erreur personnalisée.
