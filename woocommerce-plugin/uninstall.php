<?php
/**
 * Nettoyage à la désinstallation.
 *
 * WordPress charge ce fichier quand le marchand SUPPRIME l'extension (pas
 * quand il la désactive). Ne rien nettoyer laisserait une clé Actero dans la
 * base d'un site qui ne nous utilise plus — et un marchand qui retire une
 * extension s'attend à ce qu'elle ne laisse rien derrière elle.
 *
 * @package Actero
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'actero_wc_cle' );
