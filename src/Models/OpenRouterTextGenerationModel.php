<?php
/**
 * OpenRouter Text Generation Model.
 *
 * @package rtcamp/ai-provider-for-openrouter
 *
 * @since 1.0.0
 */

declare( strict_types=1 );

namespace rtCamp\AiProviderForOpenRouter\Models;

use rtCamp\AiProviderForOpenRouter\Provider\OpenRouterProvider;
use rtCamp\AiProviderForOpenRouter\Settings\OpenRouterSettings;
use WordPress\AiClient\Providers\Http\DTO\Request;
use WordPress\AiClient\Providers\Http\Enums\HttpMethodEnum;
use WordPress\AiClient\Providers\OpenAiCompatibleImplementation\AbstractOpenAiCompatibleTextGenerationModel;

/**
 * Class for an OpenRouter text generation model.
 *
 * Extends the OpenAI-compatible base class since OpenRouter exposes the
 * standard /v1/chat/completions endpoint. This class overrides request
 * creation to target the OpenRouter API base URL and injects the optional
 * model override from plugin settings.
 *
 * @since 1.0.0
 */
class OpenRouterTextGenerationModel extends AbstractOpenAiCompatibleTextGenerationModel {

	/**
	 * {@inheritDoc}
	 *
	 * Overrides the model ID with the settings selection when the user has
	 * configured a default model in the plugin settings page.
	 *
	 * @since 1.0.0
	 *
	 * @param array $prompt Prompt messages.
	 * @phpstan-param list<\WordPress\AiClient\Messages\DTO\Message> $prompt
	 * @return array<string, mixed>
	 */
	protected function prepareGenerateTextParams( array $prompt ): array {
		$params = parent::prepareGenerateTextParams( $prompt );

		$selected_model = OpenRouterSettings::get_selected_model();
		if ( '' !== $selected_model ) {
			$params['model'] = $selected_model;
		}

		return apply_filters( 'openrouter_text_generation_params', $params );
	}

	/**
	 * Creates an HTTP request targeted at the OpenRouter API.
	 *
	 * Adds the HTTP-Referer and X-Title headers that OpenRouter uses for
	 * attribution and rate-limit bucketing.
	 *
	 * @since 1.0.0
	 *
	 * @param \WordPress\AiClient\Providers\Http\Enums\HttpMethodEnum $method  The HTTP method.
	 * @param string                                                  $path    The API endpoint path (e.g. "chat/completions").
	 * @param array<string, string|list<string>>                      $headers Additional headers.
	 * @param mixed                                                   $data    The request body.
	 */
	protected function createRequest(
		HttpMethodEnum $method,
		string $path,
		array $headers = [],
		$data = null
	): Request {
		$headers['HTTP-Referer'] = home_url();
		$headers['X-Title']      = get_bloginfo( 'name' );

		$url = OpenRouterProvider::url( '/' . ltrim( $path, '/' ) );

		return new Request(
			$method,
			$url,
			$headers,
			$data,
			$this->getRequestOptions()
		);
	}
}
