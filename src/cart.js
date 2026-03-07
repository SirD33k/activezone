// cart.js - Shopping Cart Page Functionality

import { ShoppingCart } from './cartManager.js';

document.addEventListener('DOMContentLoaded', function () {
    const cart = new ShoppingCart();
    
    // Initialize cart page
    renderCart();
    
    function renderCart() {
        const cartItems = cart.items;
        const emptyCartEl = document.getElementById('emptyCart');
        const cartContentEl = document.getElementById('cartContent');
        const cartItemsEl = document.getElementById('cartItems');
        
        if (cartItems.length === 0) {
            // Show empty cart message
            emptyCartEl.style.display = 'flex';
            cartContentEl.style.display = 'none';
        } else {
            // Show cart items
            emptyCartEl.style.display = 'none';
            cartContentEl.style.display = 'flex';
            
            // Clear existing items
            cartItemsEl.innerHTML = '';
            
            // Render each cart item
            cartItems.forEach((item, index) => {
                const cartItem = createCartItemElement(item, index);
                cartItemsEl.appendChild(cartItem);
            });
            
            // Update summary
            updateCartSummary();
        }
    }
    
    function createCartItemElement(item, index) {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <div class="cart-item-image" style="background-image: url('${item.image}')"></div>
            <div class="cart-item-details">
                <h3>${item.name}</h3>
                <p class="cart-item-price">₦${formatNumber(item.price)}</p>
            </div>
            <div class="cart-item-quantity">
                <button class="qty-btn qty-minus" data-index="${index}" aria-label="Decrease quantity">−</button>
                <input type="number" class="qty-input" value="${item.quantity}" min="1" data-index="${index}" readonly>
                <button class="qty-btn qty-plus" data-index="${index}" aria-label="Increase quantity">+</button>
            </div>
            <div class="cart-item-total">
                <p class="item-total">₦${formatNumber(item.price * item.quantity)}</p>
            </div>
            <button class="cart-item-remove" data-index="${index}" aria-label="Remove item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        return itemEl;
    }
    
    function updateCartSummary() {
        const cartItems = cart.items;
        const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
        const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Update toolbar cart count
        const cartCountEl = document.getElementById('cartCount');
        if (cartCountEl) {
            cartCountEl.textContent = totalItems;
        }
        
        // Update summary
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('subtotal').textContent = formatNumber(subtotal);
        document.getElementById('total').textContent = formatNumber(subtotal);
    }
    
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    // Event delegation for cart item actions
    document.getElementById('cartItems').addEventListener('click', function (e) {
        const target = e.target.closest('button');
        if (!target) return;
        
        const index = parseInt(target.getAttribute('data-index'));
        
        if (target.classList.contains('qty-minus')) {
            // Decrease quantity
            if (cart.items[index].quantity > 1) {
                cart.items[index].quantity--;
                cart.saveCart();
                renderCart();
            }
        } else if (target.classList.contains('qty-plus')) {
            // Increase quantity - check stock limit
            const item = cart.items[index];
            const maxStock = item.maxStock || 999;
            
            if (item.quantity >= maxStock) {
                showNotification(`⚠️ Maximum stock (${maxStock}) reached for ${item.name}!`, 'warning');
                return;
            }
            
            cart.items[index].quantity++;
            cart.saveCart();
            renderCart();
        } else if (target.classList.contains('cart-item-remove')) {
            // Remove item
            if (confirm('Remove this item from cart?')) {
                cart.items.splice(index, 1);
                cart.saveCart();
                renderCart();
                
                // Show notification
                showNotification('Item removed from cart');
            }
        }
    });
    
    function showNotification(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `cart-toast cart-toast-${type}`;
        
        const icon = type === 'success' ? `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9 12l2 2 4-4"/>
            </svg>
        ` : `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
            </svg>
        `;
        
        toast.innerHTML = `
            ${icon}
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
