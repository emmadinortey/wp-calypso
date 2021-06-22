<?php
/**
 * Logmein
 *
 * @package A8C\FSE
 */

namespace A8C\FSE;

add_action( 'init', __NAMESPACE__ . '\logmein_init' );
function logmein_init() {
	static $once = false;
	if ( ! $once ) {
		$once = true;
		add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\logmein_enqueue', 100 );
	}
}

function logmein_enqueue() {
	$asset_file          = include __DIR__ . '/dist/logmein.asset.php';
	$script_dependencies = $asset_file['dependencies'];
	$version             = $asset_file['version'];

	wp_enqueue_script(
		'wpcom-logmein',
		plugins_url( 'dist/logmein.js', __FILE__ ),
		is_array( $script_dependencies ) ? $script_dependencies : array(),
		$version,
		true
	);
}
