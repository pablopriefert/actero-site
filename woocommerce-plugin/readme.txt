=== Actero for WooCommerce ===
Contributors: actero
Tags: woocommerce, support, chat, service client, ia
Requires at least: 6.5
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

L'agent SAV Actero sur votre boutique WooCommerce. La bulle de chat s'installe en un clic, sans toucher à votre thème.

== Description ==

Actero répond à vos clients à votre place : suivi de commande, retours, questions produit — et passe la main à un humain dès qu'il n'est pas sûr.

Cette extension fait deux choses :

* **Elle pose la bulle de chat** sur votre boutique, sans que vous ayez à coller du code dans votre thème. Une mise à jour de thème ne l'effacera pas.
* **Elle vous mène au bon écran** pour autoriser Actero à lire vos commandes, avec l'adresse de votre boutique déjà remplie.

L'extension n'envoie rien à Actero par elle-même. Les accès à vos commandes sont accordés par WooCommerce, via son propre écran d'autorisation, et vous pouvez les révoquer à tout moment depuis WooCommerce → Réglages → Avancé → API REST.

Un compte Actero est nécessaire. L'offre gratuite permet de commencer sans carte bancaire.

== Service tiers ==

Cette extension charge le script du widget de chat depuis le service Actero
(https://actero.fr/widget.js) et n'est fonctionnelle qu'avec un compte Actero.

Les conversations engagées dans la bulle sont traitées par Actero.

* Site : https://actero.fr
* Conditions d'utilisation : https://actero.fr/cgu
* Politique de confidentialité : https://actero.fr/confidentialite

== Installation ==

1. Installez et activez l'extension.
2. Créez un compte sur https://actero.fr si vous n'en avez pas.
3. Dans WooCommerce → Actero, collez votre clé Actero. La bulle apparaît aussitôt sur votre boutique.
4. Cliquez sur « Connecter mes commandes » pour qu'Actero puisse répondre aux questions de suivi.

== Frequently Asked Questions ==

= Faut-il un compte Actero ? =

Oui. L'extension pose la bulle et vous mène au bon écran, mais c'est Actero qui répond aux clients.

= L'extension a-t-elle accès à mes commandes ? =

Non. Elle ne lit aucune commande. L'accès est accordé séparément par WooCommerce, via son propre écran d'autorisation, et reste révocable depuis vos réglages WooCommerce.

= Que se passe-t-il si je désinstalle l'extension ? =

La bulle disparaît de votre boutique et la clé est effacée de votre base. Les accès WooCommerce, eux, se révoquent depuis WooCommerce → Réglages → Avancé → API REST.

= Est-elle compatible avec le stockage haute performance des commandes (HPOS) ? =

Oui, et elle le déclare explicitement. Elle ne lit ni n'écrit aucune commande.

== Changelog ==

= 1.0.0 =
* Première version : pose de la bulle de chat, écran de réglages, lien de connexion des commandes.
