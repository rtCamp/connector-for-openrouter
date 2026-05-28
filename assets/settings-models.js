/** global ConnectorForOpenrouterSettings */

( function() {
	'use strict';

	/** @type {Array} All models fetched from the server. */
	let allModels = [];
	/** @type {Array} Image generation models fetched from the image endpoint. */
	let allImageModels = [];
	let isLoaded = false;
	let isImageLoaded = false;

	const settings = window.ConnectorForOpenrouterSettings || {};
	const i18n = settings.i18n || {};

	/**
	 * Formats a per-token or per-unit price string from OpenRouter into a human-readable
	 * label. Prices for tokens are multiplied by 1,000,000 to express them per 1M tokens.
	 * Prices for absolute units (like image or web search) are displayed directly.
	 *
	 * @param {string|undefined} priceStr Raw price value from the API.
	 * @param {string|undefined} key      The dictionary key of this price (e.g. 'image', 'web_search').
	 * @return {string} Formatted price label.
	 */
	function formatPrice( priceStr, key ) {
		if ( ! priceStr ) {
			return i18n.na || 'N/A';
		}
		const price = parseFloat( priceStr );
		if ( isNaN( price ) ) {
			return i18n.na || 'N/A';
		}
		if ( price < 0 ) {
			return 'Unavailable';
		}
		if ( price === 0 ) {
			return i18n.free || 'Free';
		}

		if ( key === 'image' || key === 'web_search' ) {
			const unit = key === 'image' ? ' / image' : ' / req';
			let formatted = '';
			const exponent = Math.floor( Math.log( price ) / Math.LN10 );
			if ( exponent < 0 ) {
				const decimals = Math.max( 2, -exponent + 2 );
				const cappedDecimals = Math.min( 14, decimals );
				formatted = price.toFixed( cappedDecimals );
				formatted = formatted.replace( /0+$/, '' );
				if ( formatted.endsWith( '.' ) ) {
					formatted = formatted + '00';
				} else {
					const parts = formatted.split( '.' );
					if ( parts[ 1 ] && parts[ 1 ].length === 1 ) {
						formatted = formatted + '0';
					}
				}
			} else {
				formatted = price.toFixed( 2 );
			}
			return '$' + formatted + unit;
		}

		const perMillion = price * 1000000;
		const formatted =
			perMillion >= 1
				? '$' + perMillion.toFixed( 2 )
				: '$' + perMillion.toPrecision( 3 );
		return formatted + ( i18n.perMillion || '/1M' );
	}

	/**
	 * Formats a large integer (context length) with thousands separators.
	 *
	 * @param {number} n Context length value.
	 * @return {string} Formatted string (e.g. "128,000").
	 */
	function formatContext( n ) {
		return n.toLocaleString();
	}

	/**
	 * Escapes a string for safe insertion as text content (defence-in-depth;
	 * note that we use textContent / setAttribute rather than innerHTML where
	 * possible, but the label spans are built via innerHTML).
	 *
	 * @param {string} str Raw string.
	 * @return {string} HTML-escaped string.
	 */
	function escapeHtml( str ) {
		return str
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#39;' );
	}

	/**
	 * Builds and displays up to five autocomplete suggestions in the dropdown.
	 *
	 * Each suggestion includes the model ID, display name (if different),
	 * context length, and input / output pricing.
	 *
	 * @param {Array}   matches     Filtered model objects to render.
	 * @param {Element} dropdown    The dropdown container element.
	 * @param {Element} searchInput Text input element.
	 * @param {Element} hiddenInput Hidden input element that holds the saved value.
	 * @param {Element} infoEl      Element that shows the selected model pricing.
	 */
	function renderDropdown( matches, dropdown, searchInput, hiddenInput, infoEl ) {
		dropdown.innerHTML = '';

		if ( matches.length === 0 ) {
			dropdown.style.display = 'none';
			return;
		}

		matches.forEach( function( model ) {
			const modelId = typeof model.id === 'string' ? model.id : '';
			if ( ! modelId ) {
				return;
			}

			const pricing = model.pricing || {};
			const inputPrice = formatPrice( pricing.prompt );
			const outputPrice = formatPrice( pricing.completion );
			const ctxText =
				model.context_length && typeof model.context_length === 'number'
					? formatContext( model.context_length ) + ' ' + ( i18n.ctx || 'ctx' )
					: '';
			const nameDisplay =
				model.name && model.name !== modelId ? model.name : '';

			const item = document.createElement( 'div' );
			item.setAttribute( 'role', 'option' );
			item.style.cssText =
				'padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f1;' +
				'transition:background .1s;';
			item.innerHTML =
				'<strong style="display:block;font-size:13px;line-height:1.4;">' +
				escapeHtml( modelId ) +
				'</strong>' +
				( nameDisplay
					? '<span style="display:block;font-size:11px;color:#646970;margin-bottom:2px;">' +
					escapeHtml( nameDisplay ) +
					'</span>'
					: '' ) +
				'<span style="font-size:11px;color:#50575e;">' +
				escapeHtml( i18n.inPrice || 'Prompt:' ) +
				' <strong>' +
				escapeHtml( inputPrice ) +
				'</strong>' +
				'&nbsp;&nbsp;' +
				escapeHtml( i18n.outPrice || 'Completion:' ) +
				' <strong>' +
				escapeHtml( outputPrice ) +
				'</strong>' +
				( ctxText
					? '&nbsp;&nbsp;<span style="color:#8c8f94;">' +
					escapeHtml( ctxText ) +
					'</span>'
					: '' ) +
				'</span>';

			item.addEventListener( 'mouseenter', function() {
				item.style.background = '#f6f7f7';
			} );
			item.addEventListener( 'mouseleave', function() {
				item.style.background = '';
			} );
			item.addEventListener( 'mousedown', function( e ) {
				// Prevent blur from firing on the text input before click.
				e.preventDefault();
				selectModel( model, searchInput, hiddenInput, dropdown, infoEl );
			} );

			dropdown.appendChild( item );
		} );

		dropdown.style.display = 'block';
	}

	/**
	 * Commits a model selection: updates the visible input, the hidden value
	 * field, and the info line below the field, then closes the dropdown.
	 *
	 * @param {Object}  model       The selected model object.
	 * @param {Element} searchInput Text input element.
	 * @param {Element} hiddenInput Hidden input that stores the posted value.
	 * @param {Element} dropdown    Dropdown container.
	 * @param {Element} infoEl      Element that shows selected-model pricing.
	 */
	function selectModel( model, searchInput, hiddenInput, dropdown, infoEl ) {
		const modelId = typeof model.id === 'string' ? model.id : '';
		searchInput.value = modelId;
		hiddenInput.value = modelId;
		dropdown.style.display = 'none';
		renderModelInfo( model, infoEl );
	}

	/**
	 * Formats a pricing dictionary key into a readable label.
	 *
	 * @param {string} key Raw pricing key.
	 * @return {string} Beautified key.
	 */
	function formatPricingKey( key ) {
		if ( key === 'prompt' ) {
			return ( i18n.inPrice || 'Prompt:' ).replace( /:$/, '' );
		}
		if ( key === 'completion' ) {
			return ( i18n.outPrice || 'Completion:' ).replace( /:$/, '' );
		}
		return key
			.split( '_' )
			.map( function( word ) {
				return word.charAt( 0 ).toUpperCase() + word.slice( 1 );
			} )
			.join( ' ' );
	}

	/**
	 * Renders a brief pricing / context summary below the input for the
	 * currently selected model.
	 *
	 * @param {Object|null} model  The model object, or null to clear the info.
	 * @param {Element}     infoEl Container element.
	 */
	function renderModelInfo( model, infoEl ) {
		if ( ! model ) {
			infoEl.innerHTML = '';
			return;
		}

		const pricing = model.pricing || {};
		const ctxText =
			model.context_length && typeof model.context_length === 'number'
				? formatContext( model.context_length ) + ' ' + ( i18n.ctx || 'ctx' )
				: '';

		let pricingHtml = '';
		const keys = [];

		if ( pricing.prompt !== undefined ) {
			keys.push( 'prompt' );
		}
		if ( pricing.completion !== undefined ) {
			keys.push( 'completion' );
		}

		Object.keys( pricing ).forEach( function( key ) {
			if ( key !== 'prompt' && key !== 'completion' ) {
				keys.push( key );
			}
		} );

		if ( keys.length > 0 ) {
			pricingHtml = '<div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:8px; font-size:11px; color:#646970;">';
			keys.forEach( function( key ) {
				const label = formatPricingKey( key );
				const value = formatPrice( pricing[ key ], key );
				pricingHtml +=
					'<span style="background:#f0f0f1; padding:2px 6px; border-radius:3px; border:1px solid #dcdcde;">' +
					escapeHtml( label ) +
					': <strong>' +
					escapeHtml( value ) +
					'</strong></span>';
			} );

			if ( ctxText ) {
				pricingHtml +=
					'<span style="padding:2px 0; color:#8c8f94; font-size:11px; align-self:center; margin-left:4px;">' +
					escapeHtml( ctxText ) +
					'</span>';
			}
			pricingHtml += '</div>';
		} else if ( ctxText ) {
			pricingHtml =
				'<div style="margin-top:6px; font-size:11px; color:#8c8f94;">' +
				escapeHtml( ctxText ) +
				'</div>';
		}

		infoEl.innerHTML = pricingHtml;
	}

	/**
	 * Filters the pre-loaded model list and renders up to five matches.
	 *
	 * @param {string}  query       Normalised search term (lower-case).
	 * @param {Element} dropdown    Dropdown container element.
	 * @param {Element} searchInput Text input element.
	 * @param {Element} hiddenInput Hidden input element.
	 * @param {Element} infoEl      Pricing info element.
	 */
	function filterModels( query, dropdown, searchInput, hiddenInput, infoEl ) {
		const matches = allModels
			.filter( function( model ) {
				const id =
					typeof model.id === 'string' ? model.id.toLowerCase() : '';
				const name =
					typeof model.name === 'string'
						? model.name.toLowerCase()
						: '';
				return id.indexOf( query ) !== -1 || name.indexOf( query ) !== -1;
			} )
			.slice( 0, 5 );

		renderDropdown( matches, dropdown, searchInput, hiddenInput, infoEl );
	}

	/**
	 * Filters image generation models and optionally applies a text query.
	 *
	 * @param {string} query Search term (lower-case).
	 * @return {Array} Image-capable models.
	 */
	function getImageModelMatches( query ) {
		const imageModels = allImageModels;

		if ( ! query ) {
			return imageModels;
		}

		return imageModels.filter( function( model ) {
			const id = typeof model.id === 'string' ? model.id.toLowerCase() : '';
			const name = typeof model.name === 'string' ? model.name.toLowerCase() : '';
			return id.indexOf( query ) !== -1 || name.indexOf( query ) !== -1;
		} );
	}

	/**
	 * Renders autocomplete suggestions for image generation models.
	 *
	 * @param {Array}   matches          Filtered image models to render.
	 * @param {Element} dropdown         Dropdown container element.
	 * @param {Element} imageSearchInput Image search input element.
	 * @param {Element} imageHiddenInput Hidden input for saved image model value.
	 * @param {Element} imageInfoEl      Element showing selected model info.
	 */
	function renderImageDropdown( matches, dropdown, imageSearchInput, imageHiddenInput, imageInfoEl ) {
		dropdown.innerHTML = '';

		if ( matches.length === 0 ) {
			dropdown.style.display = 'none';
			return;
		}

		matches.forEach( function( model ) {
			const modelId = typeof model.id === 'string' ? model.id : '';
			if ( ! modelId ) {
				return;
			}

			const pricing = model.pricing || {};
			const inputPrice = formatPrice( pricing.prompt );
			const outputPrice = formatPrice( pricing.completion );
			const ctxText =
				model.context_length && typeof model.context_length === 'number'
					? formatContext( model.context_length ) + ' ' + ( i18n.ctx || 'ctx' )
					: '';

			const item = document.createElement( 'div' );
			item.setAttribute( 'role', 'option' );
			item.style.cssText =
				'padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f1;' +
				'transition:background .1s;';
			item.innerHTML =
				'<strong style="display:block;font-size:13px;line-height:1.4;">' +
				escapeHtml( modelId ) +
				'</strong>' +
				'<span style="font-size:11px;color:#50575e;">' +
				escapeHtml( i18n.inPrice || 'Prompt:' ) +
				' <strong>' +
				escapeHtml( inputPrice ) +
				'</strong>' +
				'&nbsp;&nbsp;' +
				escapeHtml( i18n.outPrice || 'Completion:' ) +
				' <strong>' +
				escapeHtml( outputPrice ) +
				'</strong>' +
				( ctxText
					? '&nbsp;&nbsp;<span style="color:#8c8f94;">' + escapeHtml( ctxText ) + '</span>'
					: '' ) +
				'</span>';

			item.addEventListener( 'mouseenter', function() {
				item.style.background = '#f6f7f7';
			} );
			item.addEventListener( 'mouseleave', function() {
				item.style.background = '';
			} );
			item.addEventListener( 'mousedown', function( e ) {
				e.preventDefault();
				selectModel( model, imageSearchInput, imageHiddenInput, dropdown, imageInfoEl );
			} );

			dropdown.appendChild( item );
		} );

		dropdown.style.display = 'block';
	}

	/**
	 * Filters and renders image model suggestions.
	 *
	 * @param {string}  query            Search term (lower-case).
	 * @param {Element} dropdown         Dropdown container element.
	 * @param {Element} imageSearchInput Image search input element.
	 * @param {Element} imageHiddenInput Hidden input for saved image model value.
	 * @param {Element} imageInfoEl      Element showing selected model info.
	 */
	function filterImageModels( query, dropdown, imageSearchInput, imageHiddenInput, imageInfoEl ) {
		renderImageDropdown(
			getImageModelMatches( query ),
			dropdown,
			imageSearchInput,
			imageHiddenInput,
			imageInfoEl,
		);
	}

	/**
	 * Loads model data from the WordPress AJAX endpoint, stores the result in
	 * `allModels`, and updates the status indicator.
	 *
	 * @param {string}  ajaxUrl    URL of the AJAX endpoint.
	 * @param {string}  savedModel Currently saved model ID (may be empty).
	 * @param {Element} statusEl   Status text element.
	 * @param {Element} infoEl     Pricing info element.
	 */
	function loadModels( ajaxUrl, savedModel, statusEl, infoEl ) {
		statusEl.textContent = i18n.loading || 'Loading models…';
		statusEl.style.color = '#50575e';

		window
			.fetch( ajaxUrl, { credentials: 'same-origin' } )
			.then( function( res ) {
				return res.json();
			} )
			.then( function( data ) {
				if ( ! data.success || ! Array.isArray( data.data ) ) {
					statusEl.textContent =
						( data.data && typeof data.data === 'string'
							? data.data
							: null ) ||
						i18n.errorLoad ||
						'Could not load models.';
					statusEl.style.color = '#d63638';
					return;
				}

				allModels = data.data;
				isLoaded = true;

				statusEl.textContent =
					allModels.length + ( i18n.modelsCount || ' models available.' );
				statusEl.style.color = '#50575e';

				// Show info for the initially saved model.
				if ( savedModel ) {
					let found = null;
					for ( let idx = 0; idx < allModels.length; idx++ ) {
						if ( allModels[ idx ].id === savedModel ) {
							found = allModels[ idx ];
							break;
						}
					}
					renderModelInfo( found, infoEl );
				}
			} )
			.catch( function() {
				statusEl.textContent = i18n.errorLoad || 'Could not load models.';
				statusEl.style.color = '#d63638';
			} );
	}

	/**
	 * Loads image models from the dedicated OpenRouter image-models endpoint.
	 *
	 * @param {string}  imageAjaxUrl    URL of the image-model AJAX endpoint.
	 * @param {string}  savedImageModel Currently saved image model ID.
	 * @param {Element} imageStatusEl   Image status text element.
	 * @param {Element} imageInfoEl     Image pricing info element.
	 */
	function loadImageModels( imageAjaxUrl, savedImageModel, imageStatusEl, imageInfoEl ) {
		imageStatusEl.textContent = i18n.loading || 'Loading models…';
		imageStatusEl.style.color = '#50575e';

		window
			.fetch( imageAjaxUrl, { credentials: 'same-origin' } )
			.then( function( res ) {
				return res.json();
			} )
			.then( function( data ) {
				if ( ! data.success || ! Array.isArray( data.data ) ) {
					imageStatusEl.textContent =
						( data.data && typeof data.data === 'string'
							? data.data
							: null ) ||
						i18n.errorLoad ||
						'Could not load models.';
					imageStatusEl.style.color = '#d63638';
					return;
				}

				allImageModels = data.data;
				isImageLoaded = true;

				imageStatusEl.textContent = allImageModels.length + ' image models available.';
				imageStatusEl.style.color = '#50575e';

				if ( savedImageModel ) {
					const selectedImageModelData = getImageModelMatches( '' ).find( function( model ) {
						return model.id === savedImageModel;
					} ) || null;
					renderModelInfo( selectedImageModelData, imageInfoEl );
				}
			} )
			.catch( function() {
				imageStatusEl.textContent = i18n.errorLoad || 'Could not load models.';
				imageStatusEl.style.color = '#d63638';
			} );
	}

	/**
	 * Bootstraps autocomplete behaviour once the DOM is ready.
	 */
	function init() {
		const searchInput = document.getElementById(
			'connector_for_openrouter_settings-model-search',
		);
		const hiddenInput = document.getElementById(
			'connector_for_openrouter_settings-model-value',
		);
		const dropdown = document.getElementById( 'openrouter-model-dropdown' );
		const infoEl = document.getElementById( 'openrouter-model-info' );
		const statusEl = document.getElementById( 'openrouter-model-status' );
		const imageSearchInput = document.getElementById(
			'connector_for_openrouter_settings-image-model-search',
		);
		const imageHiddenInput = document.getElementById(
			'connector_for_openrouter_settings-image-model-value',
		);
		const imageDropdown = document.getElementById( 'openrouter-image-model-dropdown' );
		const imageInfoEl = document.getElementById( 'openrouter-image-model-info' );
		const imageStatusEl = document.getElementById( 'openrouter-image-model-status' );

		if ( ! searchInput || ! hiddenInput || ! dropdown || ! infoEl || ! statusEl || ! imageSearchInput || ! imageHiddenInput || ! imageDropdown || ! imageInfoEl || ! imageStatusEl ) {
			return;
		}

		const ajaxUrl = settings.ajaxUrl || '';
		const imageAjaxUrl = settings.imageAjaxUrl || '';
		const savedModel = settings.selectedModel || '';
		const savedImageModel = settings.selectedImageModel || '';
		imageStatusEl.style.color = '#50575e';

		// Load models in background.
		loadModels( ajaxUrl, savedModel, statusEl, infoEl );
		loadImageModels( imageAjaxUrl, savedImageModel, imageStatusEl, imageInfoEl );

		// Filter on input.
		searchInput.addEventListener( 'input', function() {
			hiddenInput.value = this.value.trim();

			if ( ! isLoaded ) {
				return;
			}

			const query = this.value.trim().toLowerCase();

			if ( query.length < 3 ) {
				dropdown.style.display = 'none';
				return;
			}

			filterModels( query, dropdown, searchInput, hiddenInput, infoEl );
		} );

		// Close dropdown on blur.
		searchInput.addEventListener( 'blur', function() {
			// Small delay so mousedown on an item fires first.
			setTimeout( function() {
				dropdown.style.display = 'none';
			}, 150 );
		} );

		// Re-open if user focuses and already has 3+ chars.
		searchInput.addEventListener( 'focus', function() {
			if ( ! isLoaded ) {
				return;
			}

			const query = this.value.trim().toLowerCase();
			if ( query.length >= 3 ) {
				filterModels( query, dropdown, searchInput, hiddenInput, infoEl );
			}
		} );

		// Keyboard navigation: Escape closes the dropdown.
		searchInput.addEventListener( 'keydown', function( e ) {
			if ( e.key === 'Escape' ) {
				dropdown.style.display = 'none';
			}
		} );

		// Image model autocomplete: show all image models on focus, filter while typing.
		imageSearchInput.addEventListener( 'input', function() {
			imageHiddenInput.value = this.value.trim();

			if ( ! isImageLoaded ) {
				return;
			}

			const query = this.value.trim().toLowerCase();

			filterImageModels( query, imageDropdown, imageSearchInput, imageHiddenInput, imageInfoEl );
		} );

		imageSearchInput.addEventListener( 'focus', function() {
			if ( ! isImageLoaded ) {
				imageStatusEl.textContent = i18n.loading || 'Loading models…';
				return;
			}

			imageStatusEl.textContent = getImageModelMatches( '' ).length + ' image models available.';
			filterImageModels( this.value.trim().toLowerCase(), imageDropdown, imageSearchInput, imageHiddenInput, imageInfoEl );
		} );

		imageSearchInput.addEventListener( 'blur', function() {
			setTimeout( function() {
				imageDropdown.style.display = 'none';
			}, 150 );
		} );

		imageSearchInput.addEventListener( 'keydown', function( e ) {
			if ( e.key === 'Escape' ) {
				imageDropdown.style.display = 'none';
			}
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
