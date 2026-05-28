<?php
/**
 * OpenRouter Settings.
 *
 * @package rtcamp/connector-for-openrouter
 *
 * @since 1.0.0
 */

declare( strict_types=1 );

namespace rtCamp\ConnectorForOpenrouter\Settings;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


/**
 * Class for OpenRouter settings in the WordPress admin.
 *
 * @since 1.0.0
 */
class OpenRouterSettings {

	private const OPTION_GROUP        = 'connector_for_openrouter_settings';
	private const OPTION_NAME         = 'connector_for_openrouter_settings';
	private const PAGE_SLUG           = 'connector-for-openrouter';
	private const SECTION_ID          = 'connector_for_openrouter_main';
	private const AJAX_ACTION_MODELS  = 'connector_for_openrouter_models';
	private const AJAX_ACTION_IMAGE_MODELS = 'connector_for_openrouter_image_models';
	private const NONCE_ACTION        = 'connector_for_openrouter_nonce';
	private const KEY_MODEL           = 'model';
	private const KEY_IMAGE_MODEL     = 'image_model';
	private const MODELS_TRANSIENT    = 'ai_openrouter_models_v1';
	private const MODELS_IMAGE_TRANSIENT = 'ai_openrouter_image_models_v1';
	private const MODELS_CACHE_TTL    = HOUR_IN_SECONDS;
	private const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models?output_modality=text';
	private const OPENROUTER_IMAGE_MODELS_URL = 'https://openrouter.ai/api/v1/models?output_modality=image';

	/**
	 * Initializes the settings.
	 *
	 * @since 1.0.0
	 */
	public function init(): void {
		add_action( 'admin_init', [ $this, 'register_settings' ] );
		add_action( 'admin_menu', [ $this, 'register_settings_screen' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_settings_script' ] );
		add_action( 'wp_ajax_' . self::AJAX_ACTION_MODELS, [ $this, 'ajax_list_models' ] );
		add_action( 'wp_ajax_' . self::AJAX_ACTION_IMAGE_MODELS, [ $this, 'ajax_list_image_models' ] );
	}

	/**
	 * Registers the setting and fields.
	 *
	 * @since 1.0.0
	 */
	public function register_settings(): void {
		register_setting(
			self::OPTION_GROUP,
			self::OPTION_NAME,
			[
				'type'              => 'array',
				'default'           => [],
				'sanitize_callback' => [ $this, 'sanitize_settings' ],
			]
		);

		add_settings_section(
			self::SECTION_ID,
			'',
			'__return_empty_string',
			self::PAGE_SLUG
		);

		add_settings_field(
			self::OPTION_NAME . '_model',
			__( 'Default Model', 'connector-for-openrouter' ),
			[ $this, 'render_model_field' ],
			self::PAGE_SLUG,
			self::SECTION_ID,
			[ 'label_for' => self::OPTION_NAME . '-model-search' ]
		);

		add_settings_field(
			self::OPTION_NAME . '_image_model',
			__( 'Image Generation Model', 'connector-for-openrouter' ),
			[ $this, 'render_image_model_field' ],
			self::PAGE_SLUG,
			self::SECTION_ID,
			[ 'label_for' => self::OPTION_NAME . '-image-model-search' ]
		);
	}

	/**
	 * Registers the settings screen.
	 *
	 * @since 1.0.0
	 */
	public function register_settings_screen(): void {
		add_options_page(
			__( 'OpenRouter Settings', 'connector-for-openrouter' ),
			__( 'OpenRouter Settings', 'connector-for-openrouter' ),
			'manage_options',
			self::PAGE_SLUG,
			[ $this, 'render_screen' ]
		);
	}

	/**
	 * Sanitizes the settings array.
	 *
	 * @since 1.0.0
	 *
	 * @param mixed $value The input value.
	 * @return array<string, string> The sanitized settings.
	 */
	public function sanitize_settings( $value ): array {
		if ( ! is_array( $value ) ) {
			return self::get_default_settings();
		}

		$model = isset( $value[ self::KEY_MODEL ] ) ? sanitize_text_field( (string) $value[ self::KEY_MODEL ] ) : '';
		$image_model = isset( $value[ self::KEY_IMAGE_MODEL ] ) ? sanitize_text_field( (string) $value[ self::KEY_IMAGE_MODEL ] ) : '';
		$model = trim( $model );
		$image_model = trim( $image_model );

		return [
			self::KEY_MODEL       => $model,
			self::KEY_IMAGE_MODEL => $image_model,
		];
	}

	/**
	 * Renders the settings screen.
	 *
	 * @since 1.0.0
	 */
	public function render_screen(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>

		<div class="wrap" style="max-width: 50rem;">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<p>
				<?php
				printf(
					/* translators: 1: opening anchor tag, 2: closing anchor tag */
					esc_html__( 'OpenRouter provides access to hundreds of AI models through a single API. Set your API key in %1$sSettings > Connectors%2$s.', 'connector-for-openrouter' ),
					'<a href="' . esc_url( admin_url( 'options-connectors.php' ) ) . '">',
					'</a>'
				);
				?>
			</p>
			<p>
				<?php
				printf(
					/* translators: 1: opening anchor tag, 2: closing anchor tag */
					esc_html__( 'Browse available models and their pricing at %1$sopenrouter.ai/models%2$s.', 'connector-for-openrouter' ),
					'<a href="https://openrouter.ai/models" target="_blank" rel="noopener noreferrer">',
					'</a>'
				);
				?>
			</p>
			<form action="options.php" method="post">
				<?php
				settings_fields( self::OPTION_GROUP );
				do_settings_sections( self::PAGE_SLUG );
				submit_button();
				?>
			</form>
		</div>

		<?php
	}

	/**
	 * Renders the model autocomplete field.
	 *
	 * Displays a text input with an inline autocomplete dropdown. When the user
	 * types three or more characters the JavaScript layer filters the pre-loaded
	 * model list and shows up to five suggestions that include the model ID,
	 * display name, context length, and per-token pricing.
	 *
	 * @since 1.0.0
	 */
	public function render_model_field(): void {
		$settings      = self::get_settings();
		$current_model = isset( $settings[ self::KEY_MODEL ] ) ? (string) $settings[ self::KEY_MODEL ] : '';
		$input_id      = self::OPTION_NAME . '-model-search';
		$hidden_id     = self::OPTION_NAME . '-model-value';
		$hidden_name   = self::OPTION_NAME . '[' . self::KEY_MODEL . ']';
		?>

		<div id="openrouter-model-container" style="position:relative; display:inline-block; min-width:22rem;">
			<input
				type="text"
				id="<?php echo esc_attr( $input_id ); ?>"
				class="regular-text"
				placeholder="<?php esc_attr_e( 'Type 3+ letters to search models…', 'connector-for-openrouter' ); ?>"
				value="<?php echo esc_attr( $current_model ); ?>"
				autocomplete="off"
				aria-label="<?php esc_attr_e( 'Search OpenRouter models', 'connector-for-openrouter' ); ?>"
			/>
			<input
				type="hidden"
				id="<?php echo esc_attr( $hidden_id ); ?>"
				name="<?php echo esc_attr( $hidden_name ); ?>"
				value="<?php echo esc_attr( $current_model ); ?>"
			/>
			<div
				id="openrouter-model-dropdown"
				role="listbox"
				style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #8c8f94; border-top:none; border-radius:0 0 4px 4px; box-shadow:0 4px 8px rgba(0,0,0,.1); z-index:9999; max-height:320px; overflow-y:auto;"
			></div>
		</div>

		<div id="openrouter-model-info" style="margin-top:6px; font-size:12px; color:#50575e;"></div>
		<span id="openrouter-model-status" style="margin-left:8px; font-size:12px;"></span>

		<p class="description">
			<?php esc_html_e( 'Choose a default OpenRouter model override. Leave empty to use the model requested by AI Client.', 'connector-for-openrouter' ); ?>
		</p>
		<p class="description">
			<?php esc_html_e( 'Suggestions show input price, output price (per 1M tokens), and context length.', 'connector-for-openrouter' ); ?>
		</p>

		<?php
	}

	/**
	 * Renders the image generation model autocomplete field.
	 *
	 * @since 1.0.0
	 */
	public function render_image_model_field(): void {
		$settings            = self::get_settings();
		$current_image_model = isset( $settings[ self::KEY_IMAGE_MODEL ] ) ? (string) $settings[ self::KEY_IMAGE_MODEL ] : '';
		$input_id            = self::OPTION_NAME . '-image-model-search';
		$hidden_id           = self::OPTION_NAME . '-image-model-value';
		$hidden_name         = self::OPTION_NAME . '[' . self::KEY_IMAGE_MODEL . ']';
		?>

		<div id="openrouter-image-model-container" style="position:relative; display:inline-block; min-width:22rem;">
			<input
				type="text"
				id="<?php echo esc_attr( $input_id ); ?>"
				class="regular-text"
				placeholder="<?php esc_attr_e( 'Type to search image models…', 'connector-for-openrouter' ); ?>"
				value="<?php echo esc_attr( $current_image_model ); ?>"
				autocomplete="off"
				aria-label="<?php esc_attr_e( 'Search OpenRouter image generation models', 'connector-for-openrouter' ); ?>"
			/>
			<input
				type="hidden"
				id="<?php echo esc_attr( $hidden_id ); ?>"
				name="<?php echo esc_attr( $hidden_name ); ?>"
				value="<?php echo esc_attr( $current_image_model ); ?>"
			/>
			<div
				id="openrouter-image-model-dropdown"
				role="listbox"
				style="display:none; position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #8c8f94; border-top:none; border-radius:0 0 4px 4px; box-shadow:0 4px 8px rgba(0,0,0,.1); z-index:9999; max-height:320px; overflow-y:auto;"
			></div>
		</div>

		<div id="openrouter-image-model-info" style="margin-top:6px; font-size:12px; color:#50575e;"></div>
		<span id="openrouter-image-model-status" style="margin-left:8px; font-size:12px;"></span>

		<p class="description">
			<?php esc_html_e( 'Choose a dedicated image generation model. This autocomplete lists all OpenRouter models that support image output.', 'connector-for-openrouter' ); ?>
		</p>
		
		<hr />

		<p class="description" style="font-style:italic;">
			<?php esc_html_e( 'Be aware that pricing for some models is based on average text and image output, which isn\'t listed here. Please verify the exact pricing at openrouter.ai/models.', 'connector-for-openrouter' ); ?>
		</p>

		<?php
	}

	/**
	 * Enqueues the settings page script.
	 *
	 * @since 1.0.0
	 *
	 * @param string $hook_suffix The current admin page hook suffix.
	 */
	public function enqueue_settings_script( string $hook_suffix ): void {
		if ( 'settings_page_' . self::PAGE_SLUG !== $hook_suffix ) {
			return;
		}

		wp_enqueue_script(
			'connector-for-openrouter-settings',
			plugins_url( 'assets/settings-models.js', CONNECTOR_FOR_OPENROUTER_PLUGIN_FILE ),
			[],
			'1.0.0',
			true
		);

		wp_localize_script(
			'connector-for-openrouter-settings',
			'ConnectorForOpenrouterSettings',
			[
				'ajaxUrl'       => esc_url_raw(
					add_query_arg(
						[
							'action'   => self::AJAX_ACTION_MODELS,
							'_wpnonce' => wp_create_nonce( self::NONCE_ACTION ),
						],
						admin_url( 'admin-ajax.php' )
					)
				),
				'imageAjaxUrl'  => esc_url_raw(
					add_query_arg(
						[
							'action'   => self::AJAX_ACTION_IMAGE_MODELS,
							'_wpnonce' => wp_create_nonce( self::NONCE_ACTION ),
						],
						admin_url( 'admin-ajax.php' )
					)
				),
				'selectedModel' => self::get_selected_model(),
				'selectedImageModel' => self::get_selected_image_model(),
				'i18n'          => [
					'loading'     => __( 'Loading models…', 'connector-for-openrouter' ),
					'noResults'   => __( 'No models found.', 'connector-for-openrouter' ),
					'errorLoad'   => __( 'Could not load models.', 'connector-for-openrouter' ),
					'typeMore'    => __( 'Type at least 3 characters to search.', 'connector-for-openrouter' ),
					'modelsCount' => __( ' models available.', 'connector-for-openrouter' ),
					'inPrice'     => __( 'Prompt:', 'connector-for-openrouter' ),
					'outPrice'    => __( 'Completion:', 'connector-for-openrouter' ),
					'ctx'         => __( 'ctx', 'connector-for-openrouter' ),
					'perMillion'  => __( '/1M', 'connector-for-openrouter' ),
					'free'        => __( 'Free', 'connector-for-openrouter' ),
					'na'          => __( 'N/A', 'connector-for-openrouter' ),
				],
			]
		);
	}

	/**
	 * Handles the AJAX request to list available OpenRouter models with pricing.
	 *
	 * Results are cached for one hour using WordPress transients to avoid
	 * hammering the OpenRouter API on every settings page load.
	 *
	 * @since 1.0.0
	 */
	public function ajax_list_models(): void {
		check_ajax_referer( self::NONCE_ACTION );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( __( 'Insufficient permissions.', 'connector-for-openrouter' ), 403 );
		}

		$cached = get_transient( self::MODELS_TRANSIENT );
		if ( false !== $cached && is_array( $cached ) ) {
			wp_send_json_success( $cached );
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get -- External request to OpenRouter public models endpoint.
		$response = wp_remote_get(
			self::OPENROUTER_MODELS_URL,
			[
				// phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- OpenRouter model listing may be slow on first request.
				'timeout' => 15,
				'headers' => [
					'Accept' => 'application/json',
				],
			]
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				sprintf(
					/* translators: %s: Error message. */
					__( 'Could not fetch OpenRouter models. Error: %s', 'connector-for-openrouter' ),
					$response->get_error_message()
				),
				500
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( ! is_array( $data ) || ! isset( $data['data'] ) || ! is_array( $data['data'] ) ) {
			wp_send_json_error( __( 'Unexpected response from OpenRouter models endpoint.', 'connector-for-openrouter' ), 500 );
		}

		$models = array_values(
			array_filter(
				$data['data'],
				static function ( $model ) {
					return is_array( $model ) && isset( $model['id'] ) && is_string( $model['id'] ) && '' !== trim( $model['id'] );
				}
			)
		);

		set_transient( self::MODELS_TRANSIENT, $models, self::MODELS_CACHE_TTL );

		wp_send_json_success( $models );
	}

	/**
	 * Handles the AJAX request to list image generation OpenRouter models.
	 *
	 * Uses the filtered OpenRouter endpoint:
	 * /api/v1/models?output_modality=image&pricing=0
	 *
	 * @since 1.0.0
	 */
	public function ajax_list_image_models(): void {
		check_ajax_referer( self::NONCE_ACTION );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( __( 'Insufficient permissions.', 'connector-for-openrouter' ), 403 );
		}

		$cached = get_transient( self::MODELS_IMAGE_TRANSIENT );
		if ( false !== $cached && is_array( $cached ) ) {
			wp_send_json_success( $cached );
		}

		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get -- External request to OpenRouter public models endpoint.
		$response = wp_remote_get(
			self::OPENROUTER_IMAGE_MODELS_URL,
			[
				// phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout -- OpenRouter model listing may be slow on first request.
				'timeout' => 15,
				'headers' => [
					'Accept' => 'application/json',
				],
			]
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				sprintf(
					/* translators: %s: Error message. */
					__( 'Could not fetch OpenRouter image models. Error: %s', 'connector-for-openrouter' ),
					$response->get_error_message()
				),
				500
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( ! is_array( $data ) || ! isset( $data['data'] ) || ! is_array( $data['data'] ) ) {
			wp_send_json_error( __( 'Unexpected response from OpenRouter image models endpoint.', 'connector-for-openrouter' ), 500 );
		}

		$models = array_values(
			array_filter(
				$data['data'],
				static function ( $model ) {
					return is_array( $model ) && isset( $model['id'] ) && is_string( $model['id'] ) && '' !== trim( $model['id'] );
				}
			)
		);

		set_transient( self::MODELS_IMAGE_TRANSIENT, $models, self::MODELS_CACHE_TTL );

		wp_send_json_success( $models );
	}

	/**
	 * Returns the currently selected model from settings.
	 *
	 * @since 1.0.0
	 *
	 * @return string The model identifier, or an empty string if none is set.
	 */
	public static function get_selected_model(): string {
		$settings = self::get_settings();
		$model    = ! empty( $settings[ self::KEY_MODEL ] ) ? (string) $settings[ self::KEY_MODEL ] : 'openrouter/free';
		return trim( $model );
	}

	/**
	 * Returns the currently selected image generation model from settings.
	 *
	 * @since 1.0.0
	 *
	 * @return string The image model identifier, or an empty string if none is set.
	 */
	public static function get_selected_image_model(): string {
		$settings    = self::get_settings();
		$image_model = ! empty( $settings[ self::KEY_IMAGE_MODEL ] ) ? (string) $settings[ self::KEY_IMAGE_MODEL ] : 'openrouter/auto';
		return trim( $image_model );
	}

	/**
	 * Gets settings from the WordPress option.
	 *
	 * @since 1.0.0
	 *
	 * @return array<string, string> The settings.
	 */
	public static function get_settings(): array {
		$settings = (array) get_option( self::OPTION_NAME, [] );

		return array_merge( self::get_default_settings(), $settings );
	}

	/**
	 * Returns the default settings array.
	 *
	 * @since 1.0.0
	 *
	 * @return array<string, string> Default settings.
	 */
	private static function get_default_settings(): array {
		return [
			self::KEY_MODEL       => '',
			self::KEY_IMAGE_MODEL => '',
		];
	}
}
