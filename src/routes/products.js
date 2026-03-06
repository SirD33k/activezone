const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const PRODUCTS_FILE = path.join(__dirname, '../../../products-data.json');

const GYM_MASTER_CONFIG = {
    apiKey: process.env.GYM_MASTER_API_KEY,
    baseUrl: process.env.GYM_MASTER_BASE_URL,
    companyId: process.env.GYM_MASTER_COMPANY_ID
};

function loadProducts() {
    try {
        if (fs.existsSync(PRODUCTS_FILE)) {
            const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error loading products:', error.message);
        return [];
    }
}

function saveProducts(products) {
    try {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving products:', error.message);
        return false;
    }
}

router.get('/', async (req, res) => {
    try {
        let products = loadProducts();
        
        // If no local products, try fetching from Gym Master
        if (!products || products.length === 0) {
            try {
                const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/products?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}`;
                
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    products = data.result || [];
                    
                    // Filter out delivery/pickup products
                    const DELIVERY_PICKUP = [730312, 730313];
                    products = products.filter(p => !DELIVERY_PICKUP.includes(parseInt(p.productid)));
                    
                    // Save to local file for caching
                    saveProducts(products);
                }
            } catch (apiError) {
                console.error('Gym Master API error:', apiError.message);
            }
        }
        
        res.json({ success: true, products });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch products' });
    }
});

router.post('/check-stock', async (req, res) => {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Items array required' });
    }

    try {
        let products = loadProducts();
        
        // If no local products, fetch from Gym Master
        if (!products || products.length === 0) {
            const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/products?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                products = data.result || [];
            }
        }
        
        const results = items.map(item => {
            const product = products.find(p => p.id === item.id || p.productid === item.id);
            if (!product) {
                return { id: item.id, available: false, error: 'Product not found' };
            }
            const available = (product.maxquantity || 0) >= item.quantity;
            return {
                id: item.id,
                name: product.name,
                available,
                quantity: product.maxquantity || 0,
                requested: item.quantity
            };
        });

        const allAvailable = results.every(r => r.available);

        res.json({
            success: true,
            allAvailable,
            results
        });
    } catch (error) {
        console.error('Error checking stock:', error);
        res.status(500).json({ success: false, error: 'Failed to check stock' });
    }
});

module.exports = router;
