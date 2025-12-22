import {
  InLineAlert,
  Icon,
  Button,
  provider as UI,
} from '@dropins/tools/components.js';
import { h } from '@dropins/tools/preact.js';
import { events } from '@dropins/tools/event-bus.js';
import { tryRenderAemAssetsImage } from '@dropins/tools/lib/aem/assets.js';
import * as pdpApi from '@dropins/storefront-pdp/api.js';
import { render as pdpRendered } from '@dropins/storefront-pdp/render.js';
import { render as wishlistRender } from '@dropins/storefront-wishlist/render.js';

import { WishlistToggle } from '@dropins/storefront-wishlist/containers/WishlistToggle.js';
import { WishlistAlert } from '@dropins/storefront-wishlist/containers/WishlistAlert.js';

// Containers
import ProductHeader from '@dropins/storefront-pdp/containers/ProductHeader.js';
import ProductPrice from '@dropins/storefront-pdp/containers/ProductPrice.js';
import ProductShortDescription from '@dropins/storefront-pdp/containers/ProductShortDescription.js';
import ProductOptions from '@dropins/storefront-pdp/containers/ProductOptions.js';
import ProductQuantity from '@dropins/storefront-pdp/containers/ProductQuantity.js';
import ProductDescription from '@dropins/storefront-pdp/containers/ProductDescription.js';
import ProductAttributes from '@dropins/storefront-pdp/containers/ProductAttributes.js';
import ProductGallery from '@dropins/storefront-pdp/containers/ProductGallery.js';
import ProductGiftCardOptions from '@dropins/storefront-pdp/containers/ProductGiftCardOptions.js';

// Libs
import {
  rootLink,
  setJsonLd,
  fetchPlaceholders,
  getProductLink,
} from '../../scripts/commerce.js';

// Initializers
import { IMAGES_SIZES } from '../../scripts/initializers/pdp.js';
import '../../scripts/initializers/cart.js';
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
 * Checks if the page has prerendered product JSON-LD data
 * @returns {boolean} True if product JSON-LD exists and contains @type=Product
 */
function isProductPrerendered() {
  const jsonLdScript = document.querySelector('script[type="application/ld+json"]');

  if (!jsonLdScript?.textContent) {
    return false;
  }

  try {
    const jsonLd = JSON.parse(jsonLdScript.textContent);
    return jsonLd?.['@type'] === 'Product';
  } catch (error) {
    console.debug('Failed to parse JSON-LD:', error);
    return false;
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

// Function to update the Add to Cart button text
function updateAddToCartButtonText(addToCartInstance, inCart, labels) {
  const buttonText = inCart
    ? labels.Global?.UpdateProductInCart
    : labels.Global?.AddProductToCart;
  if (addToCartInstance) {
    addToCartInstance.setProps((prev) => ({
      ...prev,
      children: buttonText,
    }));
  }
}

export default async function decorate(block) {
  const product = events.lastPayload('pdp/data') ?? null;
  const labels = await fetchPlaceholders();

  // Read itemUid from URL
  const urlParams = new URLSearchParams(window.location.search);
  const itemUidFromUrl = urlParams.get('itemUid');

  // State to track if we are in update mode
  let isUpdateMode = false;

  // Layout
  const fragment = document.createRange().createContextualFragment(`
    <div class="product-details__alert"></div>
    <div class="product-details__wrapper">
      <div class="product-details__left-column">
        <div class="product-details__gallery"></div>
      </div>
      <div class="product-details__right-column">
        <div class="product-details__header"></div>
        <div class="product-details__price"></div>
        <div class="product-details__gallery"></div>
        <div class="product-details__short-description"></div>
        <div class="product-details__gift-card-options"></div>
        <div class="product-details__configuration">
          <div class="product-details__options"></div>
          <div class="product-details__quantity"></div>
          <div class="product-details__buttons">
            <div class="product-details__buttons__add-to-cart"></div>
            <div class="product-details__buttons__add-to-wishlist"></div>
            <div class="product-details__buttons__add-to-compare"></div>
          </div>
        </div>
        <div class="product-details__description"></div>
        <div class="product-details__attributes"></div>
      </div>
    </div>
  `);

  const $alert = fragment.querySelector('.product-details__alert');
  const $gallery = fragment.querySelector('.product-details__gallery');
  const $header = fragment.querySelector('.product-details__header');
  const $price = fragment.querySelector('.product-details__price');
  const $galleryMobile = fragment.querySelector('.product-details__right-column .product-details__gallery');
  const $shortDescription = fragment.querySelector('.product-details__short-description');
  const $options = fragment.querySelector('.product-details__options');
  const $quantity = fragment.querySelector('.product-details__quantity');
  const $giftCardOptions = fragment.querySelector('.product-details__gift-card-options');
  const $addToCart = fragment.querySelector('.product-details__buttons__add-to-cart');
  const $wishlistToggleBtn = fragment.querySelector('.product-details__buttons__add-to-wishlist');
  const $addToCompare = fragment.querySelector('.product-details__buttons__add-to-compare');
  const $description = fragment.querySelector('.product-details__description');
  const $attributes = fragment.querySelector('.product-details__attributes');

  block.replaceChildren(fragment);

  const gallerySlots = {
    CarouselThumbnail: (ctx) => {
      tryRenderAemAssetsImage(ctx, {
        ...imageSlotConfig(ctx),
        wrapper: document.createElement('span'),
      });
    },

    CarouselMainImage: (ctx) => {
      tryRenderAemAssetsImage(ctx, {
        ...imageSlotConfig(ctx),
      });
    },
  };

  // Alert
  let inlineAlert = null;
  const routeToWishlist = '/wishlist';

  const [
    _galleryMobile,
    _gallery,
    _header,
    _price,
    _shortDescription,
    _options,
    _quantity,
    _giftCardOptions,
    _description,
    _attributes,
    wishlistToggleBtn,
  ] = await Promise.all([
    // Gallery (Mobile)
    pdpRendered.render(ProductGallery, {
      controls: 'dots',
      arrows: true,
      peak: false,
      gap: 'small',
      loop: false,
      imageParams: {
        ...IMAGES_SIZES,
      },

      slots: gallerySlots,
    })($galleryMobile),

    // Gallery (Desktop)
    pdpRendered.render(ProductGallery, {
      controls: 'thumbnailsColumn',
      arrows: true,
      peak: true,
      gap: 'small',
      loop: false,
      imageParams: {
        ...IMAGES_SIZES,
      },

      slots: gallerySlots,
    })($gallery),

    // Header
    pdpRendered.render(ProductHeader, {})($header),

    // Price
    pdpRendered.render(ProductPrice, {})($price),

    // Short Description
    pdpRendered.render(ProductShortDescription, {})($shortDescription),

    // Configuration - Swatches
    pdpRendered.render(ProductOptions, {
      hideSelectedValue: false,
      slots: {
        SwatchImage: (ctx) => {
          tryRenderAemAssetsImage(ctx, {
            ...imageSlotConfig(ctx),
            wrapper: document.createElement('span'),
          });
        },
      },
    })($options),

    // Configuration  Quantity
    pdpRendered.render(ProductQuantity, {})($quantity),

    // Configuration  Gift Card Options
    pdpRendered.render(ProductGiftCardOptions, {})($giftCardOptions),

    // Description
    pdpRendered.render(ProductDescription, {})($description),

    // Attributes
    pdpRendered.render(ProductAttributes, {})($attributes),

    // Wishlist button - WishlistToggle Container
    wishlistRender.render(WishlistToggle, {
      product,
    })($wishlistToggleBtn),
  ]);

  // Configuration – Button - Add to Compare
  const currentSku = product?.sku;
  const isInCompare = currentSku ? isProductInCompare(currentSku) : false;
  const compareButtonText = isInCompare
    ? labels.Global?.RemoveFromCompare || 'Remove from Compare'
    : labels.Global?.AddToCompare || 'Add to Compare';

  const addToCompareBtn = await UI.render(Button, {
    children: compareButtonText,
    icon: h(Icon, { source: isInCompare ? 'Close' : 'Compare' }),
    onClick: async () => {
      if (!currentSku) {
        return;
      }

      // Get current state before operation
      const currentIsInCompare = isProductInCompare(currentSku);

      try {
        addToCompareBtn.setProps((prev) => ({
          ...prev,
          disabled: true,
        }));

        let result;
        if (currentIsInCompare) {
          result = removeFromCompare(currentSku);
        } else {
          result = addToCompare(currentSku);
        }

        if (result.success) {
          // Wait a moment to ensure localStorage is updated
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Update button state based on new state
          const newIsInCompare = isProductInCompare(currentSku);
          const newButtonText = newIsInCompare
            ? labels.Global?.RemoveFromCompare || 'Remove from Compare'
            : labels.Global?.AddToCompare || 'Add to Compare';

          addToCompareBtn.setProps((prev) => ({
            ...prev,
            children: newButtonText,
            icon: h(Icon, { source: newIsInCompare ? 'Close' : 'Compare' }),
            disabled: false,
          }));

          // Show success alert
          inlineAlert?.remove();
          inlineAlert = await UI.render(InLineAlert, {
            heading: 'Success',
            description: result.message,
            icon: h(Icon, { source: 'Checkmark' }),
            'aria-live': 'polite',
            role: 'status',
            onDismiss: () => {
              inlineAlert.remove();
            },
          })($alert);

          setTimeout(() => {
            $alert.innerHTML = '';
          }, 3000);
        } else {
          // Re-enable button on error
          addToCompareBtn.setProps((prev) => ({
            ...prev,
            disabled: false,
          }));

          // Show error alert
          inlineAlert?.remove();
          inlineAlert = await UI.render(InLineAlert, {
            heading: 'Error',
            description: result.message,
            icon: h(Icon, { source: 'Warning' }),
            'aria-live': 'assertive',
            role: 'alert',
            onDismiss: () => {
              inlineAlert.remove();
            },
          })($alert);

          $alert.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      } catch (error) {
        // Re-enable button on exception
        addToCompareBtn.setProps((prev) => ({
          ...prev,
          disabled: false,
        }));

        inlineAlert?.remove();
        inlineAlert = await UI.render(InLineAlert, {
          heading: 'Error',
          description: error.message || 'An error occurred',
          icon: h(Icon, { source: 'Warning' }),
          'aria-live': 'assertive',
          role: 'alert',
          onDismiss: () => {
            inlineAlert.remove();
          },
        })($alert);

        $alert.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    },
  })($addToCompare);

  // Configuration – Button - Add to Cart
  const addToCart = await UI.render(Button, {
    children: labels.Global?.AddProductToCart,
    icon: h(Icon, { source: 'Cart' }),
    onClick: async () => {
      const buttonActionText = isUpdateMode
        ? labels.Global?.UpdatingInCart
        : labels.Global?.AddingToCart;
      try {
        addToCart.setProps((prev) => ({
          ...prev,
          children: buttonActionText,
          disabled: true,
        }));

        // get the current selection values
        const values = pdpApi.getProductConfigurationValues();
        const valid = pdpApi.isProductConfigurationValid();

        // add or update the product in the cart
        if (valid) {
          if (isUpdateMode) {
            // --- Update existing item ---
            const { updateProductsFromCart } = await import(
              '@dropins/storefront-cart/api.js'
            );

            await updateProductsFromCart([{ ...values, uid: itemUidFromUrl }]);

            // --- START REDIRECT ON UPDATE ---
            const updatedSku = values?.sku;
            if (updatedSku) {
              const cartRedirectUrl = new URL(
                rootLink('/cart'),
                window.location.origin,
              );
              cartRedirectUrl.searchParams.set('itemUid', itemUidFromUrl);
              window.location.href = cartRedirectUrl.toString();
            } else {
              // Fallback if SKU is somehow missing (shouldn't happen in normal flow)
              console.warn(
                'Could not retrieve SKU for updated item. Redirecting to cart without parameter.',
              );
              window.location.href = rootLink('/cart');
            }
            return;
          }
          // --- Add new item ---
          const { addProductsToCart } = await import(
            '@dropins/storefront-cart/api.js'
          );
          await addProductsToCart([{ ...values }]);
        }

        // reset any previous alerts if successful
        inlineAlert?.remove();
      } catch (error) {
        // add alert message
        inlineAlert = await UI.render(InLineAlert, {
          heading: 'Error',
          description: error.message,
          icon: h(Icon, { source: 'Warning' }),
          'aria-live': 'assertive',
          role: 'alert',
          onDismiss: () => {
            inlineAlert.remove();
          },
        })($alert);

        // Scroll the alertWrapper into view
        $alert.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } finally {
        // Reset button text using the helper function which respects the current mode
        updateAddToCartButtonText(addToCart, isUpdateMode, labels);
        // Re-enable button
        addToCart.setProps((prev) => ({
          ...prev,
          disabled: false,
        }));
      }
    },
  })($addToCart);

  // Lifecycle Events
  events.on('pdp/valid', (valid) => {
    // update add to cart button disabled state based on product selection validity
    addToCart.setProps((prev) => ({ ...prev, disabled: !valid }));
  }, { eager: true });

  // Handle option changes
  events.on('pdp/values', () => {
    if (wishlistToggleBtn) {
      const configValues = pdpApi.getProductConfigurationValues();

      // Check URL parameter for empty optionsUIDs
      const urlOptionsUIDs = urlParams.get('optionsUIDs');

      // If URL has empty optionsUIDs parameter, treat as base product (no options)
      const optionUIDs = urlOptionsUIDs === '' ? undefined : (configValues?.optionsUIDs || undefined);

      wishlistToggleBtn.setProps((prev) => ({
        ...prev,
        product: {
          ...product,
          optionUIDs,
        },
      }));
    }
  }, { eager: true });

  // Update compare button state when product changes
  events.on('pdp/data', (productData) => {
    if (addToCompareBtn && productData?.sku) {
      const productInCompare = isProductInCompare(productData.sku);
      const buttonText = productInCompare
        ? labels.Global?.RemoveFromCompare || 'Remove from Compare'
        : labels.Global?.AddToCompare || 'Add to Compare';

      addToCompareBtn.setProps((prev) => ({
        ...prev,
        children: buttonText,
        icon: h(Icon, { source: productInCompare ? 'Close' : 'Compare' }),
        disabled: false,
      }));
    }
  }, { eager: true });

  // Listen for compare list updates to refresh button state
  events.on('compare-products-updated', () => {
    if (addToCompareBtn) {
      // Get current product SKU from the latest product data
      const latestProduct = events.lastPayload('pdp/data') ?? product;
      const sku = latestProduct?.sku || currentSku;
      
      if (sku) {
        const productInCompare = isProductInCompare(sku);
        const buttonText = productInCompare
          ? labels.Global?.RemoveFromCompare || 'Remove from Compare'
          : labels.Global?.AddToCompare || 'Add to Compare';

        addToCompareBtn.setProps((prev) => ({
          ...prev,
          children: buttonText,
          icon: h(Icon, { source: productInCompare ? 'Close' : 'Compare' }),
        }));
      }
    }
  });

  events.on('wishlist/alert', ({ action, item }) => {
    wishlistRender.render(WishlistAlert, {
      action,
      item,
      routeToWishlist,
    })($alert);

    setTimeout(() => {
      $alert.innerHTML = '';
    }, 5000);

    setTimeout(() => {
      $alert.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 0);
  });

  // --- Add new event listener for cart/data ---
  events.on(
    'cart/data',
    (cartData) => {
      let itemIsInCart = false;
      if (itemUidFromUrl && cartData?.items) {
        itemIsInCart = cartData.items.some(
          (item) => item.uid === itemUidFromUrl,
        );
      }
      // Set the update mode state
      isUpdateMode = itemIsInCart;

      // Update button text based on whether the item is in the cart
      updateAddToCartButtonText(addToCart, itemIsInCart, labels);
    },
    { eager: true },
  );

  // Set JSON-LD and Meta Tags
  events.on('aem/lcp', () => {
    const isPrerendered = isProductPrerendered();
    if (product && !isPrerendered) {
      setJsonLdProduct(product);
      setMetaTags(product);
      document.title = product.name;
    }
  }, { eager: true });

  return Promise.resolve();
}

async function setJsonLdProduct(product) {
  const {
    name,
    inStock,
    description,
    sku,
    urlKey,
    price,
    priceRange,
    images,
    attributes,
  } = product;
  const amount = priceRange?.minimum?.final?.amount || price?.final?.amount;
  const brand = attributes?.find((attr) => attr.name === 'brand');

  // get variants
  const { data } = await pdpApi.fetchGraphQl(`
    query GET_PRODUCT_VARIANTS($sku: String!) {
      variants(sku: $sku) {
        variants {
          product {
            sku
            name
            inStock
            images(roles: ["image"]) {
              url
            }
            ...on SimpleProductView {
              price {
                final { amount { currency value } }
              }
            }
          }
        }
      }
    }
  `, {
    method: 'GET',
    variables: { sku },
  });

  const variants = data?.variants?.variants || [];

  const ldJson = {
    '@context': 'http://schema.org',
    '@type': 'Product',
    name,
    description,
    image: images[0]?.url,
    offers: [],
    productID: sku,
    brand: {
      '@type': 'Brand',
      name: brand?.value,
    },
    url: new URL(getProductLink(urlKey, sku), window.location),
    sku,
    '@id': new URL(getProductLink(urlKey, sku), window.location),
  };

  if (variants.length > 1) {
    ldJson.offers.push(...variants.map((variant) => ({
      '@type': 'Offer',
      name: variant.product.name,
      image: variant.product.images[0]?.url,
      price: variant.product.price.final.amount.value,
      priceCurrency: variant.product.price.final.amount.currency,
      availability: variant.product.inStock ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock',
      sku: variant.product.sku,
    })));
  } else {
    ldJson.offers.push({
      '@type': 'Offer',
      price: amount?.value,
      priceCurrency: amount?.currency,
      availability: inStock ? 'http://schema.org/InStock' : 'http://schema.org/OutOfStock',
    });
  }

  setJsonLd(ldJson, 'product');
}

function createMetaTag(property, content, type) {
  if (!property || !type) {
    return;
  }
  let meta = document.head.querySelector(`meta[${type}="${property}"]`);
  if (meta) {
    if (!content) {
      meta.remove();
      return;
    }
    meta.setAttribute(type, property);
    meta.setAttribute('content', content);
    return;
  }
  if (!content) {
    return;
  }
  meta = document.createElement('meta');
  meta.setAttribute(type, property);
  meta.setAttribute('content', content);
  document.head.appendChild(meta);
}

function setMetaTags(product) {
  if (!product) {
    return;
  }

  const price = product.prices.final.minimumAmount ?? product.prices.final.amount;

  createMetaTag('title', product.metaTitle || product.name, 'name');
  createMetaTag('description', product.metaDescription, 'name');
  createMetaTag('keywords', product.metaKeyword, 'name');

  createMetaTag('og:type', 'product', 'property');
  createMetaTag('og:description', product.shortDescription, 'property');
  createMetaTag('og:title', product.metaTitle || product.name, 'property');
  createMetaTag('og:url', window.location.href, 'property');
  const mainImage = product?.images?.filter((image) => image.roles.includes('thumbnail'))[0];
  const metaImage = mainImage?.url || product?.images[0]?.url;
  createMetaTag('og:image', metaImage, 'property');
  createMetaTag('og:image:secure_url', metaImage, 'property');
  createMetaTag('product:price:amount', price.value, 'property');
  createMetaTag('product:price:currency', price.currency, 'property');
}

/**
 * Returns the configuration for an image slot.
 * @param ctx - The context of the slot.
 * @returns The configuration for the image slot.
 */
function imageSlotConfig(ctx) {
  const { data, defaultImageProps } = ctx;
  return {
    alias: data.sku,
    imageProps: defaultImageProps,

    params: {
      width: defaultImageProps.width,
      height: defaultImageProps.height,
    },
  };
}
