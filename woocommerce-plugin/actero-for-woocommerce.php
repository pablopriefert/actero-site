<?php
/**
 * Plugin Name:       Actero for WooCommerce
 * Plugin URI:        https://actero.fr
 * Description:       Pose l'agent SAV Actero sur votre boutique WooCommerce : la bulle de chat s'installe en un clic, sans toucher à votre thème.
 * Version:           1.0.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Requires Plugins:  woocommerce
 * Author:            Actero
 * Author URI:        https://actero.fr
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       actero-for-woocommerce
 * Domain Path:       /languages
 *
 * ------------------------------------------------------------------
 * POURQUOI CETTE EXTENSION EXISTE
 *
 * Elle ne sert PAS à lire les commandes. WooCommerce expose son API REST
 * nativement, et Actero s'en sert déjà : le flux /wc-auth/v1/authorize
 * provisionne les clés sans rien installer. Vérifié le 11 septembre 2026 —
 * api/engine/lib/woocommerce-client.js lit les commandes, et l'aiguilleur de
 * shopify-client.js y mène.
 *
 * Elle sert à deux choses que l'API ne peut pas faire :
 *
 *   1. POSER LA BULLE. Sans extension, le marchand doit coller une balise
 *      <script> dans son thème. Une mise à jour de thème l'efface, et plus
 *      aucun message ne nous parvient — sans erreur, sans rien pour le dire.
 *      C'est le défaut que le contrôle quotidien d'Actero détecte ; ici on le
 *      rend beaucoup moins probable, parce que le code ne vit plus dans le
 *      thème.
 *
 *   2. EXISTER SUR WORDPRESS.ORG. Des millions d'installations WooCommerce,
 *      un canal d'acquisition qui ne dépend de l'accord de personne.
 *
 * @package Actero
 */

defined( 'ABSPATH' ) || exit;

define( 'ACTERO_WC_VERSION', '1.0.0' );
define( 'ACTERO_WC_SITE', 'https://actero.fr' );

/**
 * Compatibilité HPOS (High-Performance Order Storage).
 *
 * Sans cette déclaration, WooCommerce affiche un avertissement d'éventuelle
 * incompatibilité sur l'écran des extensions et décourage l'activation de
 * HPOS. Cette extension ne lit ni n'écrit aucune commande — elle est donc
 * compatible par construction.
 */
add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		}
	}
);

/**
 * La clé publique du widget, telle qu'enregistrée par le marchand.
 *
 * @return string Chaîne vide si l'extension n'est pas encore configurée.
 */
function actero_wc_cle() {
	return (string) get_option( 'actero_wc_cle', '' );
}

/**
 * Pose la bulle de chat sur la boutique.
 *
 * `wp_enqueue_script` plutôt qu'un echo dans le pied de page : WordPress gère
 * alors l'ordre de chargement, le cache et la déduplication, et les extensions
 * d'optimisation savent quoi faire du script.
 */
add_action(
	'wp_enqueue_scripts',
	function () {
		$cle = actero_wc_cle();
		if ( '' === $cle || is_admin() ) {
			return;
		}

		wp_enqueue_script(
			'actero-widget',
			ACTERO_WC_SITE . '/widget.js',
			array(),
			ACTERO_WC_VERSION,
			array(
				'strategy'  => 'defer',
				'in_footer' => true,
			)
		);
	}
);

/**
 * Ajoute `data-actero-key` à la balise du widget.
 *
 * WordPress ne permet pas de passer un attribut arbitraire à
 * `wp_enqueue_script`. Le filtre est le chemin prévu pour ça, et il évite
 * d'écrire la balise à la main — donc d'oublier un échappement.
 */
add_filter(
	'script_loader_tag',
	function ( $tag, $handle ) {
		if ( 'actero-widget' !== $handle ) {
			return $tag;
		}
		$cle = actero_wc_cle();
		if ( '' === $cle ) {
			return $tag;
		}
		return str_replace(
			' src=',
			' data-actero-key="' . esc_attr( $cle ) . '" src=',
			$tag
		);
	},
	10,
	2
);

/**
 * Entrée « Actero » sous le menu WooCommerce.
 */
add_action(
	'admin_menu',
	function () {
		add_submenu_page(
			'woocommerce',
			__( 'Actero', 'actero-for-woocommerce' ),
			__( 'Actero', 'actero-for-woocommerce' ),
			'manage_woocommerce',
			'actero-wc',
			'actero_wc_page_reglages'
		);
	}
);

/**
 * Lien « Réglages » directement depuis la liste des extensions.
 */
add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $liens ) {
		$url = admin_url( 'admin.php?page=actero-wc' );
		array_unshift(
			$liens,
			'<a href="' . esc_url( $url ) . '">' . esc_html__( 'Réglages', 'actero-for-woocommerce' ) . '</a>'
		);
		return $liens;
	}
);

/**
 * Enregistre la clé soumise par le formulaire.
 *
 * Les trois motifs de rejet les plus fréquents sur WordPress.org sont la
 * sortie non échappée, l'entrée non nettoyée et l'absence de nonce. Les trois
 * sont traités ici : capacité vérifiée, nonce vérifié, valeur nettoyée.
 */
function actero_wc_enregistrer() {
	if ( ! isset( $_POST['actero_wc_nonce'] ) ) {
		return;
	}
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		return;
	}
	check_admin_referer( 'actero_wc_reglages', 'actero_wc_nonce' );

	$brut = isset( $_POST['actero_wc_cle'] ) ? wp_unslash( $_POST['actero_wc_cle'] ) : '';
	$cle  = sanitize_text_field( $brut );

	// Une clé Actero est alphanumérique, tirets et underscores admis. Refuser
	// tout le reste évite d'écrire dans un attribut HTML une valeur collée
	// depuis n'importe où — la balise entière du snippet, par exemple.
	if ( '' !== $cle && ! preg_match( '/^[A-Za-z0-9_-]{8,128}$/', $cle ) ) {
		add_settings_error(
			'actero_wc',
			'cle_invalide',
			esc_html__( 'Cette clé ne ressemble pas à une clé Actero. Copiez-la depuis Réglages → Widget dans votre tableau de bord Actero.', 'actero-for-woocommerce' ),
			'error'
		);
		return;
	}

	update_option( 'actero_wc_cle', $cle );
	add_settings_error(
		'actero_wc',
		'enregistre',
		'' === $cle
			? esc_html__( 'Clé retirée. La bulle ne s’affiche plus sur votre boutique.', 'actero-for-woocommerce' )
			: esc_html__( 'Clé enregistrée. La bulle est maintenant sur votre boutique.', 'actero-for-woocommerce' ),
		'success'
	);
}

/**
 * L'écran de réglages.
 */
function actero_wc_page_reglages() {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'Vous n’avez pas les droits nécessaires.', 'actero-for-woocommerce' ) );
	}

	actero_wc_enregistrer();

	$cle    = actero_wc_cle();
	$active = '' !== $cle;

	// La boutique est pré-remplie dans le lien vers Actero : le marchand n'a
	// pas à retaper son URL, et c'est la seule friction que cette extension
	// peut retirer du branchement des commandes.
	$lien_connexion = add_query_arg(
		array(
			'source'    => 'woocommerce',
			'store_url' => home_url(),
		),
		ACTERO_WC_SITE . '/client/int%C3%A9grations'
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Actero', 'actero-for-woocommerce' ); ?></h1>
		<?php settings_errors( 'actero_wc' ); ?>

		<p>
			<?php esc_html_e( 'Actero répond à vos clients à votre place : suivi de commande, retours, questions produit — et passe la main à un humain dès qu’il n’est pas sûr.', 'actero-for-woocommerce' ); ?>
		</p>

		<h2><?php esc_html_e( '1. La bulle de chat', 'actero-for-woocommerce' ); ?></h2>
		<p>
			<?php esc_html_e( 'Collez votre clé Actero ci-dessous. La bulle apparaîtra sur votre boutique, sans modifier votre thème.', 'actero-for-woocommerce' ); ?>
			<br />
			<a href="<?php echo esc_url( ACTERO_WC_SITE . '/client' ); ?>" target="_blank" rel="noopener noreferrer">
				<?php esc_html_e( 'Trouver ma clé dans le tableau de bord Actero', 'actero-for-woocommerce' ); ?>
			</a>
		</p>

		<form method="post" action="">
			<?php wp_nonce_field( 'actero_wc_reglages', 'actero_wc_nonce' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">
						<label for="actero_wc_cle"><?php esc_html_e( 'Clé Actero', 'actero-for-woocommerce' ); ?></label>
					</th>
					<td>
						<input
							name="actero_wc_cle"
							id="actero_wc_cle"
							type="text"
							class="regular-text code"
							value="<?php echo esc_attr( $cle ); ?>"
							placeholder="ak_..."
							autocomplete="off" />
						<p class="description">
							<?php
							echo $active
								? esc_html__( 'La bulle est active sur votre boutique.', 'actero-for-woocommerce' )
								: esc_html__( 'Aucune clé : la bulle ne s’affiche pas.', 'actero-for-woocommerce' );
							?>
						</p>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Enregistrer', 'actero-for-woocommerce' ) ); ?>
		</form>

		<h2><?php esc_html_e( '2. Les commandes', 'actero-for-woocommerce' ); ?></h2>
		<p>
			<?php esc_html_e( 'Pour qu’Actero réponde « votre commande est partie mardi », il lui faut un accès en lecture à vos commandes. Cet accès passe par WooCommerce lui-même : vous validerez la demande sur votre propre site, et vous pourrez la révoquer à tout moment depuis WooCommerce → Réglages → Avancé → API REST.', 'actero-for-woocommerce' ); ?>
		</p>
		<p>
			<a class="button button-primary" href="<?php echo esc_url( $lien_connexion ); ?>" target="_blank" rel="noopener noreferrer">
				<?php esc_html_e( 'Connecter mes commandes à Actero', 'actero-for-woocommerce' ); ?>
			</a>
		</p>

		<hr />
		<p class="description">
			<?php esc_html_e( 'Cette extension n’envoie rien à Actero par elle-même : elle ne fait que charger la bulle et vous mener au bon écran. Les accès aux commandes sont accordés par WooCommerce, pas par elle.', 'actero-for-woocommerce' ); ?>
		</p>
	</div>
	<?php
}
