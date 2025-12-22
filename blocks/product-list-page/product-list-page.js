// Product Discovery Dropins
import SearchResults from '@dropins/storefront-product-discovery/containers/SearchResults.js';
import Facets from '@dropins/storefront-product-discovery/containers/Facets.js';
import SortBy from '@dropins/storefront-product-discovery/containers/SortBy.js';
import Pagination from '@dropins/storefront-product-discovery/containers/Pagination.js';
import { render as provider } from '@dropins/storefront-product-discovery/render.js';
import { Button, Icon, provider as UI } from '@dropins/tools/components.js';
import { h } from '@dropins/tools/preact.js';
import { search } from '@dropins/storefront-product-discovery/api.js';
// Wishlist Dropin
import { WishlistToggle } from '@dropins/storefront-wishlist/containers/WishlistToggle.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';
// Cart Dropin
import * as cartApi from '@dropins/storefront-cart/api.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
// Event Bus
import { events } from '@dropins/tools/event-bus.js';
// AEM
import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, getProductLink } from '../../scripts/commerce.js';

// Initializers
import '../../scripts/initializers/search.js';
import '../../scripts/initializers/wishlist.js';

/**
 * LocalStorage key for compared products
 */
const COMPARE_STORAGE_KEY = 'comparedProducts';

/**
 * Maximum number of products that can be compared
 */
const MAX_COMPARE_PRODUCTS = 3;

/**
 * Gets compared products from localStorage
 * @returns {string[]} Array of product SKUs
 */
function getComparedProducts() {
  try {
    const stored = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!stored) return [];
    const products = JSON.parse(stored);
    // Ensure we only return max 3 products
    return Array.isArray(products) ? products.slice(0, MAX_COMPARE_PRODUCTS) : [];
  } catch (error) {
    console.error('Error reading compared products from localStorage:', error);
    return [];
  }
}

/**
 * Adds a product to compare list
 * @param {string} sku - Product SKU to add
 * @returns {Object} Result object with success status and message
 */
function addToCompare(sku) {
  try {
    if (!sku) {
      return { success: false, message: 'Product SKU is required' };
    }

    const products = getComparedProducts();

    // Check if product is already in compare list
    if (products.includes(sku)) {
      return { success: false, message: 'Product is already in compare list' };
    }

    // Check if max limit is reached
    if (products.length >= MAX_COMPARE_PRODUCTS) {
      return {
        success: false,
        message: `You can compare a maximum of ${MAX_COMPARE_PRODUCTS} products`,
      };
    }

    // Add product to compare list
    products.push(sku);
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(products));
    // Emit event to update header counter
    events.emit('compare-products-updated');
    return { success: true, message: 'Product added to compare list' };
  } catch (error) {
    console.error('Error adding product to compare:', error);
    return { success: false, message: 'Error adding product to compare' };
  }
}

/**
 * Removes a product from compare list
 * @param {string} sku - Product SKU to remove
 * @returns {Object} Result object with success status and message
 */
function removeFromCompare(sku) {
  try {
    const products = getComparedProducts();
    const updated = products.filter((p) => p !== sku);
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
    // Emit event to update header counter
    events.emit('compare-products-updated');
    return { success: true, message: 'Product removed from compare list' };
  } catch (error) {
    console.error('Error removing product from compare:', error);
    return { success: false, message: 'Error removing product from compare' };
  }
}

/**
 * Checks if a product is in the compare list
 * @param {string} sku - Product SKU to check
 * @returns {boolean} True if product is in compare list
 */
function isProductInCompare(sku) {
  const products = getComparedProducts();
  return products.includes(sku);
}

export default async function decorate(block) {
  const labels = await fetchPlaceholders();

  const config = readBlockConfig(block);

  const fragment = document.createRange().createContextualFragment(`
    <div class="search__wrapper">
      <div class="search__result-info"></div>
      <div class="search__view-facets"></div>
      <div class="search__facets"></div>
      <div class="search__product-sort"></div>
      <div class="search__product-list"></div>
      <div class="search__pagination"></div>
    </div>
  `);

  const $resultInfo = fragment.querySelector('.search__result-info');
  const $viewFacets = fragment.querySelector('.search__view-facets');
  const $facets = fragment.querySelector('.search__facets');
  const $productSort = fragment.querySelector('.search__product-sort');
  const $productList = fragment.querySelector('.search__product-list');
  const $pagination = fragment.querySelector('.search__pagination');

  block.innerHTML = '';
  block.appendChild(fragment);

  // Add category url path to block for enrichment
  if (config.urlpath) {
    block.dataset.category = config.urlpath;
  }

  // Get variables from the URL
  const urlParams = new URLSearchParams(window.location.search);
  // get all params
  const {
    q,
    page,
    sort,
    filter,
  } = Object.fromEntries(urlParams.entries());

  // Request search based on the page type on block load
  if (config.urlpath) {
    // If it's a category page...
    await search({
      phrase: '', // search all products in the category
      currentPage: page ? Number(page) : 1,
      pageSize: 8,
      sort: sort ? getSortFromParams(sort) : [{ attribute: 'position', direction: 'DESC' }],
      filter: [
        { attribute: 'categoryPath', eq: config.urlpath }, // Add category filter
        { attribute: 'visibility', in: ['Search', 'Catalog, Search'] },
        ...getFilterFromParams(filter),
      ],
    }).catch(() => {
      console.error('Error searching for products');
    });
  } else {
    // If it's a search page...
    await search({
      phrase: q || '',
      currentPage: page ? Number(page) : 1,
      pageSize: 8,
      sort: getSortFromParams(sort),
      filter: [
        { attribute: 'visibility', in: ['Search', 'Catalog, Search'] },
        ...getFilterFromParams(filter),
      ],
    }).catch(() => {
      console.error('Error searching for products');
    });
  }

  const getAddToCartButton = (product) => {
    if (product.typename === 'ComplexProductView') {
      const button = document.createElement('div');
      UI.render(Button, {
        children: labels.Global?.AddProductToCart,
        icon: Icon({ source: 'Cart' }),
        href: getProductLink(product.urlKey, product.sku),
        variant: 'primary',
      })(button);
      return button;
    }
    const button = document.createElement('div');
    UI.render(Button, {
      children: labels.Global?.AddProductToCart,
      icon: Icon({ source: 'Cart' }),
      onClick: () => cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]),
      variant: 'primary',
    })(button);
    return button;
  };

  const getCompareButton = async (product) => {
    const sku = product?.sku;
    if (!sku) return null;

    const updateButtonState = (buttonInstance, productSku) => {
      const productInCompare = isProductInCompare(productSku);
      const ariaLabel = productInCompare
        ? labels.Global?.RemoveFromCompare || 'Remove from Compare'
        : labels.Global?.AddToCompare || 'Add to Compare';

      buttonInstance.setProps((prev) => ({
        ...prev,
        'aria-label': ariaLabel,
        icon: h(Icon, { source: productInCompare ? 'Close' : 'Add' }),
      }));
    };

    const isInCompare = isProductInCompare(sku);
    const ariaLabel = isInCompare
      ? labels.Global?.RemoveFromCompare || 'Remove from Compare'
      : labels.Global?.AddToCompare || 'Add to Compare';

    const button = document.createElement('div');
    const compareBtn = await UI.render(Button, {
      'aria-label': ariaLabel,
      icon: h(Icon, { source: isInCompare ? 'Close' : 'Add' }),
      variant: 'tertiary',
      onClick: async () => {
        // Get current state before operation
        const currentIsInCompare = isProductInCompare(sku);

        try {
          compareBtn.setProps((prev) => ({
            ...prev,
            disabled: true,
          }));

          let result;
          if (currentIsInCompare) {
            result = removeFromCompare(sku);
          } else {
            result = addToCompare(sku);
          }

          if (result.success) {
            // Wait a moment to ensure localStorage is updated
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Update button state based on new state
            updateButtonState(compareBtn, sku);
            compareBtn.setProps((prev) => ({
              ...prev,
              disabled: false,
            }));
          } else {
            // Re-enable button on error
            compareBtn.setProps((prev) => ({
              ...prev,
              disabled: false,
            }));

            // Show error message (optional - you can add toast/alert here)
            console.warn(result.message);
          }
        } catch (error) {
          // Re-enable button on exception
          compareBtn.setProps((prev) => ({
            ...prev,
            disabled: false,
          }));
          console.error('Error toggling compare:', error);
        }
      },
    })(button);

    // Store reference to button and SKU for event listener updates
    button.dataset.sku = sku;
    button.dataset.compareButton = 'true';

    // Listen for compare list updates to refresh button state
    events.on('compare-products-updated', () => {
      if (compareBtn && sku) {
        updateButtonState(compareBtn, sku);
      }
    });

    return button;
  };

  await Promise.all([
    // Sort By
    provider.render(SortBy, {})($productSort),

    // Pagination
    provider.render(Pagination, {
      onPageChange: () => {
        // scroll to the top of the page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    })($pagination),

    // View Facets Button
    UI.render(Button, {
      children: labels.Global?.Filters,
      icon: Icon({ source: 'Burger' }),
      variant: 'secondary',
      onClick: () => {
        $facets.classList.toggle('search__facets--visible');
      },
    })($viewFacets),

    // Facets
    provider.render(Facets, {})($facets),
    // Product List
    provider.render(SearchResults, {
      routeProduct: (product) => getProductLink(product.urlKey, product.sku),
      slots: {
        ProductImage: (ctx) => {
          const { product, defaultImageProps } = ctx;
          const anchorWrapper = document.createElement('a');
          anchorWrapper.href = getProductLink(product.urlKey, product.sku);

          tryRenderAemAssetsImage(ctx, {
            alias: product.sku,
            imageProps: defaultImageProps,
            wrapper: anchorWrapper,
            params: {
              width: defaultImageProps.width,
              height: defaultImageProps.height,
            },
          });
        },
        ProductActions: async (ctx) => {
          const actionsWrapper = document.createElement('div');
          actionsWrapper.className = 'product-discovery-product-actions';
          // Add to Cart Button
          const addToCartBtn = getAddToCartButton(ctx.product);
          addToCartBtn.className = 'product-discovery-product-actions__add-to-cart';
          // Wishlist Button
          const $wishlistToggle = document.createElement('div');
          $wishlistToggle.classList.add('product-discovery-product-actions__wishlist-toggle');
          wishlistRender.render(WishlistToggle, {
            product: ctx.product,
            variant: 'tertiary',
          })($wishlistToggle);
          // Compare Button
          const $compareButton = await getCompareButton(ctx.product);
          if ($compareButton) {
            $compareButton.classList.add('product-discovery-product-actions__compare-toggle');
            actionsWrapper.appendChild($compareButton);
          }
          actionsWrapper.appendChild(addToCartBtn);
          actionsWrapper.appendChild($wishlistToggle);
          ctx.replaceWith(actionsWrapper);
        },
      },
    })($productList),
  ]);

  // Listen for search results (event is fired before the block is rendered; eager: true)
  events.on('search/result', (payload) => {
    const totalCount = payload.result?.totalCount || 0;

    block.classList.toggle('product-list-page--empty', totalCount === 0);

    // Results Info
    $resultInfo.innerHTML = payload.request?.phrase
      ? `${totalCount} results found for <strong>"${payload.request.phrase}"</strong>.`
      : `${totalCount} results found.`;

    // Update the view facets button with the number of filters
    if (payload.request.filter.length > 0) {
      $viewFacets.querySelector('button').setAttribute('data-count', payload.request.filter.length);
    } else {
      $viewFacets.querySelector('button').removeAttribute('data-count');
    }
  }, { eager: true });

  // Listen for search results (event is fired after the block is rendered; eager: false)
  events.on('search/result', (payload) => {
    // update URL with new search params
    const url = new URL(window.location.href);

    if (payload.request?.phrase) {
      url.searchParams.set('q', payload.request.phrase);
    }

    if (payload.request?.currentPage) {
      url.searchParams.set('page', payload.request.currentPage);
    }

    if (payload.request?.sort) {
      url.searchParams.set('sort', getParamsFromSort(payload.request.sort));
    }

    if (payload.request?.filter) {
      url.searchParams.set('filter', getParamsFromFilter(payload.request.filter));
    }

    // Update the URL
    window.history.pushState({}, '', url.toString());
  }, { eager: false });
}

function getSortFromParams(sortParam) {
  if (!sortParam) return [];
  return sortParam.split(',').map((item) => {
    const [attribute, direction] = item.split('_');
    return { attribute, direction };
  });
}

function getParamsFromSort(sort) {
  return sort.map((item) => `${item.attribute}_${item.direction}`).join(',');
}

function getFilterFromParams(filterParam) {
  if (!filterParam) return [];

  // Decode the URL-encoded parameter
  const decodedParam = decodeURIComponent(filterParam);
  const results = [];
  const filters = decodedParam.split('|');

  filters.forEach((filter) => {
    if (filter.includes(':')) {
      const [attribute, value] = filter.split(':');

      if (value.includes(',')) {
        // Handle array values (like categories)
        results.push({
          attribute,
          in: value.split(','),
        });
      } else if (value.includes('-')) {
        // Handle range values (like price)
        const [from, to] = value.split('-');
        results.push({
          attribute,
          range: {
            from: Number(from),
            to: Number(to),
          },
        });
      } else {
        // Handle single values (like categories with one value)
        results.push({
          attribute,
          in: [value],
        });
      }
    }
  });

  return results;
}

function getParamsFromFilter(filter) {
  if (!filter || filter.length === 0) return '';

  return filter.map(({ attribute, in: inValues, range }) => {
    if (inValues) {
      return `${attribute}:${inValues.join(',')}`;
    }

    if (range) {
      return `${attribute}:${range.from}-${range.to}`;
    }

    return null;
  }).filter(Boolean).join('|');
}
