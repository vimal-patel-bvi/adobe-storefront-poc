import { h } from '@dropins/tools/preact.js';
import {
  InLineAlert,
  Icon,
  Button,
  provider as UI,
} from '@dropins/tools/components.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, rootLink, getProductLink } from '../../scripts/commerce.js';

/**
 * LocalStorage key for cart ID
 */
const CART_ID_STORAGE_KEY = 'cartId';

/**
 * Base URL for API endpoints
 */
const BASE_URL = window.BASE_URL || 'https://748062-appbuilderpoc-stage.adobeio-static.net/api/v1/web';

/**
 * Gets cart ID from localStorage
 * @returns {string|null} Cart ID or null if not found
 */
function getCartId() {
  try {
    return localStorage.getItem(CART_ID_STORAGE_KEY);
  } catch (error) {
    console.error('Error reading cart ID from localStorage:', error);
    return null;
  }
}

/**
 * Fetches cart data from API
 * @param {string} cartId - Cart ID
 * @returns {Promise<Object|null>} Cart data or null if error
 */
async function getCart(cartId) {
  if (!cartId) {
    return null;
  }

  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/cart-get`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cartId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cart: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data?.cart || null;
  } catch (error) {
    console.error('Error fetching cart:', error);
    return null;
  }
}

/**
 * Updates item quantity in cart
 * @param {string} cartId - Cart ID
 * @param {string} cartItemId - Cart Item ID (UID)
 * @param {number} quantity - New quantity
 * @returns {Promise<Object|null>} Updated cart data or null if error
 */
async function updateCartItemQuantity(cartId, cartItemId, quantity) {
  if (!cartId || !cartItemId) {
    throw new Error('Cart ID and Cart Item ID are required');
  }

  if (quantity < 1) {
    throw new Error('Quantity must be at least 1');
  }

  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/cart-update-item`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId,
        cart_item_id: cartItemId,
        quantity,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to update cart item: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch {
        // If error response is not JSON, use the text
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data?.cart || null;
  } catch (error) {
    console.error('Error updating cart item:', error);
    throw error;
  }
}

/**
 * Removes item from cart
 * @param {string} cartId - Cart ID
 * @param {string} itemUid - Item UID
 * @returns {Promise<Object|null>} Updated cart data or null if error
 */
async function removeCartItem(cartId, itemUid) {
  if (!cartId || !itemUid) {
    throw new Error('Cart ID and Item UID are required');
  }

  // TODO: Replace with actual API endpoint when available
  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/cart-remove-item`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId,
        itemUid,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to remove cart item: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data?.cart || null;
  } catch (error) {
    console.error('Error removing cart item:', error);
    // Fallback: refresh cart data
    return getCart(cartId);
  }
}

/**
 * Transforms API cart response to display format
 * @param {Object} apiCart - Cart data from API
 * @returns {Object} Transformed cart data
 */
function transformCartData(apiCart) {
  if (!apiCart) {
    return null;
  }

  const items = (apiCart.itemsV2?.items || []).map((item) => ({
    uid: item.uid,
    sku: item.product?.sku || '',
    name: item.product?.name || '',
    quantity: item.quantity || 0,
    price: {
      currency: item.prices?.price?.currency || 'USD',
      value: item.prices?.price?.value || 0,
    },
    rowTotal: {
      currency: item.prices?.row_total?.currency || 'USD',
      value: item.prices?.row_total?.value || 0,
    },
    image: item.product?.thumbnail?.url || '',
    imageLabel: item.product?.thumbnail?.label || '',
    urlKey: item.product?.url_key || '',
    isAvailable: item.is_available !== false,
    notAvailableMessage: item.not_available_message || '',
    stockStatus: item.product?.stock_status || '',
  }));

  return {
    id: apiCart.id,
    totalQuantity: apiCart.total_quantity || 0,
    items,
    prices: {
      grandTotal: {
        currency: apiCart.prices?.grand_total?.currency || 'USD',
        value: apiCart.prices?.grand_total?.value || 0,
      },
      subtotalExcludingTax: {
        currency: apiCart.prices?.subtotal_excluding_tax?.currency || 'USD',
        value: apiCart.prices?.subtotal_excluding_tax?.value || 0,
      },
      subtotalIncludingTax: {
        currency: apiCart.prices?.subtotal_including_tax?.currency || 'USD',
        value: apiCart.prices?.subtotal_including_tax?.value || 0,
      },
    },
    isVirtual: apiCart.is_virtual || false,
  };
}

/**
 * Formats price for display
 * @param {Object} price - Price object with currency and value
 * @returns {string} Formatted price string
 */
function formatPrice(price) {
  if (!price || !price.currency || price.value === undefined) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency,
  }).format(price.value);
}

export default async function decorate(block) {
  // Configuration
  const {
    'hide-heading': hideHeading = 'false',
    'max-items': maxItems,
    'enable-item-quantity-update': enableUpdateItemQuantity = 'true',
    'enable-item-remove': enableRemoveItem = 'true',
    'checkout-url': checkoutURL = '/checkout',
  } = readBlockConfig(block);

  const placeholders = await fetchPlaceholders();

  // Layout
  const fragment = document.createRange().createContextualFragment(`
    <div class="cart__notification"></div>
    <div class="cart__wrapper">
      <div class="cart__left-column">
        <div class="cart__list"></div>
      </div>
      <div class="cart__right-column">
        <div class="cart__order-summary"></div>
      </div>
    </div>
    <div class="cart__empty-cart" style="display: none;">
      <div class="cart__empty-cart-content">
        <svg class="cart__empty-cart-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V17C17 18.1 17.9 19 19 19C20.1 19 21 18.1 21 17V13M9 19.5C9.8 19.5 10.5 20.2 10.5 21C10.5 21.8 9.8 22.5 9 22.5C8.2 22.5 7.5 21.8 7.5 21C7.5 20.2 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21C21.5 21.8 20.8 22.5 20 22.5C19.2 22.5 18.5 21.8 18.5 21C18.5 20.2 19.2 19.5 20 19.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2 class="cart__empty-cart-title">${placeholders?.Global?.CartEmptyTitle || 'Your cart is empty'}</h2>
        <p class="cart__empty-cart-message">${placeholders?.Global?.CartEmptyMessage || 'Add some items to your cart to get started.'}</p>
        <a href="${rootLink('/')}" class="button button--primary cart__empty-cart-button">${placeholders?.Global?.StartShopping || 'Start Shopping'}</a>
      </div>
    </div>
  `);

  const $wrapper = fragment.querySelector('.cart__wrapper');
  const $notification = fragment.querySelector('.cart__notification');
  const $list = fragment.querySelector('.cart__list');
  const $summary = fragment.querySelector('.cart__order-summary');
  const $emptyCart = fragment.querySelector('.cart__empty-cart');

  block.innerHTML = '';
  block.appendChild(fragment);

  let currentNotification = null;
  let currentCartData = null;

  /**
   * Shows a notification message
   * @param {string} message - Message to display
   * @param {string} type - Type of notification (success, error, info)
   */
  function showNotification(message, type = 'info') {
    currentNotification?.remove();
    currentNotification = UI.render(InLineAlert, {
      heading: message,
      type,
      variant: 'primary',
      icon: h(Icon, { source: type === 'success' ? 'CheckWithCircle' : type === 'error' ? 'AlertWithCircle' : 'Info' }),
      'aria-live': 'polite',
      role: 'status',
      onDismiss: () => {
        currentNotification?.remove();
      },
    })($notification);

    setTimeout(() => {
      currentNotification?.remove();
    }, 5000);
  }

  /**
   * Renders cart items
   * @param {Array} items - Cart items array
   */
  function renderCartItems(items) {
    $list.innerHTML = '';

    if (!items || items.length === 0) {
      $wrapper.style.display = 'none';
      $emptyCart.style.display = 'block';
      return;
    }

    $wrapper.style.display = '';
    $emptyCart.style.display = 'none';

    // Add heading
    if (hideHeading !== 'true') {
      const heading = document.createElement('h2');
      heading.className = 'cart__heading';
      heading.textContent = placeholders?.Global?.ShoppingCart || 'Shopping Cart';
      $list.appendChild(heading);
    }

    items.forEach((item) => {
      const itemElement = document.createElement('article');
      itemElement.className = 'cart-item';
      itemElement.innerHTML = `
        <div class="cart-item__image-wrapper">
          <a href="${getProductLink(item.urlKey, item.sku)}" class="cart-item__image-link">
            ${item.image ? `<img src="${item.image}" alt="${item.imageLabel || item.name}" class="cart-item__image" />` : '<div class="cart-item__image-placeholder"></div>'}
          </a>
        </div>
        <div class="cart-item__content">
          <div class="cart-item__header">
            <h3 class="cart-item__name">
              <a href="${getProductLink(item.urlKey, item.sku)}" class="cart-item__name-link">${item.name}</a>
            </h3>
            ${enableRemoveItem === 'true' ? `
              <button type="button" class="cart-item__remove" data-item-uid="${item.uid}" aria-label="Remove ${item.name}">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="cart-item__meta">
            <span class="cart-item__sku">SKU: ${item.sku}</span>
            ${!item.isAvailable ? `<span class="cart-item__unavailable">${item.notAvailableMessage || 'Not available'}</span>` : ''}
          </div>
          <div class="cart-item__price-mobile">
            <span class="cart-item__price-label">Price:</span>
            <span class="cart-item__price-value">${formatPrice(item.price)}</span>
          </div>
          <div class="cart-item__quantity-wrapper">
            <label for="quantity-${item.uid}" class="cart-item__quantity-label">Quantity</label>
            ${enableUpdateItemQuantity === 'true' ? `
              <div class="cart-item__quantity-controls">
                <button type="button" class="cart-item__quantity-btn cart-item__quantity-btn--decrease" data-item-uid="${item.uid}" aria-label="Decrease quantity">−</button>
                <input 
                  type="number" 
                  id="quantity-${item.uid}" 
                  min="1" 
                  value="${item.quantity}" 
                  data-item-uid="${item.uid}"
                  class="cart-item__quantity-input"
                  aria-label="Quantity"
                />
                <button type="button" class="cart-item__quantity-btn cart-item__quantity-btn--increase" data-item-uid="${item.uid}" aria-label="Increase quantity">+</button>
              </div>
            ` : `<span class="cart-item__quantity-display">${item.quantity}</span>`}
          </div>
        </div>
        <div class="cart-item__pricing">
          <div class="cart-item__price">
            <span class="cart-item__price-label">Price</span>
            <span class="cart-item__price-value">${formatPrice(item.price)}</span>
          </div>
          <div class="cart-item__total">
            <span class="cart-item__total-label">Total</span>
            <span class="cart-item__total-value">${formatPrice(item.rowTotal)}</span>
          </div>
        </div>
      `;

      $list.appendChild(itemElement);
    });

    // Add event listeners for quantity updates
    if (enableUpdateItemQuantity === 'true') {
      const updateQuantity = async (itemUid, newQuantity) => {
        const cartId = getCartId();
        if (!cartId) {
          showNotification('Cart not found', 'error');
          return;
        }

        try {
          const updatedCart = await updateCartItemQuantity(cartId, itemUid, newQuantity);
          if (updatedCart) {
            currentCartData = transformCartData(updatedCart);
            renderCartItems(currentCartData?.items || []);
            renderOrderSummary(currentCartData);
            showNotification('Cart updated successfully', 'success');
          }
        } catch (error) {
          showNotification(error.message || 'Failed to update cart', 'error');
          await loadCart();
        }
      };

      // Quantity input change
      $list.querySelectorAll('.cart-item__quantity-input').forEach((input) => {
        let debounceTimer;
        input.addEventListener('change', async (e) => {
          const itemUid = e.target.dataset.itemUid;
          let newQuantity = parseInt(e.target.value, 10);

          if (newQuantity < 1) {
            e.target.value = 1;
            newQuantity = 1;
          }

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            e.target.disabled = true;
            updateQuantity(itemUid, newQuantity).finally(() => {
              e.target.disabled = false;
            });
          }, 500);
        });
      });

      // Decrease button
      $list.querySelectorAll('.cart-item__quantity-btn--decrease').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const itemUid = btn.dataset.itemUid;
          const input = document.getElementById(`quantity-${itemUid}`);
          if (input) {
            let newQuantity = parseInt(input.value, 10) - 1;
            if (newQuantity < 1) newQuantity = 1;
            input.value = newQuantity;
            input.disabled = true;
            await updateQuantity(itemUid, newQuantity);
            input.disabled = false;
          }
        });
      });

      // Increase button
      $list.querySelectorAll('.cart-item__quantity-btn--increase').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const itemUid = btn.dataset.itemUid;
          const input = document.getElementById(`quantity-${itemUid}`);
          if (input) {
            const newQuantity = parseInt(input.value, 10) + 1;
            input.value = newQuantity;
            input.disabled = true;
            await updateQuantity(itemUid, newQuantity);
            input.disabled = false;
          }
        });
      });
    }

    // Add event listeners for remove buttons
    if (enableRemoveItem === 'true') {
      $list.querySelectorAll('.cart-item__remove').forEach((button) => {
        button.addEventListener('click', async (e) => {
          const itemUid = e.target.closest('.cart-item__remove').dataset.itemUid;
          const cartId = getCartId();

          if (!cartId) {
            showNotification('Cart not found', 'error');
            return;
          }

          if (!confirm(placeholders?.Global?.CartRemoveConfirm || 'Are you sure you want to remove this item?')) {
            return;
          }

          try {
            e.target.closest('.cart-item__remove').disabled = true;
            const updatedCart = await removeCartItem(cartId, itemUid);
            if (updatedCart) {
              currentCartData = transformCartData(updatedCart);
              renderCartItems(currentCartData?.items || []);
              renderOrderSummary(currentCartData);
              showNotification('Item removed from cart', 'success');
            }
          } catch (error) {
            showNotification(error.message || 'Failed to remove item', 'error');
            await loadCart();
          }
        });
      });
    }
  }

  /**
   * Renders order summary
   * @param {Object} cartData - Cart data
   */
  function renderOrderSummary(cartData) {
    if (!cartData) {
      $summary.innerHTML = '';
      return;
    }

    $summary.innerHTML = `
      <div class="cart-summary">
        <h2 class="cart-summary__title">${placeholders?.Global?.OrderSummary || 'Order Summary'}</h2>
        <div class="cart-summary__content">
          <div class="cart-summary__row">
            <span class="cart-summary__label">${placeholders?.Global?.Subtotal || 'Subtotal'}</span>
            <span class="cart-summary__value">${formatPrice(cartData.prices.subtotalExcludingTax)}</span>
          </div>
          <div class="cart-summary__divider"></div>
          <div class="cart-summary__row cart-summary__row--total">
            <span class="cart-summary__label">${placeholders?.Global?.Total || 'Total'}</span>
            <span class="cart-summary__value cart-summary__value--total">${formatPrice(cartData.prices.grandTotal)}</span>
          </div>
          <div class="cart-summary__actions">
            <a href="${rootLink(checkoutURL)}" class="button button--primary cart-summary__checkout-btn">
              ${placeholders?.Global?.ProceedToCheckout || 'Proceed to Checkout'}
            </a>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Loads cart data and renders UI
   */
  async function loadCart() {
    const cartId = getCartId();
    if (!cartId) {
      $wrapper.style.display = 'none';
      $emptyCart.style.display = 'block';
      $summary.innerHTML = '';
      return;
    }

    try {
      const apiCart = await getCart(cartId);
      currentCartData = transformCartData(apiCart);

      if (currentCartData && currentCartData.items.length > 0) {
        renderCartItems(currentCartData.items);
        renderOrderSummary(currentCartData);
      } else {
        $wrapper.style.display = 'none';
        $emptyCart.style.display = 'block';
        $summary.innerHTML = '';
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      showNotification('Failed to load cart', 'error');
      $wrapper.style.display = 'none';
      $emptyCart.style.display = 'block';
    }
  }

  // Initial load
  await loadCart();

  // Listen for cart updates from other pages
  window.addEventListener('storage', (e) => {
    if (e.key === CART_ID_STORAGE_KEY) {
      loadCart();
    }
  });

  // Custom event listener for cart updates
  window.addEventListener('cart-updated', () => {
    loadCart();
  });

  return Promise.resolve();
}



