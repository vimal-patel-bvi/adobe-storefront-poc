# Product List Page Block

## Overview

The Product List Page block provides product listing functionality for both category pages and search results. It displays products in a grid layout with filtering, sorting, pagination, and product actions including add to cart, wishlist, and compare functionality. The block integrates with the Product Discovery API to fetch and display products based on category paths or search queries.

## Integration

### Block Configuration

| Configuration Key | Type | Default | Description | Required | Side Effects |
|-------------------|------|---------|-------------|----------|--------------|
| `urlpath` | string | `''` | Category URL path for category page filtering | No | Sets category filter when present, enables category page mode |

### URL Parameters

- `q` - Search query phrase for search page mode
- `page` - Current page number for pagination (default: 1)
- `sort` - Sort parameters in format `attribute_direction` (e.g., `price_ASC`, `name_DESC`)
- `filter` - Filter parameters in format `attribute:value` separated by `|` (e.g., `category:electronics|price:10-100`)

### Local Storage

- `comparedProducts` - Array of product SKUs stored in localStorage for comparison functionality (max 3 products)

### Events

#### Event Listeners

- `events.on('search/result', callback)` - Listens for search results to update UI and URL parameters
- `events.on('compare-products-updated', callback)` - Listens for compare list changes to update compare button states

#### Event Emitters

- `events.emit('compare-products-updated')` - Emitted when products are added or removed from compare list

## Behavior Patterns

### Page Context Detection

- **Category Page Mode**: When `urlpath` configuration is present, filters products by category path
- **Search Page Mode**: When `urlpath` is not present, uses search query from URL parameter `q`
- **Product Actions**: Each product card displays Add to Cart, Wishlist, and Compare buttons
- **Filtering**: Users can filter products using facets sidebar (desktop) or mobile filter button
- **Sorting**: Users can sort products by various attributes (price, name, position, etc.)
- **Pagination**: Products are paginated with 8 products per page

### User Interaction Flows

1. **Initialization**: Block reads configuration and URL parameters, then fetches products based on page type
2. **Product Display**: Renders products in a grid with images, names, prices, and action buttons
3. **Add to Cart**: Simple products can be added directly to cart; complex products redirect to product detail page
4. **Wishlist Management**: Users can add/remove products from wishlist using wishlist toggle button
5. **Compare Products**: Users can add/remove products from compare list (max 3 products) using icon-only compare button
6. **Filtering**: Users can filter products using facets, which updates URL and triggers new search
7. **Sorting**: Users can sort products, which updates URL and triggers new search
8. **Pagination**: Users can navigate between pages, which scrolls to top and updates URL

### Error Handling

- **API Errors**: If product search API fails, logs error to console
- **Configuration Errors**: If `readBlockConfig()` fails, uses default configuration values
- **Image Rendering Errors**: If product images fail to load, the image slots handle fallback behavior
- **Compare Errors**: If compare operations fail, logs warning to console and re-enables button
- **LocalStorage Errors**: If localStorage operations fail, logs error and continues with empty compare list

## Features

### Product Actions

Each product card includes three action buttons:

1. **Add to Cart Button**
   - Primary variant button
   - For simple products: Adds product directly to cart
   - For complex products: Redirects to product detail page for configuration
   - Includes cart icon

2. **Wishlist Toggle Button**
   - Tertiary variant button
   - Icon-only button
   - Toggles product in/out of wishlist
   - Uses WishlistToggle container component

3. **Compare Button**
   - Tertiary variant button
   - Icon-only button (saves space)
   - Shows "Add" icon when product is not in compare list
   - Shows "Close" icon when product is in compare list
   - Maximum of 3 products can be compared
   - Updates header counter when products are added/removed
   - Includes aria-label for accessibility

### Filtering and Sorting

- **Facets**: Sidebar filters on desktop, toggleable panel on mobile
- **Sort Options**: Multiple sort attributes with ascending/descending directions
- **URL Synchronization**: All filters and sorts are reflected in URL parameters
- **Filter Count Badge**: Shows number of active filters on filter button

### Pagination

- **Page Size**: 8 products per page
- **Navigation**: Previous/Next and page number buttons
- **Auto Scroll**: Automatically scrolls to top when page changes
- **URL Updates**: Page number is reflected in URL parameter

## Technical Details

### Product Data Fetching

The block uses the Product Discovery API (`search` function) to fetch products. For category pages, it filters by `categoryPath`. For search pages, it uses the search `phrase` parameter.

### Compare Functionality

Products are stored in localStorage as an array of SKUs under the key `comparedProducts`. The format is:
```json
["SKU1", "SKU2", "SKU3"]
```

The compare functionality includes:
- Maximum limit of 3 products
- Real-time state updates
- Event-driven updates across components
- Icon-only button design for space efficiency

### Image Rendering

Product images are rendered using AEM Assets integration with fallback handling. Images are displayed with proper aspect ratios and lazy loading.

### URL Parameter Encoding

- **Sort**: Encoded as `attribute_direction` (e.g., `price_ASC`)
- **Filter**: Encoded as `attribute:value` separated by `|` (e.g., `category:electronics|price:10-100`)
- **Multiple Values**: Array values are comma-separated (e.g., `category:electronics,computers`)
- **Range Values**: Range filters use dash separator (e.g., `price:10-100`)

### Responsive Design

- **Mobile**: Facets are hidden by default, accessible via filter button
- **Desktop**: Facets are always visible in sidebar
- **Product Actions**: Buttons are arranged horizontally with proper spacing
- **Grid Layout**: Product grid adapts to screen size

## Dependencies

- `@dropins/storefront-product-discovery` - Product search and discovery functionality
- `@dropins/storefront-wishlist` - Wishlist functionality
- `@dropins/storefront-cart` - Cart operations
- `@dropins/tools` - UI components and utilities
- AEM Assets integration for product images

## Styling

The block uses CSS classes prefixed with `.block.product-list-page` and `.product-discovery-product-actions` for styling. The compare button has specific styling to ensure icon visibility:

```css
.product-discovery-product-actions__compare-toggle button {
    min-width: 40px;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}
```



