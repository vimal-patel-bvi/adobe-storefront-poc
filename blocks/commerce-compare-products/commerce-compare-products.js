/**
 * Commerce Compare Products Block
 * 
 * Displays products from localStorage compare list (max 3 products).
 * Allows users to view product details, remove from compare, and add to cart.
 */

import { Button, Icon, provider as UI } from '@dropins/tools/components.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import { events } from '@dropins/tools/event-bus.js';
import { readBlockConfig, loadCSS } from '../../scripts/aem.js';
import {
  CUSTOMER_COMPARE_PRODUCTS_PATH,
  checkIsAuthenticated,
  fetchPlaceholders,
  getProductLink,
  rootLink,
} from '../../scripts/commerce.js';

// Initialize cart
import '../../scripts/initializers/cart.js';

/**
 * LocalStorage key for compared products
 */
const COMPARE_STORAGE_KEY = 'comparedProducts';

/**
 * Maximum number of products that can be compared
 */
const MAX_COMPARE_PRODUCTS = 3;

/**
 * Base URL for API endpoints
 */
const BASE_URL = window.BASE_URL || 'https://748062-appbuilderpoc-stage.adobeio-static.net/api/v1/web';

/**
 * Fetches product details by SKU from the API
 * @param {string} sku - Product SKU
 * @returns {Promise<Object|null>} Product data or null if error
 */
async function fetchProductDetailsBySku(sku) {
  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/get-product-details-by-sku`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sku }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching product data for SKU ${sku}:`, error);
    return null;
  }
}

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
 * Removes a product from compare list
 * @param {string} sku - Product SKU to remove
 */
function removeFromCompare(sku) {
  try {
    const products = getComparedProducts();
    const updated = products.filter((p) => p !== sku);
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(updated));
    // Reload the page to reflect changes
    window.location.reload();
  } catch (error) {
    console.error('Error removing product from compare:', error);
  }
}

/**
 * Formats price for display
 * @param {Object} price - Price object with amount
 * @returns {string} Formatted price string
 */
function formatPrice(price) {
  if (!price?.final?.amount) return 'Price not available';
  const { value, currency = 'USD' } = price.final.amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Gets the primary product image URL
 * @param {Array} images - Array of image objects
 * @returns {string|null} Image URL or null
 */
function getPrimaryImageUrl(images) {
  if (!images || images.length === 0) return null;
  
  // Find image with 'image' or 'small_image' role, or use first image
  const primaryImage = images.find(img => 
    img.roles && (img.roles.includes('image') || img.roles.includes('small_image'))
  );
  
  return primaryImage ? primaryImage.url : images[0].url;
}

/**
 * Renders empty state when no products to compare
 * @param {HTMLElement} container - Container element
 * @param {Object} labels - Placeholder labels
 * @param {string} startShoppingUrl - URL for start shopping button
 */
function renderEmptyState(container, labels, startShoppingUrl) {
  container.innerHTML = `
    <div class="commerce-compare-products-empty">
      <h2>${labels.Global?.CompareProductsEmptyTitle || 'No Products to Compare'}</h2>
      <p>${labels.Global?.CompareProductsEmptyMessage || 'You haven\'t added any products to compare yet.'}</p>
      ${startShoppingUrl ? `<a href="${rootLink(startShoppingUrl)}" class="commerce-compare-products-start-shopping">${labels.Global?.StartShopping || 'Start Shopping'}</a>` : ''}
    </div>
  `;
}

/**
 * Renders comparison table with products side by side
 * @param {Array} products - Array of product data
 * @param {HTMLElement} container - Container element
 * @param {Object} labels - Placeholder labels
 */
function renderComparisonTable(products, container, labels) {
  if (!products || products.length === 0) return;

  // Get all unique attribute names across all products
  const allAttributes = new Set();
  products.forEach(product => {
    if (product.attributes && Array.isArray(product.attributes)) {
      product.attributes.forEach(attr => {
        if (attr.name) allAttributes.add(attr.name);
      });
    }
  });

  const table = document.createElement('table');
  table.className = 'commerce-compare-products-table';

  // Create header row with remove buttons
  const headerRow = document.createElement('tr');
  headerRow.className = 'commerce-compare-products-header-row';
  
  // Empty cell for row labels
  const emptyHeader = document.createElement('th');
  emptyHeader.className = 'commerce-compare-products-label-col';
  headerRow.appendChild(emptyHeader);

  // Product columns
  products.forEach((product) => {
    const productHeader = document.createElement('th');
    productHeader.className = 'commerce-compare-products-product-col';

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'commerce-compare-products-remove';
    removeBtn.setAttribute('aria-label', labels.Global?.RemoveFromCompare || 'Remove from compare');
    removeBtn.innerHTML = '×';
    removeBtn.onclick = () => removeFromCompare(product.sku);

    // Image container
    const imageContainer = document.createElement('div');
    imageContainer.className = 'commerce-compare-products-image';
    
    const imageUrl = getPrimaryImageUrl(product.images);
    if (imageUrl) {
      const imageWrapper = document.createElement('a');
      imageWrapper.href = getProductLink(product.urlKey, product.sku);
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = product.name || product.sku;
      img.loading = 'lazy';
      imageWrapper.appendChild(img);
      imageContainer.appendChild(imageWrapper);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'commerce-compare-products-image-placeholder';
      placeholder.textContent = labels.Global?.NoImage || 'No Image';
      imageContainer.appendChild(placeholder);
    }

    // Product name
    const nameLink = document.createElement('a');
    nameLink.className = 'commerce-compare-products-name';
    nameLink.href = getProductLink(product.urlKey, product.sku);
    nameLink.textContent = product.name || product.sku;

    // Price
    const priceDiv = document.createElement('div');
    priceDiv.className = 'commerce-compare-products-price';
    if (product.price) {
      priceDiv.textContent = formatPrice(product.price);
    } else {
      priceDiv.textContent = labels.Global?.PriceNotAvailable || 'Price not available';
    }

    // Stock status
    const stockDiv = document.createElement('div');
    stockDiv.className = 'commerce-compare-products-stock';
    stockDiv.textContent = product.inStock 
      ? (labels.Global?.InStock || 'In Stock') 
      : (labels.Global?.OutOfStock || 'Out of Stock');
    stockDiv.classList.add(product.inStock ? 'in-stock' : 'out-of-stock');

    // Add to cart button
    const addToCartContainer = document.createElement('div');
    addToCartContainer.className = 'commerce-compare-products-add-to-cart-container';
    const addToCartBtn = document.createElement('button');
    addToCartBtn.className = 'commerce-compare-products-add-to-cart';
    addToCartBtn.textContent = labels.Global?.AddProductToCart || 'Add to Cart';
    addToCartBtn.disabled = !product.addToCartAllowed || !product.inStock;

    if (product.addToCartAllowed && product.inStock) {
      addToCartBtn.onclick = async () => {
        if (!checkIsAuthenticated()) {
          window.location.href = rootLink('/customer/login');
          return;
        }

        try {
          addToCartBtn.disabled = true;
          addToCartBtn.textContent = labels.Global?.AddingToCart || 'Adding...';
          await cartApi.addProductsToCart([{ sku: product.sku, quantity: 1 }]);
          addToCartBtn.textContent = labels.Global?.AddedToCart || 'Added to Cart';
          
          setTimeout(() => {
            addToCartBtn.textContent = labels.Global?.AddProductToCart || 'Add to Cart';
            addToCartBtn.disabled = false;
          }, 2000);
        } catch (error) {
          console.error('Error adding product to cart:', error);
          addToCartBtn.textContent = labels.Global?.AddToCartError || 'Error adding to cart';
          addToCartBtn.disabled = false;
        }
      };
    }

    addToCartContainer.appendChild(addToCartBtn);

    // Assemble product header
    productHeader.appendChild(removeBtn);
    productHeader.appendChild(imageContainer);
    productHeader.appendChild(nameLink);
    productHeader.appendChild(priceDiv);
    productHeader.appendChild(stockDiv);
    productHeader.appendChild(addToCartContainer);

    headerRow.appendChild(productHeader);
  });

  table.appendChild(headerRow);

  // Description row
  const descRow = document.createElement('tr');
  const descLabel = document.createElement('td');
  descLabel.className = 'commerce-compare-products-label';
  descLabel.textContent = labels.Global?.Description || 'Description';
  descRow.appendChild(descLabel);

  products.forEach((product) => {
    const descCell = document.createElement('td');
    descCell.className = 'commerce-compare-products-value';
    const desc = product.shortDescription || product.description || '';
    // Strip HTML tags for display
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = desc;
    descCell.textContent = tempDiv.textContent || labels.Global?.NoDescription || 'No description available';
    descRow.appendChild(descCell);
  });

  table.appendChild(descRow);

  // Attributes rows
  Array.from(allAttributes).forEach((attrName) => {
    const attrRow = document.createElement('tr');
    const attrLabel = document.createElement('td');
    attrLabel.className = 'commerce-compare-products-label';
    
    // Get label from first product that has this attribute
    const firstProductWithAttr = products.find(p => 
      p.attributes && p.attributes.find(a => a.name === attrName)
    );
    const attrObj = firstProductWithAttr?.attributes?.find(a => a.name === attrName);
    attrLabel.textContent = attrObj?.label || attrName;
    attrRow.appendChild(attrLabel);

    products.forEach((product) => {
      const attrCell = document.createElement('td');
      attrCell.className = 'commerce-compare-products-value';
      
      const attr = product.attributes?.find(a => a.name === attrName);
      if (attr) {
        attrCell.textContent = attr.value !== null && attr.value !== undefined ? String(attr.value) : '-';
      } else {
        attrCell.textContent = '-';
      }
      
      attrRow.appendChild(attrCell);
    });

    table.appendChild(attrRow);
  });

  container.appendChild(table);
}

/**
 * Main decorate function
 * @param {HTMLElement} block - Block element
 */
export default async function decorate(block) {
  // Load CSS
  await loadCSS(`${window.hlx.codeBasePath}/blocks/commerce-compare-products/commerce-compare-products.css`);

  // Get configuration
  const config = readBlockConfig(block);
  const startShoppingUrl = config['start-shopping-url'] || '';

  // Fetch placeholders
  const labels = await fetchPlaceholders();

  // Create container structure
  const fragment = document.createRange().createContextualFragment(`
    <div class="commerce-compare-products-container">
      <div class="commerce-compare-products-header">
        <h1>${labels.Global?.CompareProducts || 'Compare Products'}</h1>
        <p>${labels.Global?.CompareProductsDescription || `Compare up to ${MAX_COMPARE_PRODUCTS} products side by side`}</p>
      </div>
      <div class="commerce-compare-products-table-wrapper"></div>
    </div>
  `);

  block.innerHTML = '';
  block.appendChild(fragment);

  const tableWrapper = block.querySelector('.commerce-compare-products-table-wrapper');
  const container = block.querySelector('.commerce-compare-products-container');

  // Get compared products from localStorage
  const comparedSkus = getComparedProducts();

  if (comparedSkus.length === 0) {
    renderEmptyState(container, labels, startShoppingUrl);
    return;
  }

  // Show loading state
  tableWrapper.innerHTML = '<div class="commerce-compare-products-loading">Loading products...</div>';

  // Fetch product data for all SKUs using the new API
  const productPromises = comparedSkus.map(sku => fetchProductDetailsBySku(sku));
  const products = await Promise.all(productPromises);
  const validProducts = products.filter((p) => p !== null && p.sku);

  if (validProducts.length === 0) {
    renderEmptyState(container, labels, startShoppingUrl);
    return;
  }

  // Clear loading state and render comparison table
  tableWrapper.innerHTML = '';
  renderComparisonTable(validProducts, tableWrapper, labels);
}
