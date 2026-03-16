# AI Provider for OpenRouter

OpenRouter provider for the PHP and WordPress AI Client packages.

## Overview

This plugin provides OpenRouter integration for the WordPress AI Client stack.

It registers OpenRouter as an AI provider and supports:

- Text generation through OpenRouter
- Image generation through OpenRouter
- WordPress admin settings for selecting dedicated default text and image models

OpenRouter is used via its OpenAI-compatible APIs under:

- https://openrouter.ai/api/v1

Key endpoints used by this plugin:

- GET /models (settings autocomplete)
- GET /models?output_modality=image (image settings autocomplete)
- POST /chat/completions (text generation)
- POST /chat/completions with modalities=["image"] (image generation)

## Requirements

- PHP 7.4+
- WordPress 7.0+
- WordPress AI plugin (connector/AI client integration) active
- OpenRouter API key configured in WordPress Connectors settings

## Installation

### As a WordPress plugin

1. Ensure the WordPress AI plugin is installed and activated.
2. Place this plugin in wp-content/plugins/ai-provider-for-openrouter.
3. Activate AI Provider for OpenRouter from the Plugins screen.
4. Configure your OpenRouter API key in Settings > Connectors.
5. Configure default models in Settings > OpenRouter Settings.

### As a Composer package

```bash
composer require rtcamp/ai-provider-for-openrouter
```

## Configuration

### Connectors API key

Set OpenRouter credentials in:

- Settings > Connectors

The provider is considered configured only when authentication exists in the AI client registry.

### OpenRouter Settings page

Set defaults in:

- Settings > OpenRouter Settings

Available fields:

- Default Model: default text model override
- Image Generation Model: dedicated image generation model override

## How model selection works

The metadata directory currently exposes only the two models saved in plugin settings:

- Selected text model
- Selected image model

If both fields point to the same model ID, that single model is exposed with combined capabilities.

## Image generation behavior

Image generation is sent through OpenRouter chat completions with image modality:

```json
{
	"model": "your-image-model",
	"messages": [
		{
			"role": "user",
			"content": "Generate an image"
		}
	],
	"modalities": ["image"]
}
```

The image model class parses image output from:

- choices[].message.images[].image_url.url

and keeps a fallback parser for legacy images response formats.

## Environment overrides

- OPENROUTER_BASE_URL: override API base URL (default: https://openrouter.ai/api/v1)
- OPENROUTER_API_KEY: optional auth source when registry auth is not yet injected

## Development

### PHP scripts

```bash
composer run-script lint
composer run-script format
composer run-script phpstan
```

### JS scripts

```bash
npm run lint:js
npm run lint:js:fix
```

### Combined lint

```bash
npm run lint
```

### Build release zip

```bash
npm run plugin-zip
```

This creates `ai-provider-for-openrouter.zip` in the plugin root and excludes development-only files.

## Support

- Issues: https://github.com/rtcamp/ai-provider-for-openrouter/issues
- Source: https://github.com/rtcamp/ai-provider-for-openrouter
