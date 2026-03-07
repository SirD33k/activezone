const express = require('express');
const router = express.Router();

const GYM_MASTER_CONFIG = {
    apiKey: process.env.GYM_MASTER_API_KEY,
    baseUrl: process.env.GYM_MASTER_BASE_URL,
    companyId: process.env.GYM_MASTER_COMPANY_ID
};

// In-memory cache for products (refreshed on each request in serverless)
let productsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

async function fetchProductsFromGymMaster() {
    if (!GYM_MASTER_CONFIG.apiKey || !GYM_MASTER_CONFIG.baseUrl) {
        console.log('Gym Master API credentials not configured');
        return [];
    }
    
    try {
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/products?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}`;
        
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            let products = data.result || [];
            
            // Filter out delivery/pickup products
            const DELIVERY_PICKUP = [730312, 730313];
            products = products.filter(p => !DELIVERY_PICKUP.includes(parseInt(p.productid)));
            
            console.log(`Fetched ${products.length} products from Gym Master API`);
            return products;
        } else {
            console.error('Gym Master API returned status:', response.status);
        }
    } catch (error) {
        console.error('Gym Master API error:', error.message);
    }
    return [];
}

router.get('/', async (req, res) => {
    try {
        // Check if API credentials are configured
        if (!GYM_MASTER_CONFIG.apiKey || !GYM_MASTER_CONFIG.baseUrl) {
            console.log('Gym Master API credentials not configured - returning empty products');
            return res.json({ 
                success: true, 
                products: [], 
                cached: false,
                message: 'API credentials not configured. Please set GYM_MASTER_API_KEY, GYM_MASTER_BASE_URL, and GYM_MASTER_COMPANY_ID in Vercel environment variables.'
            });
        }
        
        // Check if cache is still valid
        const now = Date.now();
        if (productsCache && (now - cacheTimestamp) < CACHE_TTL) {
            console.log('Returning cached products');
            return res.json({ success: true, products: productsCache, cached: true });
        }
        
        // Fetch fresh products from Gym Master
        const products = await fetchProductsFromGymMaster();
        
        // Update cache
        productsCache = products;
        cacheTimestamp = now;
        
        res.json({ success: true, products, cached: false });
    } catch (error) {
        console.error('Error fetching products:', error);
        // Return empty products instead of 500 error
        res.json({ 
            success: true, 
            products: [], 
            cached: false,
            error: error.message 
        });
    }
});

router.post('/check-stock', async (req, res) => {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ success: false, error: 'Items array required' });
    }

    try {
        // Fetch products from cache or Gym Master
        const products = productsCache || await fetchProductsFromGymMaster();
        
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
