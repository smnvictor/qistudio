# Northstar — Qistudio Paris

## 1. Contexte

Qizhi tient un studio d'ongles à domicile à Vanves (92). Elle travaille seule et il n'y aura jamais de second praticien. Ses clientes sont sinophones et vivent à Paris ; elles la contactent par WeChat.

Aujourd'hui elle gère ses rendez-vous à la main, dans la conversation WeChat, et les recopie dans son calendrier. Le projet existe pour supprimer cette double saisie et donner aux clientes une vue claire de ses disponibilités.

L'interface est en chinois simplifié. Il n'y a pas de compte client et aucun paiement dans l'app.

## 2. Ce que le site fait

**Pour la cliente**, sur une seule page publique, sans compte :

- Un calendrier mensuel montrant les créneaux libres, en attente, réservés et fermés
- Le détail d'une journée : heure de début, heure de fin, formule, durée
- Un formulaire de demande à trois champs : nom, WeChat, note facultative
- La liste de ses propres demandes et leur statut, retrouvée automatiquement à chaque visite

**Pour Qizhi**, derrière un mot de passe, sur la même page :

- La liste des demandes du mois avec les demandes en attente en tête
- Approuver, refuser, marquer le dépôt reçu, annuler
- Fermer et réouvrir un créneau précis, ou une journée entière marquée 休息
- Une notification Telegram à chaque nouvelle demande
- Ses rendez-vous confirmés dans l'app Calendrier de son iPhone et de son Mac, automatiquement

## 3. Ce que le site ne fait pas

Ces exclusions sont des décisions, pas des manques à combler plus tard sans discussion.

- Pas de comptes clients, pas de mots de passe côté cliente
- Pas de paiement en ligne. Le dépôt se règle par transfert WeChat et Qizhi le confirme à la main
- Pas de messagerie interne. WeChat reste le canal de conversation
- Pas de libération automatique des créneaux non payés. À ce volume, un refus manuel suffit
- Pas de version française, pas d'historique client affiché, pas de galerie photo
- Pas d'analytics, pas de tracking, aucun script tiers
- Pas de multi-praticien, pas de multi-lieu

## 4. Stack

Tout est chez Cloudflare, sur des offres gratuites sans restriction d'usage commercial et sans mise en veille pour inactivité.

| Rôle | Choix |
|---|---|
| Hébergement | Cloudflare Pages → `qistudio.pages.dev` |
| API | Pages Functions, sous `/functions/api/` |
| Données | Cloudflare D1 (SQLite) |
| Frontend | HTML, CSS et JavaScript natifs. Un seul fichier, aucun build step |
| Notifications | Bot Telegram, API HTTP directe |
| Calendrier | Feed ICS servi par une Function, URL secrète |
| Déploiement | `wrangler pages deploy` |

Coût total : zéro, sans échéance.

Pas de framework, pas d'ORM, pas de gestionnaire de paquets côté client. Le prototype `qistudio-booking.html` est déjà l'application : on remplace ses appels `window.storage` par des `fetch('/api/...')`.

## 5. Règles métier

### Formules

| Clé | Libellé | Durée | Dépôt |
|---|---|---|---|
| `simple` | 简单款式 | 2 h | 5 € |
| `full` | 不限款式 | 3 h | 7 € |

Une cliente par créneau. Jamais de rendez-vous parallèles.

### Horaires récurrents

| Jour | Créneaux |
|---|---|
| Lundi à vendredi | 17:00 `simple`, 19:00 `full` |
| Samedi | 11:00, 14:00, 17:00, 20:00 — tous `full` |
| Dimanche | 11:00 `simple`, 16:00 `full`, 19:00 `full` |

Réservation ouverte sur le mois courant et les deux suivants.

Ces horaires, les durées, les montants de dépôt, l'identifiant WeChat et l'adresse vivent dans **un seul objet de configuration** en haut du fichier frontend, repris tel quel du prototype. Qizhi voudra les changer selon les saisons ; ça doit être une modification d'une ligne, sans toucher à la logique.

### Exceptions

Qizhi peut fermer un créneau isolé sur une date donnée, ou une journée entière. Une fermeture est toujours stockée comme une exception rattachée à une date, jamais comme une modification des règles récurrentes. Toute fermeture est réversible.

### Cycle de vie d'une demande

```
cliente soumet
      ↓
 [ pending ]   待确认
   ↙       ↘
approuve   refuse
   ↓          ↓
[ approved ]  [ declined ]
 待付定金
   ↓
dépôt reçu, marqué à la main
   ↓
[ confirmed ]  已确认  →  écrit dans le calendrier
   ↓
annule → [ cancelled ] → le créneau revient au pool
```

Ce que la cliente voit :

| État | Affichage du créneau |
|---|---|
| aucun | disponible, couleur selon la formule |
| `pending` | 审核中, non sélectionnable |
| `approved` / `confirmed` | 已约, non sélectionnable |
| `declined` / `cancelled` | disponible à nouveau |

Un créneau déjà en `pending` ne peut pas recevoir de demande de secours.

## 6. Calendrier Apple

C'est l'exigence qui a motivé le projet. Elle se conçoit d'abord, pas en dernier.

Une Function expose `/api/calendar/<token>.ics` où `<token>` est un secret aléatoire. Elle renvoie un VCALENDAR contenant **tous** les rendez-vous `confirmed`, passés inclus. Qizhi s'abonne une seule fois par appareil via un lien `webcal://`.

Un calendrier abonné est un miroir du feed, pas une boîte de réception : ce qui sort du feed disparaît de l'app Calendrier. C'est pourquoi le passé reste dans le feed (l'historique est conservé) et pourquoi les annulations en sortent (l'événement s'efface tout seul). Un UID stable garantit qu'Apple met l'événement à jour au lieu de le dupliquer.

Format d'un événement :

```
UID:         {booking id}@qistudio
SUMMARY:     美甲 · {nom}（{formule}）
DTSTART:     heure locale flottante, sans TZID
DTEND:       DTSTART + 2 h ou 3 h
LOCATION:    Vanves 92170
DESCRIPTION: 微信 {wechat}
             {formule} 约{n}小时
             备注 {note}
```

Les heures sont flottantes, sans fuseau : le serveur stocke une date et une chaîne `HH:MM`, et l'iPhone les affiche telles quelles. Cela supprime tout problème d'heure d'été.

Le rafraîchissement dépend d'iOS et peut aller de quinze minutes à plusieurs heures. C'est acceptable puisque les rendez-vous se prennent des jours à l'avance. Un pull-to-refresh dans l'app Calendrier force la mise à jour. Ce point doit être expliqué à Qizhi au moment de l'abonnement, sinon elle croira à une panne.

## 7. Données

```
booking
  id            text  primary key
  date          text  -- 2026-08-03
  time          text  -- "19:00"
  service       text  -- simple | full
  client_name   text
  wechat_id     text
  note          text  nullable
  status        text  -- pending | approved | confirmed | declined | cancelled
  client_token  text  -- rattachement au cookie de la cliente
  created_at    text

slot_exception
  date          text
  time          text  nullable  -- null = journée entière fermée
  reason        text  nullable
```

Un index unique partiel garantit au plus une réservation par `(date, time)` parmi les statuts actifs. Rien n'est jamais supprimé de la base : un refus ou une annulation est un changement de statut.

La cliente est identifiée par un cookie `client_token` posé par le serveur, valable un an. Il sert uniquement à retrouver ses demandes. Le cookie est posé côté serveur et non en JavaScript, parce que Safari plafonne à sept jours les cookies écrits par script.

## 8. Sécurité

Le mot de passe admin est un secret Cloudflare. Il n'apparaît jamais dans le code frontend. **Chaque route d'écriture admin vérifie le mot de passe côté serveur** — c'est la faille principale du prototype, où le mot de passe était en clair dans le JavaScript et où n'importe qui pouvait donc approuver ou annuler des rendez-vous.

Le token du feed ICS est également un secret. L'URL du feed n'est affichée nulle part sur le site.

## 9. Direction esthétique

Le prototype est la référence, pas une maquette à réinterpréter. Ses jetons de couleur, son échelle typographique et le traitement laque des lignes de créneau sont repris tels quels.

Ce qui est acquis : fond papier `#F3F0F4`, chiffres et titres en Didot, dates et heures en monospace, pastille de couleur laquée par formule, cartes à angles quasi droits, bordures fines.

Ce qui est interdit : dégradés, ombres décoratives, animations autres que les transitions d'état, emoji dans l'interface, icônes importées, plus de trois niveaux de hiérarchie typographique.

Ce qui doit être corrigé par rapport au prototype : les `alert()` et `prompt()` natifs, remplacés par des éléments dans le langage visuel du site ; les états de focus clavier, absents aujourd'hui ; les espacements ad hoc, ramenés à une échelle unique.

Contraintes fermes : mobile d'abord, plus de 90 % du trafic sera Safari iOS ouvert depuis un message WeChat. Heures en format 24 h. Tout en `Europe/Paris`. L'admin doit être entièrement utilisable au pouce, Qizhi traitera les demandes entre deux clientes.

## 10. Critères de réussite

1. Une cliente ouvre l'URL sur iPhone, choisit un créneau libre, envoie sa demande, et le voit passer en 审核中 en moins de deux secondes
2. Qizhi reçoit une notification Telegram en moins d'une minute
3. Qizhi approuve puis marque le dépôt reçu, entièrement depuis son téléphone
4. Le rendez-vous confirmé apparaît dans l'app Calendrier sans aucune action au-delà de l'abonnement initial
5. Annuler un rendez-vous confirmé retire l'événement du calendrier et remet le créneau en circulation
6. Fermer jeudi 17:00 et 19:00 affiche 不开放 sur les deux créneaux côté cliente ; les réouvrir les restaure
7. Une cliente qui revient sur le site retrouve ses demandes et leur statut sans rien saisir
8. Le mot de passe admin est introuvable dans tout ce que le navigateur télécharge
