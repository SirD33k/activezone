// Store.js - RDX Store functionality with Shopping Cart

import { ShoppingCart } from './cartManager.js';

// Initialize cart
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
    
    // Don't show loading state - keep static products visible while fetching
    // This provides a better user experience
    
    try {
        const response = await fetch(API_BASE + '/products');
        const result = await response.json();
        
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
            
            if (inStockProducts.length >= 5) {
                // Only replace content if we have a good number of products from API
                console.log(`Rendering ${inStockProducts.length} products from API`);
                renderProducts(inStockProducts);
            } else {
                console.log(`Only ${inStockProducts.length} products from API, keeping static content`);
                // Don't replace content, just ensure cart works
                attachAddToCartListeners();
            }
        } else {
            // If API returns no products, keep static content
            console.log('API returned no products, keeping static content');
            // Restore original content if it was replaced
            if (productsGrid.innerHTML !== originalContent) {
                productsGrid.innerHTML = originalContent;
            }
            attachAddToCartListeners();
        }
    } catch (error) {
        console.error('Error fetching products:', error);
        
        // Restore original static content on error
        productsGrid.innerHTML = originalContent;
        
        // Ensure cart works with restored content
        attachAddToCartListeners();
        
        // Show a small retry notification at the top
        const notification = document.createElement('div');
        notification.style.cssText = 'background: #d4af37; color: #000; padding: 10px; text-align: center; margin-bottom: 20px; border-radius: 5px;';
        notification.innerHTML = 'Using offline product data. <button style="margin-left: 10px; padding: 5px 15px; cursor: pointer; border: none; background: #000; color: #fff; border-radius: 3px;">Retry</button>';
        notification.querySelector('button').onclick = () => {
            notification.remove();
            fetchAndRenderProducts();
        };
        productsGrid.parentNode.insertBefore(notification, productsGrid);
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

// Flag to track if filter delegation is set up
let filterDelegationSetup = false;

function setupFilters() {
    // Only set up once using event delegation
    if (filterDelegationSetup) {
        console.log('Filter delegation already set up');
        return;
    }
    
    console.log('Setting up filter event delegation');
    
    // Use event delegation for filter buttons
    document.addEventListener('click', function(e) {
        const filterBtn = e.target.closest('.filter-btn');
        
        if (!filterBtn) return;
        
        console.log('Filter button clicked!');
        
        // Update active button
        const allFilterBtns = document.querySelectorAll('.filter-btn');
        allFilterBtns.forEach(btn => btn.classList.remove('active'));
        filterBtn.classList.add('active');

        const category = filterBtn.getAttribute('data-category');
        console.log('Filter clicked:', category);
        
        const productCards = document.querySelectorAll('.product-card');
        let visibleCount = 0;

        // Filter products
        productCards.forEach(card => {
            const cardCategory = card.getAttribute('data-category');

            if (category === 'all' || cardCategory === category) {
                card.classList.remove('hidden');
                visibleCount++;
            } else {
                card.classList.add('hidden');
            }
        });

        console.log('Products visible:', visibleCount);
    });
    
    filterDelegationSetup = true;
    console.log('Filter event delegation set up successfully');
}

// Flag to track if event delegation is already set up
let delegationSetup = false;

function attachAddToCartListeners() {
    // Only set up delegation once
    if (delegationSetup) {
        console.log('Event delegation already set up, skipping');
        return;
    }
    
    // Use event delegation on document for better reliability
    // This works for both static and dynamically added products
    document.addEventListener('click', function(e) {
        const button = e.target.closest('.btn-add-to-cart');
        
        if (!button) return;
        
        e.preventDefault();
        
        const productCard = button.closest('.product-card');
        
        if (!productCard) {
            console.error('Product card not found');
            return;
        }
        
        // Get product ID
        const productId = button.getAttribute('data-product-id');
        const productLink = button.getAttribute('data-link');
        const stockLevel = parseInt(button.getAttribute('data-stock')) || 999;
        
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
        
        // Get product details from the card
        const nameElement = productCard.querySelector('h3');
        const priceElement = productCard.querySelector('.product-price');
        const imageElement = productCard.querySelector('.product-image');
        
        if (!nameElement || !priceElement || !imageElement) {
            console.error('Missing product details');
            return;
        }
        
        const product = {
            productId: productId,
            name: nameElement.textContent,
            price: parseFloat(priceElement.textContent.replace('₦', '').replace(/,/g, '')),
            image: imageElement.style.backgroundImage.slice(5, -2),
            maxStock: stockLevel
        };
        
        console.log('Adding to cart:', product);
        cart.addItem(product);
    });
    
    delegationSetup = true;
    console.log('Cart event listeners attached via delegation');
}
