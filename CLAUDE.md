# CLAUDE.md

## Contexte

Site de réservation pour Qistudio Paris, un studio d'ongles à domicile tenu par une seule personne, Qizhi. Ses clientes sinophones réservent un créneau depuis un lien WeChat ; elle approuve à la main et confirme quand elle a reçu le dépôt. Les rendez-vous confirmés apparaissent dans l'app Calendrier de son iPhone via un feed ICS.

Volume attendu : environ 40 réservations par mois. Tout doit rester gratuit à vie.

## Documents

Les trois documents de `docs/` font autorité. En cas de contradiction avec ce fichier ou avec une intuition, ils gagnent.

- **`docs/northstar.md`** — la vision : périmètre, règles métier, stack, modèle de données, direction esthétique, critères de réussite. À lire en entier avant toute intervention.
- **`docs/roadmap.md`** — dix étapes ordonnées, avec sous-étapes, critères de validation et interdits. La source de vérité sur quoi faire et dans quel ordre.
- **`docs/setup.md`** — comment déployer le projet entier depuis zéro. Voir la règle ci-dessous.

## Règle du setup.md

**Après chaque étape de la roadmap, réécrire `docs/setup.md` intégralement**, de façon à ce qu'une personne partant d'une machine vierge et d'aucun compte obtienne le site complet, dans l'état atteint à cette étape, en suivant le document à la lettre et sans rien deviner.

Le document contient exclusivement des instructions de déploiement, dans l'ordre d'exécution. Pour chaque compte à créer, chaque clé ou token à générer : où l'obtenir, sous quel nom exact le stocker, et par quelle commande. Pour l'abonnement au calendrier : le parcours de réglages exact sur iPhone et sur Mac.

Il ne contient ni justification, ni explication d'architecture, ni alternative, ni dépannage. Le plus court possible tout en restant exhaustif. Une commande vaut mieux qu'un paragraphe.

La seule exception : une courte section finale d'usage pour Qizhi, ajoutée à l'étape 10.

## Méthode de travail

Une étape de la roadmap par session. Ne jamais commencer l'étape suivante dans la même session.

Chaque étape se termine sur un état déployé et fonctionnel. Jamais de repo cassé entre deux étapes, jamais de fonction appelée mais non écrite.

Chaque étape se valide en production, sur `qistudio.pages.dev`, en passant les critères de validation listés dans la roadmap. Le local sert à itérer, pas à valider.

Si un prérequis manque, le dire et s'arrêter. Ne jamais inventer un stub plausible pour continuer.

À la fin d'une étape : réécrire `docs/setup.md`, puis rapporter en quelques lignes ce qui a été fait, ce qui a été validé et comment.

## Contraintes fermes

Cloudflare Pages, Pages Functions et D1. Rien d'autre.

Un seul fichier frontend, `public/index.html`, en HTML, CSS et JavaScript natifs. Aucun build step, aucune dépendance npm, aucun framework, aucun ORM, aucune librairie côté client.

Le prototype est la référence visuelle et interactionnelle, pas une maquette à réinterpréter. Ses jetons de couleur, son échelle typographique et le traitement laque des lignes de créneau sont repris tels quels.

Horaires, durées, montants de dépôt, identifiant WeChat et adresse vivent dans un seul objet de configuration en haut de `public/index.html`. Les changer doit rester une modification d'une ligne.

Les secrets ne sont jamais dans le code ni dans le repo. Chaque route d'écriture admin vérifie le mot de passe côté serveur.

Interface en chinois simplifié, heures en 24 h, mobile d'abord — plus de 90 % du trafic sera Safari iOS ouvert depuis WeChat.

## Interdits

Ne rien ajouter qui ne soit pas demandé par l'étape en cours. Pas de tests automatisés, pas de CI, pas de monitoring, pas de logs structurés, pas de gestion d'erreur élaborée, pas de refactoring opportuniste d'un fichier adjacent.

Pas de dégradés, pas d'ombres décoratives, pas d'animations autres que les transitions d'état, pas d'emoji dans l'interface, pas d'icônes importées, pas plus de trois niveaux de hiérarchie typographique.

Pas de `alert()`, `confirm()` ni `prompt()` dans le code livré.

Pas d'abstraction anticipée. Deux occurrences ne justifient pas une fonction générique. Le projet fait quelques centaines de lignes et doit rester lisible d'un seul coup d'œil.

Aller droit au but dans le code comme dans les réponses. Pas de commentaire qui répète le code, pas de préambule, pas de récapitulatif de ce qui vient d'être écrit.
