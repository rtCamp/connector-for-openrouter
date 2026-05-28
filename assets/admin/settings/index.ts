/**
 * OpenRouter Settings Models Script
 *
 * This handles the autocomplete features and model details display
 * on the OpenRouter settings page in the WordPress admin panel.
 */

import './style.scss';

// Type definitions for OpenRouter Settings structures
interface OpenRouterSettingsI18n {
	loading?: string;
	noResults?: string;
	errorLoad?: string;
	typeMore?: string;
	modelsCount?: string;
	inPrice?: string;
	outPrice?: string;
	ctx?: string;
	perMillion?: string;
	free?: string;
	na?: string;
}

interface OpenRouterSettingsGlobal {
	ajaxUrl?: string;
	imageAjaxUrl?: string;
	selectedModel?: string;
	selectedImageModel?: string;
	i18n?: OpenRouterSettingsI18n;
}

declare global {
	interface Window {
		ConnectorForOpenrouterSettings?: OpenRouterSettingsGlobal;
	}
}

interface Pricing {
	prompt?: string;
	completion?: string;
	image?: string;
	web_search?: string;
	[key: string]: string | undefined;
}

interface OpenRouterModel {
	id: string;
	name?: string;
	pricing?: Pricing;
	context_length?: number;
}

interface AjaxResponse {
	success: boolean;
	data: OpenRouterModel[] | string;
}

(function () {
	'use strict';

	// Keep track of the models loaded from the server
	let allModels: OpenRouterModel[] = [];
	let allImageModels: OpenRouterModel[] = [];
	let isLoaded = false;
	let isImageLoaded = false;

	const settings = window.ConnectorForOpenrouterSettings || {};
	const i18n = settings.i18n || {};

	/**
	 * Formats per-token or per-unit API pricing into a clean, human-readable label.
	 *
	 * Token pricing is normally multiplied by 1,000,000 so the user sees price per million tokens.
	 * Unit pricing (like images or search requests) is formatted as price per generation or request.
	 *
	 * @param priceStr Raw price string from the OpenRouter API response.
	 * @param key      Optional pricing key (e.g. 'image', 'web_search').
	 * @returns A polished label like "$0.50/1M" or "$0.02 / image".
	 */
	function formatPrice(priceStr: string | undefined, key?: string): string {
		if (!priceStr) {
			return i18n.na || 'N/A';
		}
		const price = parseFloat(priceStr);
		if (isNaN(price)) {
			return i18n.na || 'N/A';
		}
		if (price < 0) {
			return 'Unavailable';
		}
		if (price === 0) {
			return i18n.free || 'Free';
		}

		// Handle visual assets and other absolute pricing units
		if (key === 'image' || key === 'web_search') {
			const unit = key === 'image' ? ' / image' : ' / req';
			let formatted = '';
			const exponent = Math.floor(Math.log(price) / Math.LN10);
			if (exponent < 0) {
				const decimals = Math.max(2, -exponent + 2);
				const cappedDecimals = Math.min(14, decimals);
				formatted = price.toFixed(cappedDecimals);
				formatted = formatted.replace(/0+$/, '');
				if (formatted.endsWith('.')) {
					formatted = formatted + '00';
				} else {
					const parts = formatted.split('.');
					if (parts[1] && parts[1].length === 1) {
						formatted = formatted + '0';
					}
				}
			} else {
				formatted = price.toFixed(2);
			}
			return '$' + formatted + unit;
		}

		// Standard pricing is per million tokens
		const perMillion = price * 1000000;
		const formatted =
			perMillion >= 1
				? '$' + perMillion.toFixed(2)
				: '$' + perMillion.toPrecision(3);
		return formatted + (i18n.perMillion || '/1M');
	}

	/**
	 * Formats context numbers to include thousands separators for clean reading.
	 * E.g., 128000 becomes "128,000".
	 *
	 * @param n Context length number.
	 * @returns Formatted context number string.
	 */
	function formatContext(n: number): string {
		return n.toLocaleString();
	}

	/**
	 * Simple HTML escaping utility to protect against basic injection.
	 *
	 * @param str The unsafe text string.
	 * @returns An HTML-safe string.
	 */
	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/**
	 * Renders up to 5 model suggestions into the autocomplete dropdown menu.
	 *
	 * @param matches     Filtered list of models matching search keywords.
	 * @param dropdown    Dropdown DOM element.
	 * @param searchInput Autocomplete text input.
	 * @param hiddenInput Hidden field storing final saved model name.
	 * @param infoEl      Block underneath the input displaying selection details.
	 */
	function renderDropdown(
		matches: OpenRouterModel[],
		dropdown: HTMLElement,
		searchInput: HTMLInputElement,
		hiddenInput: HTMLInputElement,
		infoEl: HTMLElement
	): void {
		dropdown.innerHTML = '';

		if (matches.length === 0) {
			dropdown.style.display = 'none';
			return;
		}

		matches.forEach(function (model) {
			const modelId = typeof model.id === 'string' ? model.id : '';
			if (!modelId) {
				return;
			}

			const pricing = model.pricing || {};
			const inputPrice = formatPrice(pricing.prompt);
			const outputPrice = formatPrice(pricing.completion);
			const ctxText =
				model.context_length && typeof model.context_length === 'number'
					? formatContext(model.context_length) +
						' ' +
						(i18n.ctx || 'ctx')
					: '';
			const nameDisplay =
				model.name && model.name !== modelId ? model.name : '';

			const item = document.createElement('div');
			item.setAttribute('role', 'option');
			item.className = 'openrouter-dropdown-item';
			item.innerHTML =
				'<strong class="openrouter-dropdown-item-id">' +
				escapeHtml(modelId) +
				'</strong>' +
				(nameDisplay
					? '<span class="openrouter-dropdown-item-name">' +
						escapeHtml(nameDisplay) +
						'</span>'
					: '') +
				'<span class="openrouter-dropdown-item-meta">' +
				escapeHtml(i18n.inPrice || 'Prompt:') +
				' <strong>' +
				escapeHtml(inputPrice) +
				'</strong>' +
				'&nbsp;&nbsp;' +
				escapeHtml(i18n.outPrice || 'Completion:') +
				' <strong>' +
				escapeHtml(outputPrice) +
				'</strong>' +
				(ctxText
					? '&nbsp;&nbsp;<span class="openrouter-dropdown-item-ctx">' +
						escapeHtml(ctxText) +
						'</span>'
					: '') +
				'</span>';

			item.addEventListener('mousedown', function (e) {
				// Prevent input blur before click event resolves
				e.preventDefault();
				selectModel(model, searchInput, hiddenInput, dropdown, infoEl);
			});

			dropdown.appendChild(item);
		});

		dropdown.style.display = 'block';
	}

	/**
	 * Commits a model selection: updates the visible input, the hidden value
	 * field, and the info line below the field, then closes the dropdown.
	 * @param model
	 * @param searchInput
	 * @param hiddenInput
	 * @param dropdown
	 * @param infoEl
	 */
	function selectModel(
		model: OpenRouterModel,
		searchInput: HTMLInputElement,
		hiddenInput: HTMLInputElement,
		dropdown: HTMLElement,
		infoEl: HTMLElement
	): void {
		const modelId = typeof model.id === 'string' ? model.id : '';
		searchInput.value = modelId;
		hiddenInput.value = modelId;
		dropdown.style.display = 'none';
		renderModelInfo(model, infoEl);
	}

	/**
	 * Prettifies custom pricing keys (like prompt and completion) for user display.
	 *
	 * @param key The key to look up (e.g. prompt, completion, image).
	 * @returns Formatted label text.
	 */
	function formatPricingKey(key: string): string {
		if (key === 'prompt') {
			return (i18n.inPrice || 'Prompt:').replace(/:$/, '');
		}
		if (key === 'completion') {
			return (i18n.outPrice || 'Completion:').replace(/:$/, '');
		}
		return key
			.split('_')
			.map(function (word) {
				return word.charAt(0).toUpperCase() + word.slice(1);
			})
			.join(' ');
	}

	/**
	 * Renders detailed pricing badges and context limits below the selected input field.
	 *
	 * @param model  Active model object details, or null to clear display.
	 * @param infoEl The information target container.
	 */
	function renderModelInfo(
		model: OpenRouterModel | null,
		infoEl: HTMLElement
	): void {
		if (!model) {
			infoEl.innerHTML = '';
			return;
		}

		const pricing = model.pricing || {};
		const ctxText =
			model.context_length && typeof model.context_length === 'number'
				? formatContext(model.context_length) +
					' ' +
					(i18n.ctx || 'ctx')
				: '';

		let pricingHtml = '';
		const keys: string[] = [];

		if (pricing.prompt !== undefined) {
			keys.push('prompt');
		}
		if (pricing.completion !== undefined) {
			keys.push('completion');
		}

		Object.keys(pricing).forEach(function (key) {
			if (key !== 'prompt' && key !== 'completion') {
				keys.push(key);
			}
		});

		if (keys.length > 0) {
			pricingHtml = '<div class="openrouter-info-flex">';
			keys.forEach(function (key) {
				const label = formatPricingKey(key);
				const value = formatPrice(pricing[key], key);
				pricingHtml +=
					'<span class="openrouter-info-badge">' +
					escapeHtml(label) +
					': <strong>' +
					escapeHtml(value) +
					'</strong></span>';
			});

			if (ctxText) {
				pricingHtml +=
					'<span class="openrouter-info-ctx">' +
					escapeHtml(ctxText) +
					'</span>';
			}
			pricingHtml += '</div>';
		} else if (ctxText) {
			pricingHtml =
				'<div class="openrouter-info-simple-ctx">' +
				escapeHtml(ctxText) +
				'</div>';
		}

		infoEl.innerHTML = pricingHtml;
	}

	/**
	 * Filters the list of loaded text models and populates results inside the dropdown.
	 * @param query
	 * @param dropdown
	 * @param searchInput
	 * @param hiddenInput
	 * @param infoEl
	 */
	function filterModels(
		query: string,
		dropdown: HTMLElement,
		searchInput: HTMLInputElement,
		hiddenInput: HTMLInputElement,
		infoEl: HTMLElement
	): void {
		const matches = allModels
			.filter(function (model) {
				const id =
					typeof model.id === 'string' ? model.id.toLowerCase() : '';
				const name =
					typeof model.name === 'string'
						? model.name.toLowerCase()
						: '';
				return id.indexOf(query) !== -1 || name.indexOf(query) !== -1;
			})
			.slice(0, 5);

		renderDropdown(matches, dropdown, searchInput, hiddenInput, infoEl);
	}

	/**
	 * Filters loaded image generation models based on our active search terms.
	 * @param query
	 */
	function getImageModelMatches(query: string): OpenRouterModel[] {
		const imageModels = allImageModels;

		if (!query) {
			return imageModels;
		}

		return imageModels.filter(function (model) {
			const id =
				typeof model.id === 'string' ? model.id.toLowerCase() : '';
			const name =
				typeof model.name === 'string' ? model.name.toLowerCase() : '';
			return id.indexOf(query) !== -1 || name.indexOf(query) !== -1;
		});
	}

	/**
	 * Displays list suggestions for OpenRouter models capable of image output.
	 * @param matches
	 * @param dropdown
	 * @param imageSearchInput
	 * @param imageHiddenInput
	 * @param imageInfoEl
	 */
	function renderImageDropdown(
		matches: OpenRouterModel[],
		dropdown: HTMLElement,
		imageSearchInput: HTMLInputElement,
		imageHiddenInput: HTMLInputElement,
		imageInfoEl: HTMLElement
	): void {
		dropdown.innerHTML = '';

		if (matches.length === 0) {
			dropdown.style.display = 'none';
			return;
		}

		matches.forEach(function (model) {
			const modelId = typeof model.id === 'string' ? model.id : '';
			if (!modelId) {
				return;
			}

			const pricing = model.pricing || {};
			const inputPrice = formatPrice(pricing.prompt);
			const outputPrice = formatPrice(pricing.completion);
			const ctxText =
				model.context_length && typeof model.context_length === 'number'
					? formatContext(model.context_length) +
						' ' +
						(i18n.ctx || 'ctx')
					: '';

			const item = document.createElement('div');
			item.setAttribute('role', 'option');
			item.className = 'openrouter-dropdown-item';
			item.innerHTML =
				'<strong class="openrouter-dropdown-item-id">' +
				escapeHtml(modelId) +
				'</strong>' +
				'<span class="openrouter-dropdown-item-meta">' +
				escapeHtml(i18n.inPrice || 'Prompt:') +
				' <strong>' +
				escapeHtml(inputPrice) +
				'</strong>' +
				'&nbsp;&nbsp;' +
				escapeHtml(i18n.outPrice || 'Completion:') +
				' <strong>' +
				escapeHtml(outputPrice) +
				'</strong>' +
				(ctxText
					? '&nbsp;&nbsp;<span class="openrouter-dropdown-item-ctx">' +
						escapeHtml(ctxText) +
						'</span>'
					: '') +
				'</span>';

			item.addEventListener('mousedown', function (e) {
				e.preventDefault();
				selectModel(
					model,
					imageSearchInput,
					imageHiddenInput,
					dropdown,
					imageInfoEl
				);
			});

			dropdown.appendChild(item);
		});

		dropdown.style.display = 'block';
	}

	/**
	 * Filters image-generation models and renders appropriate suggestions.
	 * @param query
	 * @param dropdown
	 * @param imageSearchInput
	 * @param imageHiddenInput
	 * @param imageInfoEl
	 */
	function filterImageModels(
		query: string,
		dropdown: HTMLElement,
		imageSearchInput: HTMLInputElement,
		imageHiddenInput: HTMLInputElement,
		imageInfoEl: HTMLElement
	): void {
		renderImageDropdown(
			getImageModelMatches(query),
			dropdown,
			imageSearchInput,
			imageHiddenInput,
			imageInfoEl
		);
	}

	/**
	 * Fetches all available OpenRouter text models via WordPress AJAX.
	 * Once loaded, it shows a tally status and highlights details on any pre-saved selection.
	 * @param ajaxUrl
	 * @param savedModel
	 * @param statusEl
	 * @param infoEl
	 */
	function loadModels(
		ajaxUrl: string,
		savedModel: string,
		statusEl: HTMLElement,
		infoEl: HTMLElement
	): void {
		statusEl.textContent = i18n.loading || 'Loading models…';
		statusEl.className = 'openrouter-status';

		window
			.fetch(ajaxUrl, { credentials: 'same-origin' })
			.then(function (res) {
				return res.json() as Promise<AjaxResponse>;
			})
			.then(function (data) {
				if (!data.success || !Array.isArray(data.data)) {
					statusEl.textContent =
						(data.data && typeof data.data === 'string'
							? data.data
							: null) ||
						i18n.errorLoad ||
						'Could not load models.';
					statusEl.style.color = '#d63638';
					return;
				}

				allModels = data.data as OpenRouterModel[];
				isLoaded = true;

				statusEl.textContent =
					allModels.length +
					(i18n.modelsCount || ' models available.');
				statusEl.style.color = ''; // reset to stylesheet default

				// Render info badge details for the already active selection
				if (savedModel) {
					let found: OpenRouterModel | null = null;
					for (let idx = 0; idx < allModels.length; idx++) {
						if (allModels[idx].id === savedModel) {
							found = allModels[idx];
							break;
						}
					}
					renderModelInfo(found, infoEl);
				}
			})
			.catch(function () {
				statusEl.textContent =
					i18n.errorLoad || 'Could not load models.';
				statusEl.style.color = '#d63638';
			});
	}

	/**
	 * Fetches image-generation models and resolves pre-loaded pricing cards.
	 * @param imageAjaxUrl
	 * @param savedImageModel
	 * @param imageStatusEl
	 * @param imageInfoEl
	 */
	function loadImageModels(
		imageAjaxUrl: string,
		savedImageModel: string,
		imageStatusEl: HTMLElement,
		imageInfoEl: HTMLElement
	): void {
		imageStatusEl.textContent = i18n.loading || 'Loading models…';
		imageStatusEl.className = 'openrouter-status';

		window
			.fetch(imageAjaxUrl, { credentials: 'same-origin' })
			.then(function (res) {
				return res.json() as Promise<AjaxResponse>;
			})
			.then(function (data) {
				if (!data.success || !Array.isArray(data.data)) {
					imageStatusEl.textContent =
						(data.data && typeof data.data === 'string'
							? data.data
							: null) ||
						i18n.errorLoad ||
						'Could not load models.';
					imageStatusEl.style.color = '#d63638';
					return;
				}

				allImageModels = data.data as OpenRouterModel[];
				isImageLoaded = true;

				imageStatusEl.textContent =
					allImageModels.length + ' image models available.';
				imageStatusEl.style.color = ''; // reset to stylesheet default

				if (savedImageModel) {
					const selectedImageModelData =
						getImageModelMatches('').find(function (model) {
							return model.id === savedImageModel;
						}) || null;
					renderModelInfo(selectedImageModelData, imageInfoEl);
				}
			})
			.catch(function () {
				imageStatusEl.textContent =
					i18n.errorLoad || 'Could not load models.';
				imageStatusEl.style.color = '#d63638';
			});
	}

	/**
	 * Bootstraps autocompletes and layout handles once settings are loaded.
	 */
	function init(): void {
		const searchInput = document.getElementById(
			'connector_for_openrouter_settings-model-search'
		) as HTMLInputElement | null;
		const hiddenInput = document.getElementById(
			'connector_for_openrouter_settings-model-value'
		) as HTMLInputElement | null;
		const dropdown = document.getElementById('openrouter-model-dropdown');
		const infoEl = document.getElementById('openrouter-model-info');
		const statusEl = document.getElementById('openrouter-model-status');
		const imageSearchInput = document.getElementById(
			'connector_for_openrouter_settings-image-model-search'
		) as HTMLInputElement | null;
		const imageHiddenInput = document.getElementById(
			'connector_for_openrouter_settings-image-model-value'
		) as HTMLInputElement | null;
		const imageDropdown = document.getElementById(
			'openrouter-image-model-dropdown'
		);
		const imageInfoEl = document.getElementById(
			'openrouter-image-model-info'
		);
		const imageStatusEl = document.getElementById(
			'openrouter-image-model-status'
		);

		// Exit if fields aren't present on the page
		if (
			!searchInput ||
			!hiddenInput ||
			!dropdown ||
			!infoEl ||
			!statusEl ||
			!imageSearchInput ||
			!imageHiddenInput ||
			!imageDropdown ||
			!imageInfoEl ||
			!imageStatusEl
		) {
			return;
		}

		const ajaxUrl = settings.ajaxUrl || '';
		const imageAjaxUrl = settings.imageAjaxUrl || '';
		const savedModel = settings.selectedModel || '';
		const savedImageModel = settings.selectedImageModel || '';

		// Trigger model loading
		loadModels(ajaxUrl, savedModel, statusEl, infoEl);
		loadImageModels(
			imageAjaxUrl,
			savedImageModel,
			imageStatusEl,
			imageInfoEl
		);

		// Text Model inputs and events
		searchInput.addEventListener('input', function () {
			hiddenInput.value = this.value.trim();

			if (!isLoaded) {
				return;
			}

			const query = this.value.trim().toLowerCase();

			if (query.length < 3) {
				dropdown.style.display = 'none';
				return;
			}

			filterModels(query, dropdown, searchInput, hiddenInput, infoEl);
		});

		searchInput.addEventListener('blur', function () {
			// Delay a split-second to allow dropdown selection clicks to resolve first
			setTimeout(function () {
				dropdown.style.display = 'none';
			}, 150);
		});

		searchInput.addEventListener('focus', function () {
			if (!isLoaded) {
				return;
			}

			const query = this.value.trim().toLowerCase();
			if (query.length >= 3) {
				filterModels(query, dropdown, searchInput, hiddenInput, infoEl);
			}
		});

		searchInput.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') {
				dropdown.style.display = 'none';
			}
		});

		// Image Model inputs and events
		imageSearchInput.addEventListener('input', function () {
			imageHiddenInput.value = this.value.trim();

			if (!isImageLoaded) {
				return;
			}

			const query = this.value.trim().toLowerCase();
			filterImageModels(
				query,
				imageDropdown,
				imageSearchInput,
				imageHiddenInput,
				imageInfoEl
			);
		});

		imageSearchInput.addEventListener('focus', function () {
			if (!isImageLoaded) {
				imageStatusEl.textContent = i18n.loading || 'Loading models…';
				return;
			}

			imageStatusEl.textContent =
				getImageModelMatches('').length + ' image models available.';
			filterImageModels(
				this.value.trim().toLowerCase(),
				imageDropdown,
				imageSearchInput,
				imageHiddenInput,
				imageInfoEl
			);
		});

		imageSearchInput.addEventListener('blur', function () {
			setTimeout(function () {
				imageDropdown.style.display = 'none';
			}, 150);
		});

		imageSearchInput.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') {
				imageDropdown.style.display = 'none';
			}
		});
	}

	// Initialize logic when page and DOM are ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
