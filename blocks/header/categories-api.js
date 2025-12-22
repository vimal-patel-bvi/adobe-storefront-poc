/**
 * Fetches categories from the API
 * @returns {Promise<Object>} The categories response from the API
 */
export async function fetchCategories() {
  // Get BASE_URL from window (set via environment variable at build/runtime) or use default
  // BASE_URL should be set as: window.BASE_URL = 'https://748062-appbuilderpoc-stage.adobeio-static.net/api/v1/web'
  const baseUrl = window.BASE_URL || 'https://748062-appbuilderpoc-stage.adobeio-static.net/api/v1/web';
  const apiUrl = `${baseUrl}/poc-appbuilder-storefront/get-categories`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

/**
 * Transforms category data into navigation HTML structure
 * @param {Object} categoryData - The category data from API
 * @returns {HTMLElement} The navigation sections element
 */
export function transformCategoriesToNav(categoryData) {
  const navSections = document.createElement('div');
  navSections.classList.add('nav-sections');
  
  const defaultContentWrapper = document.createElement('div');
  defaultContentWrapper.classList.add('default-content-wrapper');
  
  const ul = document.createElement('ul');
  
  // Process children_data (level 2 categories)
  if (categoryData.children_data && Array.isArray(categoryData.children_data)) {
    categoryData.children_data
      .filter(category => category.is_active) // Only include active categories
      .sort((a, b) => a.position - b.position) // Sort by position
      .forEach((category) => {
        const li = document.createElement('li');
        
        // Create main category link
        const categoryLink = document.createElement('a');
        categoryLink.href = `/category/${category.id}`;
        categoryLink.textContent = category.name;
        li.appendChild(categoryLink);
        
        // If category has children, create submenu
        if (category.children_data && Array.isArray(category.children_data) && category.children_data.length > 0) {
          const submenuUl = document.createElement('ul');
          
          category.children_data
            .filter(child => child.is_active) // Only include active subcategories
            .sort((a, b) => a.position - b.position) // Sort by position
            .forEach((childCategory) => {
              const submenuLi = document.createElement('li');
              const submenuLink = document.createElement('a');
              submenuLink.href = `/category/${childCategory.id}`;
              submenuLink.textContent = childCategory.name;
              submenuLi.appendChild(submenuLink);
              submenuUl.appendChild(submenuLi);
            });
          
          li.appendChild(submenuUl);
        }
        
        ul.appendChild(li);
      });
  }
  
  defaultContentWrapper.appendChild(ul);
  navSections.appendChild(defaultContentWrapper);
  
  return navSections;
}

