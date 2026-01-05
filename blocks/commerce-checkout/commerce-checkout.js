import { h } from '@dropins/tools/preact.js';
import {
  InLineAlert,
  Icon,
  Button,
  provider as UI,
} from '@dropins/tools/components.js';
import { readBlockConfig } from '../../scripts/aem.js';
import { fetchPlaceholders, rootLink, getProductLink } from '../../scripts/commerce.js';

/**
 * LocalStorage keys
 */
const CART_ID_STORAGE_KEY = 'cartId';
const GUEST_ADDRESS_STORAGE_KEY = 'guestAddress';

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
 * Gets saved guest address from localStorage
 * @returns {Object|null} Saved address or null
 */
function getSavedAddress() {
  try {
    const saved = localStorage.getItem(GUEST_ADDRESS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.error('Error reading saved address from localStorage:', error);
    return null;
  }
}

/**
 * Saves guest address to localStorage
 * @param {Object} address - Address object to save
 */
function saveAddress(address) {
  try {
    localStorage.setItem(GUEST_ADDRESS_STORAGE_KEY, JSON.stringify(address));
  } catch (error) {
    console.error('Error saving address to localStorage:', error);
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
 * Prepares checkout by calling checkout-prepare API
 * @param {Object} checkoutData - Checkout data
 * @returns {Promise<Object|null>} Checkout response or null if error
 */
async function prepareCheckout(checkoutData) {
  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/checkout-prepare`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to prepare checkout: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data?.cart || null;
  } catch (error) {
    console.error('Error preparing checkout:', error);
    throw error;
  }
}

/**
 * Creates PayPal order by calling paypal-order-create API
 * @param {string} cartId - Cart ID
 * @param {Object} amount - Amount object with value and currency_code
 * @param {Array} items - Items array (empty for now)
 * @returns {Promise<Object|null>} PayPal order response or null if error
 */
async function createPayPalOrder(cartId, amount, items = []) {
  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/paypal-order-create`;

  // Determine return URL based on environment
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const returnUrl = isLocalhost 
    ? `${window.location.protocol}//localhost:3000${window.location.pathname}`
    : `${window.location.origin}${window.location.pathname}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId,
        amount,
        items,
        returnUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to create PayPal order: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    throw error;
  }
}

/**
 * Captures PayPal payment by calling paypal-order-capture API
 * @param {string} paypalOrderId - PayPal Order ID (token from URL)
 * @returns {Promise<Object|null>} Capture response or null if error
 */
async function capturePayPalOrder(paypalOrderId) {
  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/paypal-order-capture`;

  console.log('capturePayPalOrder called with paypalOrderId:', paypalOrderId);
  console.log('API URL:', apiUrl);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paypalOrderId,
      }),
    });

    console.log('Capture API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Capture API error response:', errorText);
      let errorMessage = `Failed to capture PayPal payment: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Capture API response data:', data);
    return data || null;
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

/**
 * Places order by calling checkout-place-order API
 * @param {string} cartId - Cart ID
 * @returns {Promise<Object|null>} Order response or null if error
 */
async function placeOrder(cartId) {
  const apiUrl = `${BASE_URL}/poc-appbuilder-storefront/checkout-place-order`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cartId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to place order: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error('Error placing order:', error);
    throw error;
  }
}

/**
 * Clears cart ID from localStorage
 */
function clearCartId() {
  try {
    localStorage.removeItem(CART_ID_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing cart ID from localStorage:', error);
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
    },
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

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates form fields
 * @param {Object} formData - Form data object
 * @returns {Object} Validation result with isValid and errors
 */
function validateForm(formData) {
  const errors = {};

  // Email validation
  if (!formData.guestEmail || !formData.guestEmail.trim()) {
    errors.guestEmail = 'Email is required';
  } else if (!isValidEmail(formData.guestEmail)) {
    errors.guestEmail = 'Please enter a valid email address';
  }

  // Shipping address validation
  if (!formData.firstname || !formData.firstname.trim()) {
    errors.firstname = 'First name is required';
  }

  if (!formData.lastname || !formData.lastname.trim()) {
    errors.lastname = 'Last name is required';
  }

  if (!formData.company || !formData.company.trim()) {
    errors.company = 'Company name is required';
  }

  if (!formData.street || !formData.street.trim()) {
    errors.street = 'Street address is required';
  }

  if (!formData.city || !formData.city.trim()) {
    errors.city = 'City is required';
  }

  if (!formData.region || !formData.region.trim()) {
    errors.region = 'State/Region is required';
  }

  if (!formData.postcode || !formData.postcode.trim()) {
    errors.postcode = 'Postal code is required';
  }

  if (!formData.country_code || !formData.country_code.trim()) {
    errors.country_code = 'Country is required';
  }

  if (!formData.telephone || !formData.telephone.trim()) {
    errors.telephone = 'Phone number is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export default async function decorate(block) {
  // Check for PayPal return token FIRST, before any other operations
  const urlParams = new URLSearchParams(window.location.search);
  const paypalToken = urlParams.get('token');
  const isPayPalReturn = !!paypalToken;

  console.log('Checkout page loaded. PayPal return:', isPayPalReturn, 'Token:', paypalToken);

  const placeholders = await fetchPlaceholders();

  // Layout
  const fragment = document.createRange().createContextualFragment(`
    <div class="checkout__notification"></div>
    <div class="checkout__wrapper">
      <div class="checkout__main">
        <h1 class="checkout__title">${placeholders?.Global?.Checkout || 'Checkout'}</h1>
        
        <div class="checkout__cart-items"></div>
        
        <form class="checkout__form" id="checkout-form">
          <div class="checkout__section">
            <h2 class="checkout__section-title">${placeholders?.Global?.GuestEmail || 'Email Address'}</h2>
            <div class="checkout__field">
              <label for="guestEmail" class="checkout__label">
                ${placeholders?.Global?.Email || 'Email'} <span class="checkout__required">*</span>
              </label>
              <input 
                type="email" 
                id="guestEmail" 
                name="guestEmail" 
                class="checkout__input" 
                required
                autocomplete="email"
              />
              <span class="checkout__error" id="guestEmail-error"></span>
            </div>
          </div>

          <div class="checkout__section">
            <h2 class="checkout__section-title">${placeholders?.Global?.ShippingAddress || 'Shipping Address'}</h2>
            
            <div class="checkout__row">
              <div class="checkout__field checkout__field--half">
                <label for="firstname" class="checkout__label">
                  ${placeholders?.Global?.FirstName || 'First Name'} <span class="checkout__required">*</span>
                </label>
                <input 
                  type="text" 
                  id="firstname" 
                  name="firstname" 
                  class="checkout__input" 
                  required
                  autocomplete="given-name"
                />
                <span class="checkout__error" id="firstname-error"></span>
              </div>

              <div class="checkout__field checkout__field--half">
                <label for="lastname" class="checkout__label">
                  ${placeholders?.Global?.LastName || 'Last Name'} <span class="checkout__required">*</span>
                </label>
                <input 
                  type="text" 
                  id="lastname" 
                  name="lastname" 
                  class="checkout__input" 
                  required
                  autocomplete="family-name"
                />
                <span class="checkout__error" id="lastname-error"></span>
              </div>
            </div>

            <div class="checkout__field">
              <label for="company" class="checkout__label">
                ${placeholders?.Global?.Company || 'Company'} <span class="checkout__required">*</span>
              </label>
              <input 
                type="text" 
                id="company" 
                name="company" 
                class="checkout__input" 
                required
                autocomplete="organization"
              />
              <span class="checkout__error" id="company-error"></span>
            </div>

            <div class="checkout__field">
              <label for="street" class="checkout__label">
                ${placeholders?.Global?.StreetAddress || 'Street Address'} <span class="checkout__required">*</span>
              </label>
              <input 
                type="text" 
                id="street" 
                name="street" 
                class="checkout__input" 
                required
                autocomplete="street-address"
              />
              <span class="checkout__error" id="street-error"></span>
            </div>

            <div class="checkout__row">
              <div class="checkout__field checkout__field--half">
                <label for="city" class="checkout__label">
                  ${placeholders?.Global?.City || 'City'} <span class="checkout__required">*</span>
                </label>
                <input 
                  type="text" 
                  id="city" 
                  name="city" 
                  class="checkout__input" 
                  required
                  autocomplete="address-level2"
                />
                <span class="checkout__error" id="city-error"></span>
              </div>

              <div class="checkout__field checkout__field--half">
                <label for="region" class="checkout__label">
                  ${placeholders?.Global?.StateRegion || 'State/Region'} <span class="checkout__required">*</span>
                </label>
                <input 
                  type="text" 
                  id="region" 
                  name="region" 
                  class="checkout__input" 
                  required
                  autocomplete="address-level1"
                />
                <span class="checkout__error" id="region-error"></span>
              </div>
            </div>

            <div class="checkout__row">
              <div class="checkout__field checkout__field--half">
                <label for="postcode" class="checkout__label">
                  ${placeholders?.Global?.PostalCode || 'Postal Code'} <span class="checkout__required">*</span>
                </label>
                <input 
                  type="text" 
                  id="postcode" 
                  name="postcode" 
                  class="checkout__input" 
                  required
                  autocomplete="postal-code"
                />
                <span class="checkout__error" id="postcode-error"></span>
              </div>

              <div class="checkout__field checkout__field--half">
                <label for="country_code" class="checkout__label">
                  ${placeholders?.Global?.Country || 'Country'} <span class="checkout__required">*</span>
                </label>
                <select 
                  id="country_code" 
                  name="country_code" 
                  class="checkout__input checkout__select" 
                  required
                  autocomplete="country"
                >
                  <option value="">Select Country</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="IN">India</option>
                </select>
                <span class="checkout__error" id="country_code-error"></span>
              </div>
            </div>

            <div class="checkout__field">
              <label for="telephone" class="checkout__label">
                ${placeholders?.Global?.PhoneNumber || 'Phone Number'} <span class="checkout__required">*</span>
              </label>
              <input 
                type="tel" 
                id="telephone" 
                name="telephone" 
                class="checkout__input" 
                required
                autocomplete="tel"
              />
              <span class="checkout__error" id="telephone-error"></span>
            </div>
          </div>
        </form>
      </div>

      <div class="checkout__sidebar">
        <div class="checkout__summary"></div>
        <div class="checkout__actions">
          <button type="button" class="button button--primary checkout__place-order" id="place-order-btn">
            ${placeholders?.Global?.PlaceOrder || 'Place Order'}
          </button>
        </div>
      </div>
    </div>

    <div class="checkout__empty" style="display: none;">
      <div class="checkout__empty-content">
        <h2>${placeholders?.Global?.CartEmptyTitle || 'Your cart is empty'}</h2>
        <p>${placeholders?.Global?.CartEmptyMessage || 'Add some items to your cart to get started.'}</p>
        <a href="${rootLink('/cart')}" class="button button--primary">${placeholders?.Global?.BackToCart || 'Back to Cart'}</a>
      </div>
    </div>
  `);

  const $wrapper = fragment.querySelector('.checkout__wrapper');
  const $notification = fragment.querySelector('.checkout__notification');
  const $cartItems = fragment.querySelector('.checkout__cart-items');
  const $summary = fragment.querySelector('.checkout__summary');
  const $empty = fragment.querySelector('.checkout__empty');
  const $form = fragment.querySelector('#checkout-form');
  const $placeOrderBtn = fragment.querySelector('#place-order-btn');

  block.innerHTML = '';
  block.appendChild(fragment);

  let currentNotification = null;
  let currentCartData = null;

  /**
   * Shows a notification message
   */
  function showNotification(message, type = 'info') {
    try {
      if (!$notification) {
        console.warn('Notification container not found');
        return;
      }

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
    } catch (error) {
      console.error('Error showing notification:', error);
      // Fallback: just log to console if notification rendering fails
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Displays validation errors
   */
  function displayErrors(errors) {
    // Clear all errors
    $form.querySelectorAll('.checkout__error').forEach((el) => {
      el.textContent = '';
      el.style.display = 'none';
    });

    // Display new errors
    Object.keys(errors).forEach((field) => {
      const errorEl = document.getElementById(`${field}-error`);
      if (errorEl) {
        errorEl.textContent = errors[field];
        errorEl.style.display = 'block';
      }
    });
  }

  /**
   * Renders cart items
   */
  function renderCartItems(items) {
    if (!items || items.length === 0) {
      return;
    }

    $cartItems.innerHTML = `
      <div class="checkout__cart-section">
        <h2 class="checkout__section-title">${placeholders?.Global?.CartItems || 'Cart Items'}</h2>
        <div class="checkout__items-list">
          ${items.map((item) => `
            <div class="checkout__item">
              <div class="checkout__item-image">
                <a href="${getProductLink(item.urlKey, item.sku)}">
                  ${item.image ? `<img src="${item.image}" alt="${item.imageLabel || item.name}" />` : ''}
                </a>
              </div>
              <div class="checkout__item-details">
                <h3 class="checkout__item-name">
                  <a href="${getProductLink(item.urlKey, item.sku)}">${item.name}</a>
                </h3>
                <div class="checkout__item-sku">SKU: ${item.sku}</div>
                <div class="checkout__item-quantity">Qty: ${item.quantity}</div>
              </div>
              <div class="checkout__item-price">${formatPrice(item.rowTotal)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Renders order summary
   */
  function renderOrderSummary(cartData) {
    if (!cartData) {
      $summary.innerHTML = '';
      return;
    }

    $summary.innerHTML = `
      <div class="checkout-summary">
        <h2 class="checkout-summary__title">${placeholders?.Global?.OrderSummary || 'Order Summary'}</h2>
        <div class="checkout-summary__content">
          <div class="checkout-summary__row">
            <span class="checkout-summary__label">${placeholders?.Global?.Subtotal || 'Subtotal'}</span>
            <span class="checkout-summary__value">${formatPrice(cartData.prices.subtotalExcludingTax)}</span>
          </div>
          <div class="checkout-summary__divider"></div>
          <div class="checkout-summary__row checkout-summary__row--total">
            <span class="checkout-summary__label">${placeholders?.Global?.Total || 'Total'}</span>
            <span class="checkout-summary__value checkout-summary__value--total">${formatPrice(cartData.prices.grandTotal)}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Loads cart and renders UI
   */
  async function loadCart() {
    const cartId = getCartId();
    if (!cartId) {
      $wrapper.style.display = 'none';
      $empty.style.display = 'block';
      return;
    }

    try {
      const apiCart = await getCart(cartId);
      currentCartData = transformCartData(apiCart);

      if (currentCartData && currentCartData.items.length > 0) {
        renderCartItems(currentCartData.items);
        renderOrderSummary(currentCartData);
        $wrapper.style.display = '';
        $empty.style.display = 'none';

        // Load saved address if available
        const savedAddress = getSavedAddress();
        if (savedAddress) {
          Object.keys(savedAddress).forEach((key) => {
            const input = $form.querySelector(`[name="${key}"]`);
            if (input) {
              input.value = savedAddress[key];
            }
          });
        }
      } else {
        $wrapper.style.display = 'none';
        $empty.style.display = 'block';
      }
    } catch (error) {
      console.error('Error loading cart:', error);
      showNotification('Failed to load cart', 'error');
      $wrapper.style.display = 'none';
      $empty.style.display = 'block';
    }
  }

  /**
   * Handles place order button click
   */
  async function handlePlaceOrder() {
    const cartId = getCartId();
    if (!cartId) {
      showNotification('Cart not found', 'error');
      return;
    }

    // Get form data
    const formData = new FormData($form);
    const data = {
      guestEmail: formData.get('guestEmail')?.trim() || '',
      firstname: formData.get('firstname')?.trim() || '',
      lastname: formData.get('lastname')?.trim() || '',
      company: formData.get('company')?.trim() || '',
      street: formData.get('street')?.trim() || '',
      city: formData.get('city')?.trim() || '',
      region: formData.get('region')?.trim() || '',
      postcode: formData.get('postcode')?.trim() || '',
      country_code: formData.get('country_code')?.trim() || '',
      telephone: formData.get('telephone')?.trim() || '',
    };

    // Validate form
    const validation = validateForm(data);
    if (!validation.isValid) {
      displayErrors(validation.errors);
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    // Save address to localStorage
    const addressToSave = {
      guestEmail: data.guestEmail,
      firstname: data.firstname,
      lastname: data.lastname,
      company: data.company,
      street: data.street,
      city: data.city,
      region: data.region,
      postcode: data.postcode,
      country_code: data.country_code,
      telephone: data.telephone,
    };
    saveAddress(addressToSave);

    // Prepare checkout data
    const checkoutData = {
      cartId,
      guestEmail: data.guestEmail,
      shippingAddress: {
        vat_id: '',
        city: data.city,
        custom_attributes: [],
        company: data.company || '',
        country_code: data.country_code,
        firstname: data.firstname,
        lastname: data.lastname,
        postcode: data.postcode,
        region: 'CA',
        region_id: 12, // Default region ID, should be dynamic
        street: [data.street, ''],
        telephone: data.telephone,
      },
      shippingMethod: {
        carrier_code: 'flatrate',
        method_code: 'flatrate',
      },
      paymentMethod: {
        code: 'checkmo',
      },
    };

    try {
      $placeOrderBtn.disabled = true;
      $placeOrderBtn.textContent = placeholders?.Global?.PlacingOrder || 'Placing Order...';

      // Step 1: Prepare checkout
      const checkoutResult = await prepareCheckout(checkoutData);
      
      if (!checkoutResult) {
        throw new Error('Failed to prepare checkout');
      }

      // Step 2: Create PayPal order
      const cartId = getCartId();
      const amount = {
        value: currentCartData.prices.grandTotal.value,
        currency_code: currentCartData.prices.grandTotal.currency,
      };

      const paypalResult = await createPayPalOrder(cartId, amount, []);
      
      if (!paypalResult || !paypalResult.approvalUrl) {
        throw new Error('Failed to create PayPal order');
      }

      // Step 3: Redirect to PayPal approval URL
      showNotification('Redirecting to PayPal...', 'info');
      window.location.href = paypalResult.approvalUrl;
    } catch (error) {
      showNotification(error.message || 'Failed to place order', 'error');
      $placeOrderBtn.disabled = false;
      $placeOrderBtn.textContent = placeholders?.Global?.PlaceOrder || 'Place Order';
    }
  }

  /**
   * Handles PayPal return callback
   * Processes payment capture and order placement
   */
  async function handlePayPalReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const payerId = urlParams.get('PayerID');

    console.log('handlePayPalReturn called with token:', token, 'PayerID:', payerId);

    if (!token) {
      console.warn('No token found in URL');
      // No token in URL, proceed with normal checkout flow
      return false;
    }

    // Hide checkout form and show processing message
    $wrapper.style.display = 'none';
    $empty.style.display = 'block';
    $empty.innerHTML = `
      <div class="checkout__empty-content">
        <h2>${placeholders?.Global?.ProcessingPayment || 'Processing Payment...'}</h2>
        <p>${placeholders?.Global?.PleaseWait || 'Please wait while we process your payment.'}</p>
      </div>
    `;

    try {
      // Step 1: Capture PayPal payment
      console.log('Starting PayPal capture with token:', token);
      // showNotification('Capturing payment...', 'info');
      
      let captureResult;
      try {
        captureResult = await capturePayPalOrder(token);
        console.log('PayPal capture result:', captureResult);
      } catch (captureError) {
        console.error('Error in capturePayPalOrder:', captureError);
        throw new Error(`Failed to capture payment: ${captureError.message || captureError}`);
      }

      // Check if payment capture was successful and status is SUCCESS
      if (!captureResult) {
        throw new Error('Payment capture returned no result');
      }

      console.log('Capture result status:', captureResult.status);
      console.log('Capture result status:', captureResult.status);

      if (captureResult.status !== 'SUCCESS') {
        const statusMsg = captureResult?.status || captureResult?.status || 'unknown';
        throw new Error(`Payment capture was not completed successfully. Status: ${statusMsg}`);
      }

      console.log('Payment capture successful, proceeding to place order...');

      // Step 2: Place order if payment is completed
      const cartId = getCartId();
      console.log('Cart ID:', cartId);
      if (!cartId) {
        throw new Error('Cart not found');
      }

      console.log('Placing order with cartId:', cartId);
      // Update UI to show placing order status
      $empty.innerHTML = `
        <div class="checkout__empty-content">
          <h2>${placeholders?.Global?.PlacingOrder || 'Placing Your Order...'}</h2>
          <p>${placeholders?.Global?.PleaseWait || 'Please wait while we process your order.'}</p>
        </div>
      `;
      
      let orderResult;
      try {
        orderResult = await placeOrder(cartId);
        console.log('Order placement result:', orderResult);
      } catch (orderError) {
        console.error('Error in placeOrder:', orderError);
        throw new Error(`Failed to place order: ${orderError.message || orderError}`);
      }

      if (!orderResult || !orderResult.order) {
        throw new Error('Failed to place order');
      }

      // Step 3: Clear cart and show success
      clearCartId();

      // Show success message
      $empty.innerHTML = `
        <div class="checkout__empty-content">
          <svg class="checkout__success-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 class="checkout__success-title">${placeholders?.Global?.OrderPlacedSuccessfully || 'Order Placed Successfully!'}</h2>
          <p class="checkout__success-message">
            ${placeholders?.Global?.OrderNumber || 'Order Number'}: <strong>${orderResult.orderNumber || orderResult.order?.order?.number || ''}</strong>
          </p>
          <p class="checkout__success-message">
            ${placeholders?.Global?.ThankYouMessage || 'Thank you for your order. You will receive a confirmation email shortly.'}
          </p>
          <a href="${rootLink('/')}" class="button button--primary checkout__success-button">
            ${placeholders?.Global?.ContinueShopping || 'Continue Shopping'}
          </a>
        </div>
      `;

      // showNotification('Order placed successfully!', 'success');

      // Redirect to home page after 2 seconds
      // setTimeout(() => {
      //   window.location.href = rootLink('/');
      // }, 3000);

      return true;
    } catch (error) {
      console.error('Error processing PayPal return:', error);
      // showNotification(error.message || 'Failed to process payment', 'error');  
      
      // Show error state
      $empty.innerHTML = `
        <div class="checkout__empty-content">
          <h2>${placeholders?.Global?.PaymentError || 'Payment Processing Error'}</h2>
          <p>${error.message || 'An error occurred while processing your payment. Please try again.'}</p>
          <a href="${rootLink('/cart')}" class="button button--primary">${placeholders?.Global?.BackToCart || 'Back to Cart'}</a>
        </div>
      `;
      return false;
    }
  }

  // Event listeners
  $placeOrderBtn.addEventListener('click', handlePlaceOrder);

  // Check if this is a PayPal return callback
  if (isPayPalReturn && paypalToken) {
    console.log('PayPal return detected, token:', paypalToken);
    console.log('Calling handlePayPalReturn...');
    try {
      // This is a PayPal return, process payment capture and order placement
      const paypalReturnSuccess = await handlePayPalReturn();
      console.log('PayPal return handler completed, success:', paypalReturnSuccess);
      if (!paypalReturnSuccess) {
        // If PayPal return failed, still try to load cart for error display
        await loadCart();
      }
    } catch (error) {
      console.error('Error in PayPal return handler:', error);
      showNotification(error.message || 'Failed to process PayPal return', 'error');
      await loadCart();
    }
  } else {
    // Normal checkout flow, load cart
    console.log('Normal checkout flow, loading cart...');
    await loadCart();
  }

  return Promise.resolve();
}
