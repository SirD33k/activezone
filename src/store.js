// Store.js - RDX Store functionality with Shopping Cart

// Initialize cart (ShoppingCart class is loaded from cartManager.js)
const cart = new ShoppingCart();
// For local development, use backend port directly. For production, use relative path
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : window.location.origin + '/api';

// ============================================
// FETCH AND RENDER PRODUCTS FROM GYM MASTER API
// ============================================

async function fetchAndRenderProducts() {
    const productsGrid = document.querySelector('.products-grid');
    
    if (!productsGrid) {
        console.error('Products grid not found!');
        return;
    }
    
    // Store original static content as fallback
    const originalContent = productsGrid.innerHTML;
    
    // Only show loading state if API takes longer than 500ms
    let loadingTimeout;
    let showLoading = false;
    
    const showLoadingState = () => {
        if (!showLoading) {
            showLoading = true;
            productsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">Loading products...</div>';
        }
    };
    
    // Set timeout to show loading after 500ms
    loadingTimeout = setTimeout(showLoadingState, 500);
    
    try {
        const response = await fetch(API_BASE + '/products');
        const result = await response.json();
        
        // Clear the loading timeout since we got a response
        clearTimeout(loadingTimeout);
        
        console.log('Products API response:', result);
        
        if (result.success && result.products && result.products.length > 0) {
            console.log('Sample product:', JSON.stringify(result.products[0], null, 2));
            
            // Filter out delivery and pickup products (730312 and 730313) as these are service items
            const DELIVERY_PICKUP_PRODUCTS = [730312, 730313];
            const filteredProducts = result.products.filter(product => {
                return !DELIVERY_PICKUP_PRODUCTS.includes(parseInt(product.productid));
            });
            
            console.log(`${result.products.length} total products, ${filteredProducts.length} after filtering out delivery/pickup`);
            
            // Filter out products with zero stock (maxquantity)
            const inStockProducts = filteredProducts.filter(product => {
                const stock = product.maxquantity || 0;
                return stock > 0;
            });
            
            console.log(`${filteredProducts.length} filtered products, ${inStockProducts.length} in stock`);
            
            // Log some sample products for debugging
            if (inStockProducts.length > 0) {
                console.log('First few in-stock products:');
                inStockProducts.slice(0, 3).forEach((product, index) => {
                    console.log(`  ${index + 1}. ${product.name} (ID: ${product.productid}, Stock: ${product.maxquantity})`);
                });
            }
            
            if (inStockProducts.length > 0) {
                // Only replace content if we have a reasonable number of products
                if (inStockProducts.length >= 3) {
                    console.log(`Rendering ${inStockProducts.length} products from API`);
                    // Only show loading if we're actually going to replace content
                    if (!showLoading) {
                        showLoadingState();
                    }
                    renderProducts(inStockProducts);
                } else {
                    console.log(`Only ${inStockProducts.length} products from API, keeping static content`);
                    // Don't replace content, just ensure cart works
                    attachAddToCartListeners();
                }
            } else {
                // If no in-stock products from API, keep static content
                console.log('No in-stock products from API, keeping static content');
                // Don't replace content, just ensure cart works
                attachAddToCartListeners();
            }
        } else {
            // If API returns no products, keep static content
            console.log('API returned no products, keeping static content');
            // Don't replace content, just ensure cart works
            attachAddToCartListeners();
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        
        // Clear the loading timeout
        clearTimeout(loadingTimeout);
        
        // If API fails, keep static content but add refresh option
        // Don't replace content, just ensure cart works
        attachAddToCartListeners();
        
        // Add a refresh button after the existing content
        const refreshButton = document.createElement("button");
        refreshButton.textContent = "Retry API Connection";
        refreshButton.className = "btn-primary";
        refreshButton.style.margin = "20px auto";
        refreshButton.style.display = "block";
        refreshButton.style.padding = "12px 24px";
        refreshButton.onclick = fetchAndRenderProducts;
        
        // Append to products grid
        productsGrid.appendChild(refreshButton);
    }
}

function renderProducts(products) {
    const productsGrid = document.querySelector('.products-grid');
    productsGrid.innerHTML = '';
    
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.setAttribute('data-category', getCategoryFromProduct(product));
        
        // Use the correct API field names
        const imageUrl = product.image || 'https://via.placeholder.com/300x200?text=No+Image';
        const productId = product.productid || product.id;
        const productName = product.name || 'Unnamed Product';
        const productPrice = product.price || 0;
        const stockLevel = product.maxquantity || 0;
        
        // Determine stock status badge (zero stock already filtered out)
        // Don't show exact numbers - internal data only
        let stockBadge = '';
        
        if (stockLevel <= 2) {
            stockBadge = `<span class="stock-badge low-stock">⚠️ Low Stock - Order Now!</span>`;
        } else {
            stockBadge = `<span class="stock-badge in-stock">✅ In Stock</span>`;
        }
        
        productCard.innerHTML = `
            <div class="product-image" style="background-image: url('${imageUrl}')">
                ${stockBadge}
            </div>
            <h3>${productName}</h3>
            <p class="product-price">₦${formatPrice(productPrice)}</p>
            <button class="btn-add-to-cart" data-product-id="${productId}" data-stock="${stockLevel}">
                <i class="fas fa-shopping-cart"></i> Add to Cart
            </button>
        `;
        
        productsGrid.appendChild(productCard);
    });
    
    // Re-attach event listeners after rendering
    attachAddToCartListeners();
}

function getCategoryFromProduct(product) {
    // Map product to category based on Gym Master product groups
    const name = (product.name || '').toUpperCase();
    const group = (product.producttype || product.group || product.productGroup || '').toUpperCase();
    
    // Check product name and group for category keywords
    const text = name + ' ' + group;
    
    // Gloves category
    if (text.includes('BOXING GLOVE') || text.includes('GYM GLOVE') || 
        text.includes('TRAINING GLOVE') || text.includes('GRAPPLING GLOVE') || 
        text.includes('GLOVE')) {
        return 'gloves';
    }
    
    // Belts category
    if (text.includes('LEATHER BELT') || text.includes('WEIGHT LIFTING BELT') || 
        text.includes('LIFTING BELT') || text.includes('BELT')) {
        return 'belts';
    }
    
    // Wraps category
    if (text.includes('GYM STRAP') || text.includes('KNEE WRAP') || text.includes('WRIST WRAP') || text.includes('STRAP')) {
        return 'wraps';
    }
    
    // Apparel category
    if (text.includes('T-SHIRT') || text.includes('SHIRT') || text.includes('RASH GUARD') || 
        text.includes('SHORTS') || text.includes('SHORT') || text.includes('TROUSER') || 
        text.includes('LEGGING') || text.includes('WOMEN')) {
        return 'apparel';
    }
    
    // Accessories category (default for items like ANKLE PRO, BAR PAD, etc.)
    if (text.includes('ANKLE PRO') || text.includes('BAR PAD') || text.includes('ACCESSORIES')) {
        return 'accessories';
    }
    
    // Default to accessories for unmatched items
    return 'accessories';
}

function formatPrice(price) {
    // Remove any existing currency symbols and convert to number
    const numericPrice = typeof price === 'string' ? 
        parseFloat(price.replace(/[^0-9.]/g, '')) : price;
    
    // Format with commas
    return numericPrice.toLocaleString('en-NG', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2 
    });
}

// ============================================
// PRODUCT FILTERING
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('Store page loaded');
    
    // First, ensure static content has proper cart functionality
    attachAddToCartListeners();
    
    // Setup filter functionality immediately
    setupFilters();
    
    // Try API call but be very conservative about replacing content
    fetchAndRenderProducts();
});

function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    console.log('Setting up filters - Buttons:', filterButtons.length);

    if (filterButtons.length === 0) {
        console.error('No filter buttons found!');
        return;
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            console.log('Filter button clicked!');

            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            const category = this.getAttribute('data-category');
            console.log('Filter clicked:', category);
            
            const productCards = document.querySelectorAll('.product-card');
            let visibleCount = 0;

            // Filter products
            productCards.forEach(card => {
                const cardCategory = card.getAttribute('data-category');
                console.log('Card category:', cardCategory, '| Filter:', category);

                if (category === 'all' || cardCategory === category) {
                    card.classList.remove('hidden');
                    visibleCount++;
                } else {
                    card.classList.add('hidden');
                }
            });

            console.log('Products visible:', visibleCount);
        });
    });
}

function attachAddToCartListeners() {
    const addToCartButtons = document.querySelectorAll('.btn-add-to-cart');

    addToCartButtons.forEach(button => {
        button.addEventListener('click', function () {
            const productCard = this.closest('.product-card');
            
            // Get product ID and stock level
            const productId = this.getAttribute('data-product-id');
            const productLink = this.getAttribute('data-link');
            const stockLevel = parseInt(this.getAttribute('data-stock'));
            
            // If it has a data-link attribute, it's an external link, not for cart
            if (productLink) {
                // Open external link in new tab
                window.open(productLink, '_blank');
                return;
            }
            
            if (!productId) {
                console.error('No product ID found for this product');
                return;
            }
            
            const product = {
                productId: productId,
                name: productCard.querySelector('h3').textContent,
                price: parseFloat(productCard.querySelector('.product-price').textContent.replace('₦', '').replace(',', '')),
                image: productCard.querySelector('.product-image').style.backgroundImage.slice(5, -2),
                maxStock: stockLevel
            };

            cart.addItem(product);
        });
    });
}
