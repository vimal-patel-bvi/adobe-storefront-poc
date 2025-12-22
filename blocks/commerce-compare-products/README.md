# Commerce Compare Products Block

## Overview

The Commerce Compare Products block provides product comparison functionality. It displays products that have been added to the comparison list from localStorage, allowing users to view and compare multiple products side by side. Users can remove products from comparison, add products to cart, and navigate to product detail pages.

## Integration

### Block Configuration

| Configuration Key | Type | Default | Description | Required | Side Effects |
|-------------------|------|---------|-------------|----------|--------------|
| `start-shopping-url` | string | `''` | URL for "Start Shopping" button when comparison list is empty | No | Sets destination for empty comparison CTA |

### Local Storage

- `comparedProducts` - Array of product SKUs stored in localStorage for comparison functionality

### Events

#### Event Listeners

- `events.on('authenticated', callback)` - Listens for user authentication to close auth modal

## Behavior Patterns

### Page Context Detection

- **Authenticated Users**: When user is authenticated, provides full comparison functionality with add to cart
- **Unauthenticated Users**: When user is not authenticated, shows authentication modal when attempting to add to cart
- **Empty Comparison**: When comparison list is empty, shows empty state message with Start Shopping CTA

### User Interaction Flows

1. **Initialization**: Block reads compared products from localStorage and fetches product data
2. **Product Display**: Renders product cards in a grid layout with images, names, prices, and actions
3. **Remove from Comparison**: Users can remove products from comparison, which updates localStorage and reloads the page
4. **Add to Cart**: Authenticated users can add products to cart directly from comparison page
5. **Authentication Flow**: Unauthenticated users are prompted to sign in when attempting to add to cart
6. **Product Navigation**: Users can navigate to product detail pages by clicking on product names

### Error Handling

- **API Errors**: If product data API fails, products are filtered out and empty state is shown if no products remain
- **Configuration Errors**: If `readBlockConfig()` fails, uses default configuration values
- **Image Rendering Errors**: If product images fail to load, the image slots handle fallback behavior
- **LocalStorage Errors**: If localStorage parsing fails, clears corrupted data and shows empty state
- **Fallback Behavior**: Always falls back to empty state for missing or invalid data

## Technical Details

### Product Data Fetching

The block fetches product data using the Catalog Service API (`pdpApi.getProductData`) for all SKUs stored in localStorage. Products are fetched in parallel using `Promise.all()` for optimal performance.

### Comparison Storage

Products are stored in localStorage as an array of SKUs under the key `comparedProducts`. The format is:
```json
["SKU1", "SKU2", "SKU3"]
```

### Image Rendering

Product images are rendered using AEM Assets integration with fallback handling. Images are displayed at 200x200 pixels with object-fit: contain to maintain aspect ratio.



