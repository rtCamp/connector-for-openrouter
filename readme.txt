=== AI Provider for OpenRouter ===
Contributors:      rtcamp
Tags:              ai, openrouter, llm, connector, image-generation
Requires at least: 7.0
Requires PHP:      7.4
Requires Plugins:  ai
Stable tag:        1.0.0
License:           GPL-2.0-or-later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

OpenRouter provider for the WordPress AI Client.

== Description ==

This plugin provides OpenRouter integration for the WordPress AI Client.

It lets WordPress route AI text and image generation requests to OpenRouter with configurable defaults.

Used endpoints include:

* `GET /v1/models`
* `GET /v1/models?output_modality=image`
* `POST /v1/chat/completions` (text)
* `POST /v1/chat/completions` with `modalities=["image"]` (image)

**Features:**

* OpenRouter provider registration for WordPress AI Client
* Text generation model override from plugin settings
* Image generation model override from plugin settings
* Dedicated image model autocomplete endpoint in settings
* Image generation parsing from OpenRouter chat-completions image responses
* Settings page under **Settings > OpenRouter Settings**

== Installation ==

1. Ensure the WordPress AI plugin is installed and activated.
2. Upload plugin files to `/wp-content/plugins/ai-provider-for-openrouter/`.
3. Activate plugin through the Plugins menu in WordPress.
4. Add your OpenRouter API key in **Settings > Connectors**.
5. Configure defaults in **Settings > OpenRouter Settings**.

== Frequently Asked Questions ==

= Where do I set the OpenRouter API key? =

Set it in **Settings > Connectors** for the OpenRouter connector.

= Where do I choose the text and image models? =

Use **Settings > OpenRouter Settings**.

= Does image generation use `/images/generations`? =

No. This plugin uses `POST /v1/chat/completions` with `modalities=["image"]` for image generation.

= How do I build a release zip? =

Run `npm run plugin-zip` from the plugin root. It creates `ai-provider-for-openrouter.zip` and excludes development files from the archive.

== Development ==

* `composer run-script lint`
* `composer run-script format`
* `composer run-script phpstan`
* `npm run lint:js`
* `npm run lint:js:fix`
* `npm run plugin-zip`

== Changelog ==

= 1.0.0 =

* Initial release of the OpenRouter provider plugin.
* Added text and image model settings.
* Added OpenRouter image generation support via chat completions image modality.
