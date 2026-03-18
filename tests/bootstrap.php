<?php
/**
 * PHPUnit bootstrap for AI Provider for OpenRouter.
 *
 * @package rtcamp/ai-provider-for-openrouter
 *
 * phpcs:disable WordPressVIPMinimum.Files.IncludingFile.UsingVariable
 */

define( 'TESTS_REPO_ROOT_DIR', dirname( __DIR__ ) );

// Load Composer dependencies if applicable.
if ( file_exists( TESTS_REPO_ROOT_DIR . '/vendor/autoload.php' ) ) {
	require_once TESTS_REPO_ROOT_DIR . '/vendor/autoload.php';
}

// Detect where to load the WordPress tests environment from.
if ( false !== getenv( 'WP_TESTS_DIR' ) ) {
	$_test_root = getenv( 'WP_TESTS_DIR' );
} elseif ( false !== getenv( 'WP_DEVELOP_DIR' ) ) {
	$_test_root = getenv( 'WP_DEVELOP_DIR' ) . '/tests/phpunit';
} elseif ( false !== getenv( 'WP_PHPUNIT__DIR' ) ) {
	$_test_root = getenv( 'WP_PHPUNIT__DIR' );
} elseif ( file_exists( TESTS_REPO_ROOT_DIR . '/../../../../../tests/phpunit/includes/functions.php' ) ) {
	$_test_root = TESTS_REPO_ROOT_DIR . '/../../../../../tests/phpunit';
} else { // Fallback.
	$_test_root = '/tmp/wordpress-tests-lib';
}

// Give access to tests_add_filter() function.
require_once $_test_root . '/includes/functions.php';

// Activate the ai plugin first (required dependency), then this plugin.
tests_add_filter(
	'muplugins_loaded',
	static function (): void {
		$plugins_dir = dirname( TESTS_REPO_ROOT_DIR );
		// Load the required `ai` plugin before openrouter so its hooks/classes are available.
		if ( file_exists( $plugins_dir . '/ai/ai.php' ) ) {
			require_once $plugins_dir . '/ai/ai.php';
		}
		require_once TESTS_REPO_ROOT_DIR . '/ai-provider-for-openrouter.php';
	}
);

// Start up the WP testing environment.
require $_test_root . '/includes/bootstrap.php';
