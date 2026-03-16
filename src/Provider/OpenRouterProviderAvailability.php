<?php
/**
 * OpenRouter Provider Availability.
 *
 * @package rtcamp/ai-provider-for-openrouter
 *
 * @since 1.0.0
 */

declare( strict_types=1 );

namespace rtCamp\AiProviderForOpenRouter\Provider;

use WordPress\AiClient\Providers\Contracts\ProviderAvailabilityInterface;

/**
 * Availability check for the OpenRouter provider.
 *
 * @since 1.0.0
 */
class OpenRouterProviderAvailability implements ProviderAvailabilityInterface {

	/**
	 * {@inheritDoc}
	 *
	 * OpenRouter is considered configured when an API key has been registered
	 * via Settings > Connectors. Without a key requests will fail, but model
	 * listing from the public /v1/models endpoint still works.
	 *
	 * @since 1.0.0
	 */
	public function isConfigured(): bool {
		if ( ! class_exists( \WordPress\AiClient\AiClient::class ) ) {
			return false;
		}

		$registry = \WordPress\AiClient\AiClient::defaultRegistry();

		if ( ! $registry->hasProvider( 'openrouter' ) ) {
			return false;
		}

		return null !== $registry->getProviderRequestAuthentication( 'openrouter' );
	}
}
