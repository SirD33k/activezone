// cartManager.js - Shared Shopping Cart Class

class ShoppingCart {
    constructor() {
        this.items = this.loadCart();
        this.updateCartCount();
    }

    loadCart() {
        const cart = localStorage.getItem('activeZoneCart');
        return cart ? JSON.parse(cart) : [];
    }

    saveCart() {
        localStorage.setItem('activeZoneCart', JSON.stringify(this.items));
        this.updateCartCount();
    }

    addItem(product) {
        const existingItem = this.items.find(item => item.productId === product.productId);
        
        if (existingItem) {
            // Check if adding one more exceeds stock limit
            if (product.maxStock && existingItem.quantity >= product.maxStock) {
                this.showNotification(`⚠️ Maximum stock reached for ${product.name}!`, 'warning');
                return;
            }
            existingItem.quantity += 1;
        } else {
            this.items.push({
                productId: product.productId,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1,
                maxStock: product.maxStock || 999 // Store max stock for validation
            });
        }
        
        this.saveCart();
        this.showNotification(`${product.name} added to cart!`, 'success');
    }

    updateCartCount() {
        const count = this.items.reduce((total, item) => total + item.quantity, 0);
        // Update cart count element (works with both navbar and store toolbar)
        const cartCountElement = document.getElementById('cartCount');
        if (cartCountElement) {
            cartCountElement.textContent = count;
            // Show/hide based on count
            if (cartCountElement.classList.contains('cart-count')) {
                cartCountElement.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    }

    showNotification(message, type = 'success') {
        // Create toast notification
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
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}
