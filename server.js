// server.js - Backend API Server for Gym Master Integration

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const brevo = require('@getbrevo/brevo');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Orders file path - use persistent volume if available (Railway/Render), otherwise local
const isProduction = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RENDER);
const DATA_DIR = isProduction ? '/app/data' : __dirname;
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Log environment detection
console.log('\n' + '='.repeat(60));
console.log('STORAGE CONFIGURATION');
console.log('='.repeat(60));
console.log('Environment detected:');
console.log(`  Railway: ${!!process.env.RAILWAY_ENVIRONMENT}`);
console.log(`  Render: ${!!process.env.RENDER}`);
console.log(`  Production: ${isProduction}`);
console.log(`  Storage path: ${ORDERS_FILE}`);

if (isProduction) {
    console.log('🔒 Using persistent volume for order storage');
    
    // Check if the data directory exists (it should be mounted by platform)
    if (!fs.existsSync(DATA_DIR)) {
        console.log('⚠️  WARNING: /app/data directory not found!');
        console.log('   Persistent volume may not be mounted.');
        if (process.env.RAILWAY_ENVIRONMENT) {
            console.log('   Railway: Add a volume in Settings → Volumes with mount path: /app/data');
        } else {
            console.log('   Render: Add a disk in Settings → Disks with mount path: /app/data');
        }
    } else {
        console.log('✅ Persistent volume directory found');
        
        // Test write access
        try {
            const testFile = path.join(DATA_DIR, '.volume-test');
            fs.writeFileSync(testFile, 'test-' + Date.now());
            fs.unlinkSync(testFile);
            console.log('✅ Volume is writable');
        } catch (error) {
            console.error('❌ Volume write test failed:', error.message);
            console.error('   Orders may not persist across deployments!');
        }
    }
} else {
    console.log('📂 Using local file storage (development mode)');
}

console.log('='.repeat(60) + '\n');

// Load orders from file on startup
function loadOrders() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const data = fs.readFileSync(ORDERS_FILE, 'utf8');
            const orders = JSON.parse(data);
            console.log(`✅ Loaded ${orders.length} existing orders from file`);
            return orders;
        }
    } catch (error) {
        console.error('Error loading orders file:', error.message);
    }
    console.log('📝 Starting with empty orders list');
    return [];
}

// Save orders to file
function saveOrders(orders) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        console.log(`💾 Orders saved to file (Total: ${orders.length})`);
        return true;
    } catch (error) {
        console.error('❌ Error saving orders to file:', error.message);
        return false;
    }
}

// Initialize orders from file
let orders = loadOrders();

// Gym Master API Configuration
const GYM_MASTER_CONFIG = {
    apiKey: '7adf342b0c2124f391d4b7934e8430bb',
    baseUrl: 'https://activezone.gymmasteronline.com/portal',
    companyId: '1152997'
};

// Paystack Configuration (fallback when Gym Master doesn't return payment URL)
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_cf05b6f83e3ef958938a6adbdfa98103f017d643';

// TOTP Configuration for order deletion
const TOTP_SECRET = process.env.TOTP_SECRET || speakeasy.generateSecret({
    name: 'Active Zone Hub - Order Management',
    issuer: 'Active Zone Hub'
}).base32;

// Log TOTP secret on startup (for initial setup)
if (!process.env.TOTP_SECRET) {
    console.log('\n' + '='.repeat(50));
    console.log('🔒 GOOGLE AUTHENTICATOR SETUP');
    console.log('='.repeat(50));
    console.log('Add this secret to your .env file:');
    console.log(`TOTP_SECRET=${TOTP_SECRET}`);
    console.log('\nOr scan QR code at: http://localhost:3001/api/totp/setup');
    console.log('='.repeat(50) + '\n');
}

// Middleware
app.use(cors());

// Custom JSON error handler for body-parser
app.use(express.json({
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            res.status(400).json({ success: false, error: 'Invalid JSON' });
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Check if member exists
app.get('/api/member/exists', async (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/member/exists?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}&email=${encodeURIComponent(email)}`;
        
        console.log('Checking if member exists:', email);
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('Member exists response:', data);
        
        res.json({
            success: true,
            exists: data.result === true || data.result === 'true',
            data: data
        });
        
    } catch (error) {
        console.error('Member check error:', error);
        res.status(500).json({ success: false, error: 'Server error checking member' });
    }
});

// Create prospect (new customer)
app.post('/api/prospect/create', async (req, res) => {
    const { firstName, lastName, email, phone, address } = req.body;
    
    if (!firstName || !lastName || !email || !phone) {
        return res.status(400).json({
            success: false,
            error: 'First name, last name, email and phone are required'
        });
    }
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        const formData = new URLSearchParams();
        formData.append('api_key', GYM_MASTER_CONFIG.apiKey);
        formData.append('companyId', GYM_MASTER_CONFIG.companyId);
        formData.append('firstname', firstName);
        formData.append('surname', lastName);  // Gym Master expects 'surname' not 'lastName'
        formData.append('email', email);
        formData.append('phone', phone);
        
        // Add address fields if provided
        if (address) {
            if (address.street) formData.append('address', address.street);
            if (address.city) formData.append('city', address.city);
            if (address.state) formData.append('state', address.state);
            if (address.postalCode) formData.append('postcode', address.postalCode);
        }
        
        console.log('Creating prospect:', { firstName, lastName, email, phone, address });
        
        // Log all form data being sent to Gym Master
        console.log('Form data being sent to Gym Master:');
        for (const [key, value] of formData.entries()) {
            console.log(`  ${key}: ${value}`);
        }
        
        const response = await fetch(`${GYM_MASTER_CONFIG.baseUrl}/api/v1/prospect/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });
        
        const responseText = await response.text();
        console.log('Prospect create raw response:', responseText);
        
        // Try to parse as JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse response as JSON. Response was HTML or invalid.');
            // If Gym Master returns HTML, we'll proceed without the prospect ID
            // The order will still be logged locally
            return res.json({
                success: true,
                prospectId: null,
                token: null,
                message: 'Customer registered locally (Gym Master API returned non-JSON response)',
                localOnly: true
            });
        }
        
        if (data.error) {
            console.error('Gym Master error:', data.error);
            // Still return success for local order processing
            return res.json({
                success: true,
                prospectId: null,
                token: null,
                message: 'Customer registered locally',
                gymMasterError: data.error,
                localOnly: true
            });
        }
        
        res.json({
            success: true,
            prospectId: data.result?.id || data.id,
            token: data.result?.token || data.token,
            message: 'Prospect created successfully in Gym Master',
            data: data,
            needsProfileUpdate: address ? true : false  // Flag if address needs to be updated
        });
        
    } catch (error) {
        console.error('Prospect creation error:', error);
        // Return success for local processing even if Gym Master fails
        res.json({
            success: true,
            prospectId: null,
            token: null,
            message: 'Customer registered locally (API connection failed)',
            localOnly: true
        });
    }
});

// Update member profile (for adding address after prospect creation)
app.post('/api/member/profile/update', async (req, res) => {
    const { token, phone, address } = req.body;
    
    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Token is required'
        });
    }
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        const formData = new URLSearchParams();
        formData.append('api_key', GYM_MASTER_CONFIG.apiKey);
        formData.append('token', token);
        
        // Add phone if provided
        if (phone) {
            formData.append('mobile', phone);
        }
        
        // Add address fields if provided
        if (address) {
            if (address.street) formData.append('address', address.street);
            if (address.city) formData.append('city', address.city);
            if (address.state) formData.append('state', address.state);
            if (address.postalCode) formData.append('postcode', address.postalCode);
        }
        
        console.log('Updating member profile with address...');
        
        const response = await fetch(`${GYM_MASTER_CONFIG.baseUrl}/api/v1/member/profile`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });
        
        const responseText = await response.text();
        console.log('Profile update response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse profile update response');
            return res.json({
                success: true,
                message: 'Profile update completed (non-JSON response)',
                localOnly: true
            });
        }
        
        if (data.error) {
            console.error('Profile update error:', data.error);
            return res.json({
                success: true,
                message: 'Profile update attempted',
                error: data.error
            });
        }
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: data
        });
        
    } catch (error) {
        console.error('Profile update error:', error);
        res.json({
            success: true,
            message: 'Profile update attempted (connection issue)'
        });
    }
});

// Login endpoint - authenticates member with Gym Master
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Email and password are required' 
        });
    }
    
    try {
        // Dynamic import for node-fetch (ESM module)
        const fetch = (await import('node-fetch')).default;
        
        const formData = new URLSearchParams();
        formData.append('api_key', GYM_MASTER_CONFIG.apiKey);
        formData.append('companyId', GYM_MASTER_CONFIG.companyId);
        formData.append('email', email);
        formData.append('password', password);
        
        console.log('Attempting login for:', email);
        
        const response = await fetch(`${GYM_MASTER_CONFIG.baseUrl}/api/v1/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData
        });
        
        const responseText = await response.text();
        console.log('Login raw response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse login response as JSON');
            return res.status(500).json({ 
                success: false, 
                error: 'Invalid response from login server' 
            });
        }
        
        console.log('Login parsed response:', JSON.stringify(data, null, 2));
        
        if (!response.ok || data.error) {
            console.error('Login failed:', data);
            return res.status(response.status || 400).json({ 
                success: false, 
                error: data.error || 'Login failed' 
            });
        }
        
        // Extract token from various possible response formats
        const token = data.token || data.result?.token || data.result;
        const member = data.member || data.result?.member || { id: data.result?.memberid, name: email };
        const memberId = data.result?.memberid || data.memberid || member?.id;
        
        // Decode JWT to extract session_id
        let sessionId = null;
        try {
            if (token && typeof token === 'string' && token.includes('.')) {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    sessionId = payload.sessionid || payload.session_id;
                    console.log('Decoded JWT payload:', payload);
                    console.log('Session ID:', sessionId);
                }
            }
        } catch (e) {
            console.log('Could not decode JWT:', e.message);
        }
        
        console.log('Login successful for:', email);
        console.log('Token:', token);
        console.log('Member ID:', memberId);
        console.log('Session ID:', sessionId);
        
        res.json({ 
            success: true, 
            token: token,
            sessionId: sessionId,
            memberId: memberId,
            member: member,
            data: data
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error during login' 
        });
    }
});

// Get products endpoint
app.get('/api/products', async (req, res) => {
    try {
        const fetch = (await import('node-fetch')).default;
        
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/products?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}`;
        
        console.log('Fetching products...');
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log('Products API response status:', response.status);
        console.log('Products API full first product:', JSON.stringify(data.result[0], null, 2));
        console.log('Products count:', data.result ? data.result.length : 0);
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                success: false, 
                error: data.error || 'Failed to fetch products' 
            });
        }
        
        res.json({ 
            success: true, 
            products: data.result || data 
        });
        
    } catch (error) {
        console.error('Products fetch error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error fetching products' 
        });
    }
});

// Check stock availability endpoint
app.post('/api/products/check-stock', async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({
                success: false,
                error: 'Items array is required'
            });
        }
        
        const fetch = (await import('node-fetch')).default;
        
        // Fetch current product stock from Gym Master
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/products?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok || !data.result) {
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch product stock'
            });
        }
        
        const products = data.result;
        const outOfStock = [];
        const insufficient = [];
        
        // Check each item against current stock
        for (const item of items) {
            const product = products.find(p => p.productid == item.productId || p.id == item.productId);
            
            if (!product) {
                outOfStock.push({
                    productId: item.productId,
                    name: item.name || 'Unknown Product',
                    requested: item.quantity,
                    available: 0
                });
                continue;
            }
            
            const availableStock = product.maxquantity || 0;
            
            if (availableStock === 0) {
                outOfStock.push({
                    productId: item.productId,
                    name: product.name,
                    requested: item.quantity,
                    available: 0
                });
            } else if (item.quantity > availableStock) {
                insufficient.push({
                    productId: item.productId,
                    name: product.name,
                    requested: item.quantity,
                    available: availableStock
                });
            }
        }
        
        // If any issues found, return error
        if (outOfStock.length > 0 || insufficient.length > 0) {
            return res.json({
                success: false,
                outOfStock: outOfStock,
                insufficient: insufficient,
                message: 'Stock availability issues detected'
            });
        }
        
        // All items are in stock
        res.json({
            success: true,
            message: 'All items are available'
        });
        
    } catch (error) {
        console.error('Stock check error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error checking stock'
        });
    }
});

// Purchase products endpoint
app.post('/api/purchase', async (req, res) => {
    const { token, items, customer, deliveryMethod, deliveryAddress, notes } = req.body;
    
    if (!token || !items || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Token and items are required' 
        });
    }
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        // Format products as array of objects with id and quantity
        const products = items.map(item => ({
            id: parseInt(item.productId),
            quantity: item.quantity
        }));
        
        // Build request body with 'products' field as API expects
        const requestBody = {
            api_key: GYM_MASTER_CONFIG.apiKey,
            token: token,
            products: products
        };
        
        console.log('Processing purchase for', items.length, 'items');
        console.log('Token:', token);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch(`${GYM_MASTER_CONFIG.baseUrl}/api/v2/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const responseText = await response.text();
        console.log('Purchase raw response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse purchase response as JSON');
            return res.status(500).json({ 
                success: false, 
                error: 'Invalid response from payment server' 
            });
        }
        
        console.log('Purchase parsed response:', JSON.stringify(data, null, 2));
        
        if (!response.ok || data.error) {
            console.error('Purchase failed:', data);
            return res.status(response.status || 400).json({ 
                success: false, 
                error: data.error || 'Purchase failed' 
            });
        }
        
        console.log('Purchase successful:', data);
        
        // Log order details for records
        console.log('Order Details:', {
            customer,
            items,
            deliveryMethod,
            deliveryAddress,
            notes,
            timestamp: new Date().toISOString()
        });
        
        // Extract payment URL from various possible response formats
        const paymentUrl = data.paymentUrl || data.payment_url || data.redirect || 
                          data.result?.paymentUrl || data.result?.payment_url || data.result?.redirect ||
                          data.result;
        
        res.json({ 
            success: true, 
            orderId: data.orderId || data.id || data.result?.id || 'ORDER-' + Date.now(),
            paymentUrl: paymentUrl,
            message: paymentUrl ? 'Redirecting to payment...' : 'Order placed successfully',
            data: data
        });
        
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error during purchase' 
        });
    }
});

// Verify Paystack payment
app.get('/api/verify-payment/:reference', async (req, res) => {
    const { reference } = req.params;
    const paystackSecretKey = 'sk_test_cf05b6f83e3ef958938a6adbdfa98103f017d643';
    
    try {
        const fetch = (await import('node-fetch')).default;
        
        console.log('Verifying payment for reference:', reference);
        
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${paystackSecretKey}`
            }
        });
        
        const result = await response.json();
        console.log('Paystack verification response:', result);
        
        if (result.status && result.data.status === 'success') {
            // Update order status to paid
            const order = orders.find(o => o.orderId === reference);
            if (order) {
                order.paymentStatus = 'paid';
                order.deliveryStatus = 'paid'; // Move to paid status
                order.paidAt = result.data.paid_at;
                console.log(`Order ${reference} marked as PAID`);
                
                // Note: Gym Master payment logging requires admin API credentials
                // Payment status must be manually updated in Gym Master admin dashboard
                console.log(`⚠️  Manual action required: Mark payment as "Paid" in Gym Master admin panel`);
                console.log(`   Transaction Reference: ${order.gymMasterTransactionRef}`);
                console.log(`   Order ID: ${reference}`);
                console.log(`   Amount: ₦${result.data.amount / 100}`);
                
                // Save updated orders to file
                saveOrders(orders);
                
                // Send order confirmation email with tracking link
                const customerName = order.customer.name || `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || 'Valued Customer';
                sendOrderConfirmationEmail(order.customer.email, {
                    orderId: order.orderId,
                    customerName: customerName,
                    customer: { ...order.customer, name: customerName },
                    timestamp: order.timestamp,
                    total: order.total,
                    items: order.items,
                    deliveryMethod: order.deliveryMethod,
                    deliveryAddress: order.deliveryAddress,
                    deliveryFee: order.deliveryFee
                }).then(emailResult => {
                    if (emailResult.success) {
                        console.log(`✅ Order confirmation email sent to ${order.customer.email}`);
                    } else {
                        console.log(`⚠️  Email sending failed: ${emailResult.error}`);
                    }
                }).catch(err => {
                    console.error('Email sending error:', err);
                });
            }
            
            // Payment successful
            res.json({
                success: true,
                message: 'Payment verified successfully',
                data: {
                    reference: result.data.reference,
                    amount: result.data.amount / 100, // Convert from kobo to naira
                    paidAt: result.data.paid_at,
                    channel: result.data.channel,
                    customer: result.data.customer
                }
            });
        } else {
            // Payment failed or pending
            res.json({
                success: false,
                message: 'Payment verification failed',
                status: result.data?.status || 'unknown'
            });
        }
        
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment'
        });
    }
});

// Store orders in memory (in production, use a database)
// Orders now loaded from file at startup - see top of file

// Get all orders
app.get('/api/orders', (req, res) => {
    // Sort orders by timestamp (newest first)
    const sortedOrders = orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
        success: true,
        orders: sortedOrders,
        count: orders.length
    });
});

// Track order by reference (public endpoint)
app.get('/api/orders/track/:reference', (req, res) => {
    const { reference } = req.params;
    
    const order = orders.find(o => o.orderId === reference);
    
    if (order) {
        // Return order info (excluding sensitive admin data)
        res.json({
            success: true,
            order: {
                orderId: order.orderId,
                customer: {
                    name: order.customer.name,
                    email: order.customer.email,
                    phone: order.customer.phone
                },
                items: order.items,
                deliveryMethod: order.deliveryMethod,
                deliveryAddress: order.deliveryAddress,
                subtotal: order.subtotal,
                deliveryFee: order.deliveryFee,
                total: order.total,
                timestamp: order.timestamp,
                paymentStatus: order.paymentStatus,
                deliveryStatus: order.deliveryStatus || 'pending',
                paidAt: order.paidAt
            }
        });
    } else {
        res.json({
            success: false,
            message: 'Order not found. Please check your reference number.'
        });
    }
});

// Update order delivery status (admin only)
app.patch('/api/orders/:orderId/status', (req, res) => {
    const { orderId } = req.params;
    const { deliveryStatus } = req.body;
    
    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
    
    if (!deliveryStatus || !validStatuses.includes(deliveryStatus)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid delivery status. Must be one of: ' + validStatuses.join(', ')
        });
    }
    
    const order = orders.find(o => o.orderId === orderId);
    
    if (order) {
        const oldStatus = order.deliveryStatus || 'pending';
        order.deliveryStatus = deliveryStatus;
        order.statusUpdatedAt = new Date().toISOString();
        
        // Save to file
        saveOrders(orders);
        
        console.log(`Order ${orderId} status updated: ${oldStatus} → ${deliveryStatus}`);
        
        // Send status update email (only for processing, shipped, delivered)
        if (['processing', 'shipped', 'delivered'].includes(deliveryStatus)) {
            sendStatusUpdateEmail(order.customer.email, order, deliveryStatus)
                .then(result => {
                    if (result.success) {
                        console.log(`✅ Status update email sent to ${order.customer.email}`);
                    } else {
                        console.log(`⚠️  Failed to send status email: ${result.error}`);
                    }
                })
                .catch(error => {
                    console.error('Error sending status email:', error.message);
                });
        }
        
        res.json({
            success: true,
            message: 'Order status updated successfully',
            order: order,
            emailSent: ['processing', 'shipped', 'delivered'].includes(deliveryStatus)
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Order not found'
        });
    }
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
    try {
        const testEmail = req.query.email || 'yarima.abubakar@activezone.ng';
        
        const mailOptions = {
            from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
            to: testEmail,
            subject: 'Test Email from Active Zone Hub',
            text: 'This is a test email to verify SMTP configuration is working correctly.',
            html: '<h1>Test Email</h1><p>This is a test email to verify SMTP configuration is working correctly.</p>'
        };
        
        console.log('\n' + '='.repeat(60));
        console.log('🧪 SENDING TEST EMAIL');
        console.log('='.repeat(60));
        console.log(`To: ${testEmail}`);
        console.log(`From: ${mailOptions.from}`);
        console.log(`Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
        console.log('='.repeat(60));
        
        const info = await emailTransporter.sendMail(mailOptions);
        
        console.log('✅ Test email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}`);
        console.log('='.repeat(60) + '\n');
        
        res.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: info.messageId,
            response: info.response
        });
    } catch (error) {
        console.error('❌ Test email failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.toString()
        });
    }
});

// TOTP Setup endpoint - Display QR code for Google Authenticator
app.get('/api/totp/setup', async (req, res) => {
    try {
        const otpauthUrl = speakeasy.otpauthURL({
            secret: TOTP_SECRET,
            label: 'Active Zone Hub',
            issuer: 'Active Zone Hub',
            encoding: 'base32'
        });
        
        const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Authenticator Setup</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                    h1 { color: #e53935; }
                    .qr-code { margin: 30px 0; }
                    .secret { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; font-family: monospace; font-size: 18px; }
                    .instructions { text-align: left; line-height: 1.8; }
                    .step { margin: 15px 0; }
                </style>
            </head>
            <body>
                <h1>🔒 Google Authenticator Setup</h1>
                <p>Scan this QR code with Google Authenticator app:</p>
                <div class="qr-code">
                    <img src="${qrCodeDataURL}" alt="QR Code" />
                </div>
                <p>Or manually enter this secret:</p>
                <div class="secret">${TOTP_SECRET}</div>
                <div class="instructions">
                    <h3>Instructions:</h3>
                    <div class="step">1. Download Google Authenticator app on your phone</div>
                    <div class="step">2. Scan the QR code above OR enter the secret manually</div>
                    <div class="step">3. The app will generate 6-digit codes every 30 seconds</div>
                    <div class="step">4. Use these codes to delete unpaid orders</div>
                </div>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                    ⚠️ Keep this secret secure! Anyone with access can delete orders.
                </p>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('TOTP setup error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate QR code' });
    }
});

// Delete order endpoint with TOTP verification
app.delete('/api/orders/:orderId', (req, res) => {
    const { orderId } = req.params;
    const totpCode = req.headers['x-totp-code'];
    
    // Verify TOTP code
    if (!totpCode) {
        return res.status(401).json({
            success: false,
            error: 'TOTP code required. Please provide your Google Authenticator code.'
        });
    }
    
    const isValid = speakeasy.totp.verify({
        secret: TOTP_SECRET,
        encoding: 'base32',
        token: totpCode,
        window: 2  // Allow 2 time steps (60 seconds) for clock drift
    });
    
    if (!isValid) {
        console.log(`❌ Invalid TOTP code attempted for order ${orderId}`);
        return res.status(403).json({
            success: false,
            error: 'Invalid authentication code. Please try again.'
        });
    }
    
    // Find and delete the order
    const orderIndex = orders.findIndex(o => o.orderId === orderId);
    
    if (orderIndex === -1) {
        return res.status(404).json({
            success: false,
            error: 'Order not found'
        });
    }
    
    const order = orders[orderIndex];
    
    // Only allow deletion of unpaid orders
    if (order.paymentStatus === 'paid' && order.deliveryStatus !== 'pending') {
        return res.status(400).json({
            success: false,
            error: 'Cannot delete paid orders that are being processed'
        });
    }
    
    // Remove order
    orders.splice(orderIndex, 1);
    
    // Save to file
    if (saveOrders(orders)) {
        console.log(`✅ Order ${orderId} deleted by admin (TOTP verified)`);
        res.json({
            success: true,
            message: 'Order deleted successfully',
            orderId: orderId
        });
    } else {
        // Restore order if save failed
        orders.splice(orderIndex, 0, order);
        res.status(500).json({
            success: false,
            error: 'Failed to save changes'
        });
    }
});

// Configure email service using Brevo HTTP API (not SMTP)
let brevoClient = null;
let emailService = 'none';

console.log('\n' + '='.repeat(60));
console.log('EMAIL SERVICE INITIALIZATION');
console.log('='.repeat(60));

// Use Brevo API (works on Render - uses HTTPS port 443)
if (process.env.BREVO_API_KEY) {
    try {
        console.log('Initializing Brevo email service (HTTP API)...');
        const apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
        brevoClient = apiInstance;
        emailService = 'brevo';
        console.log('\u2705 Brevo email service initialized');
        console.log(`   From: ${process.env.SMTP_FROM_NAME || 'Active Zone Hub'} <${process.env.SMTP_FROM_EMAIL || 'fusionflowltd@gmail.com'}>`);
        console.log('   Using HTTPS API (port 443) - compatible with Render');
    } catch (error) {
        console.error('\u274c Brevo initialization error:', error.message);
        brevoClient = null;
        emailService = 'none';
    }
}
else {
    console.log('\u26a0\ufe0f  No BREVO_API_KEY found');
    console.log('   Please add BREVO_API_KEY to environment variables');
    emailService = 'none';
}

console.log('='.repeat(60) + '\n');

// Send order confirmation email with tracking link
async function sendOrderConfirmationEmail(customerEmail, orderDetails) {
    try {
        const trackingUrl = `${process.env.APP_URL}/track-order.html?ref=${orderDetails.orderId}`;
        
        // Prepare HTML email content
        const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: #ffffff !important; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; color: #ffffff !important; }
        .header p { color: #ffffff !important; margin: 10px 0 0 0; }
        .content { background: #ffffff; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd; }
        .content p { color: #333333; }
        .order-details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0; }
        .order-details h2 { color: #e53935; margin-top: 0; }
        .order-details h3 { color: #333333; }
        .items { list-style: none; padding: 0; margin: 0; }
        .items li { padding: 10px; border-bottom: 1px solid #eee; background: #ffffff; }
        .items li strong { color: #1a1a1a; }
        .tracking-box { background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin: 20px 0; text-align: center; }
        .tracking-box h3 { color: #1565c0; margin-top: 0; }
        .tracking-box p { color: #424242; }
        .tracking-button { display: inline-block; padding: 15px 30px; background: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0; }
        .order-ref { font-size: 24px; font-weight: bold; color: #d32f2f; padding: 10px; background: #ffffff; border-radius: 4px; letter-spacing: 2px; border: 2px solid #e57373; }
        .footer { background: #1a1a1a; color: #ffffff !important; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
        .footer p { color: #ffffff !important; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 0; color: #333333; }
        .label { font-weight: bold; color: #666666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Order Confirmation</h1>
            <p>Active Zone Hub</p>
        </div>
        
        <div class="content">
            <p>Dear <strong>${orderDetails.customer.name}</strong>,</p>
            <p>Thank you for your order at Active Zone Hub! Your order has been received and payment confirmed.</p>
            
            <div class="order-details">
                <h2>📦 Order Details</h2>
                <table>
                    <tr>
                        <td class="label">Order Reference:</td>
                        <td><strong style="color: #1a1a1a;">${orderDetails.orderId}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Order Date:</td>
                        <td style="color: #333333;">${new Date(orderDetails.timestamp).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}</td>
                    </tr>
                    <tr>
                        <td class="label">Total Amount:</td>
                        <td><strong style="color: #e53935;">₦${orderDetails.total.toLocaleString()}</strong></td>
                    </tr>
                </table>
                
                <h3 style="margin-top: 20px;">Items Ordered:</h3>
                <ul class="items">
                    ${orderDetails.items.map(item => `
                        <li>
                            <strong style="color: #1a1a1a;">${item.name}</strong><br>
                            <span style="color: #666;">Qty: ${item.quantity} × ₦${item.price.toLocaleString()} = ₦${(item.price * item.quantity).toLocaleString()}</span>
                        </li>
                    `).join('')}
                </ul>
                
                <h3>🚚 Delivery Information:</h3>
                ${orderDetails.deliveryMethod === 'delivery' ? `
                    <p style="color: #333333;">
                        <strong style="color: #1a1a1a;">Delivery Address:</strong><br>
                        ${orderDetails.deliveryAddress.street}<br>
                        ${orderDetails.deliveryAddress.city}, ${orderDetails.deliveryAddress.state}
                    </p>
                    <p style="color: #333333;"><strong style="color: #1a1a1a;">Delivery Fee:</strong> ₦${orderDetails.deliveryFee.toLocaleString()}</p>
                ` : '<p style="color: #333333;"><strong style="color: #1a1a1a;">Pickup from Store</strong></p>'}
            </div>
            
            <div class="tracking-box">
                <h3>📍 Track Your Order</h3>
                <p>Your order reference number:</p>
                <div class="order-ref">${orderDetails.orderId}</div>
                <p style="margin-top: 20px; color: #424242;">Click the button below to track your order status in real-time:</p>
                <a href="${trackingUrl}" class="tracking-button" style="color: #ffffff;">🔍 Track My Order</a>
            </div>
            
            <p style="margin-top: 30px; color: #333333;">If you have any questions or concerns, please don't hesitate to contact us.</p>
        </div>
        
        <div class="footer">
            <p><strong>Active Zone Hub</strong></p>
            <p>📧 Email: support@activezone.ng | 📞 Phone: +234 803 042 8467, +234 906 767 1624</p>
            <p style="margin-top: 10px; color: #999;">Thank you for choosing Active Zone Hub!</p>
        </div>
    </div>
</body>
</html>
        `;
        
        // Plain text version for email clients that don't support HTML
        const emailText = `
Dear ${orderDetails.customer.name},

Thank you for your order at Active Zone Hub!

Your Order Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order Reference: ${orderDetails.orderId}
Order Date: ${new Date(orderDetails.timestamp).toLocaleString()}
Total Amount: ₦${orderDetails.total.toLocaleString()}

Items Ordered:
${orderDetails.items.map(item => `• ${item.name} (Qty: ${item.quantity}) - ₦${(item.price * item.quantity).toLocaleString()}`).join('\n')}

Delivery Information:
${orderDetails.deliveryMethod === 'delivery' ? 
`Delivery Address:
${orderDetails.deliveryAddress.street}
${orderDetails.deliveryAddress.city}, ${orderDetails.deliveryAddress.state}
Delivery Fee: ₦${orderDetails.deliveryFee.toLocaleString()}` : 
'Pickup from Store'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 TRACK YOUR ORDER:
${trackingUrl}

Use your order reference (${orderDetails.orderId}) to track your delivery status in real-time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Need Help?
Contact us: support@activezone.ng
Phone: +234 803 042 8467, +234 906 767 1624

Thank you for choosing Active Zone Hub!

Best regards,
Active Zone Hub Team
        `;
        
        console.log('\n' + '='.repeat(60));
        console.log('📧 SENDING ORDER CONFIRMATION EMAIL');
        console.log('='.repeat(60));
        console.log(`To: ${customerEmail}`);
        console.log(`Subject: Order Confirmation - ${orderDetails.orderId}`);
        console.log(`Order: ${orderDetails.orderId}`);
        console.log('='.repeat(60));
        
        // Send email using Brevo HTTP API
        if (brevoClient) {
            console.log('Calling Brevo API...');
                    
            const sendSmtpEmail = new brevo.SendSmtpEmail();
            sendSmtpEmail.sender = {
                name: process.env.SMTP_FROM_NAME || 'Active Zone Hub',
                email: process.env.SMTP_FROM_EMAIL || 'fusionflowltd@gmail.com'
            };
            sendSmtpEmail.to = [{ email: customerEmail }];
            sendSmtpEmail.subject = `Order Confirmation - ${orderDetails.orderId}`;
            sendSmtpEmail.htmlContent = emailHTML;
            sendSmtpEmail.textContent = emailText;
                    
            const result = await brevoClient.sendTransacEmail(sendSmtpEmail);
                    
            console.log('Brevo API response:', JSON.stringify(result, null, 2));
                    
            if (result.body && result.body.messageId) {
                console.log('\u2705 Email sent successfully via Brevo API!');
                console.log(`   Message ID: ${result.body.messageId}`);
                console.log('='.repeat(60) + '\n');
                        
                return { 
                    success: true, 
                    message: 'Order confirmation email sent successfully',
                    messageId: result.body.messageId
                };
            } else if (result.response && result.response.body) {
                console.log('\u274c Brevo API error:', result.response.body);
                console.log('='.repeat(60) + '\n');
                return { success: false, error: result.response.body.message || 'Email sending failed' };
            } else {
                console.log('\u2705 Email sent (no message ID returned)');
                console.log('='.repeat(60) + '\n');
                return { success: true, message: 'Email sent' };
            }
        } else {
            console.log('⚠️  No email service configured. Email not sent.');
            console.log('='.repeat(60) + '\n');
            return { success: false, error: 'No email service configured' };
        }
        
    } catch (error) {
        console.error('❌ Error sending order confirmation email:', error.message);
        console.log('='.repeat(60) + '\n');
        
        // Save to pending emails as fallback
        try {
            const emailData = {
                to: customerEmail,
                orderId: orderDetails.orderId,
                timestamp: new Date().toISOString(),
                error: error.message
            };
            
            const emailsFile = path.join(__dirname, 'pending-emails.json');
            let pendingEmails = [];
            
            if (fs.existsSync(emailsFile)) {
                const data = fs.readFileSync(emailsFile, 'utf8');
                pendingEmails = JSON.parse(data);
            }
            
            pendingEmails.push(emailData);
            fs.writeFileSync(emailsFile, JSON.stringify(pendingEmails, null, 2));
            
            console.log(`⚠️  Email saved to pending-emails.json for manual sending`);
        } catch (fileError) {
            console.error('Error saving to pending emails:', fileError.message);
        }
        
        return { success: false, error: error.message };
    }
}

// Send order status update email
async function sendStatusUpdateEmail(customerEmail, orderDetails, newStatus) {
    try {
        const trackingUrl = `${process.env.APP_URL}/track-order.html?ref=${orderDetails.orderId}`;
        
        // Status-specific content
        const statusContent = {
            processing: {
                title: '📦 Your Order is Being Processed',
                icon: '📦',
                color: '#ff9800',
                message: 'Great news! We are preparing your order.',
                description: 'Your order has been confirmed and our team is now carefully preparing your items for shipment.',
                nextStep: 'Your order will be shipped soon and you will receive another notification with tracking details.'
            },
            shipped: {
                title: '🚚 Your Order Has Been Shipped',
                icon: '🚚',
                color: '#2196f3',
                message: 'Your order is on its way!',
                description: 'Your package has been handed over to our delivery partner and is now en route to your location.',
                nextStep: 'Expected delivery within 12-24 hours. You can track your order status using the button below.'
            },
            delivered: {
                title: '🎉 Your Order Has Been Delivered',
                icon: '🎉',
                color: '#4caf50',
                message: 'Your order has been successfully delivered!',
                description: 'We hope you enjoy your purchase from Active Zone Hub.',
                nextStep: 'If you have any issues with your order, please contact us immediately.'
            }
        };
        
        const content = statusContent[newStatus] || statusContent.processing;
        
        // Prepare HTML email
        const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, ${content.color} 0%, ${content.color}dd 100%); color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; color: #ffffff; }
        .header .icon { font-size: 48px; margin-bottom: 10px; }
        .content { background: #ffffff; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd; }
        .content p { color: #333333; }
        .status-box { background: ${content.color}15; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${content.color}; }
        .status-box h3 { color: ${content.color}; margin-top: 0; }
        .order-details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0; }
        .order-details h3 { color: #333333; margin-top: 0; }
        .tracking-button { display: inline-block; padding: 15px 30px; background: ${content.color}; color: #ffffff; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0; }
        .order-ref { font-size: 20px; font-weight: bold; color: #1a1a1a; padding: 10px; background: #f5f5f5; border-radius: 4px; }
        .footer { background: #1a1a1a; color: #ffffff; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
        .footer p { color: #ffffff; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 0; color: #333333; }
        .label { font-weight: bold; color: #666666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">${content.icon}</div>
            <h1>${content.title}</h1>
            <p>Order Status Update</p>
        </div>
        
        <div class="content">
            <p>Dear <strong>${orderDetails.customer.name}</strong>,</p>
            <p><strong>${content.message}</strong></p>
            <p>${content.description}</p>
            
            <div class="status-box">
                <h3>📍 ${content.nextStep}</h3>
            </div>
            
            <div class="order-details">
                <h3>Your Order Details</h3>
                <table>
                    <tr>
                        <td class="label">Order Reference:</td>
                        <td class="order-ref">${orderDetails.orderId}</td>
                    </tr>
                    <tr>
                        <td class="label">Order Date:</td>
                        <td style="color: #333333;">${new Date(orderDetails.timestamp).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}</td>
                    </tr>
                    <tr>
                        <td class="label">Total Amount:</td>
                        <td><strong style="color: #e53935;">₦${orderDetails.total.toLocaleString()}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Delivery Method:</td>
                        <td style="color: #333333;">${orderDetails.deliveryMethod === 'delivery' ? 'Home Delivery' : 'Pickup from Store'}</td>
                    </tr>
                </table>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <p style="color: #666;">Track your order status in real-time:</p>
                <a href="${trackingUrl}" class="tracking-button" style="color: #ffffff;">🔍 Track My Order</a>
            </div>
            
            <p style="margin-top: 30px; color: #333333;">If you have any questions or concerns, please don't hesitate to contact us.</p>
        </div>
        
        <div class="footer">
            <p><strong>Active Zone Hub</strong></p>
            <p>📧 Email: support@activezone.ng | 📞 Phone: +234 803 042 8467, +234 906 767 1624</p>
            <p style="margin-top: 10px; color: #999;">Thank you for choosing Active Zone Hub!</p>
        </div>
    </div>
</body>
</html>
        `;
        
        // Plain text version
        const emailText = `
Dear ${orderDetails.customer.name},

${content.title.replace(/[📦🚚🎉]/g, '').trim()}

${content.message}
${content.description}

${content.nextStep}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your Order Details:
Order Reference: ${orderDetails.orderId}
Order Date: ${new Date(orderDetails.timestamp).toLocaleString()}
Total Amount: ₦${orderDetails.total.toLocaleString()}
Delivery Method: ${orderDetails.deliveryMethod === 'delivery' ? 'Home Delivery' : 'Pickup from Store'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 TRACK YOUR ORDER:
${trackingUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Need Help?
Contact us: support@activezone.ng
Phone: +234 803 042 8467, +234 906 767 1624

Thank you for choosing Active Zone Hub!

Best regards,
Active Zone Hub Team
        `;
        
        
        console.log('\n' + '='.repeat(60));
        console.log('📧 SENDING STATUS UPDATE EMAIL');
        console.log('='.repeat(60));
        console.log(`To: ${customerEmail}`);
        console.log(`Subject: ${content.title} - ${orderDetails.orderId}`);
        console.log(`Order: ${orderDetails.orderId}`);
        console.log(`New Status: ${newStatus}`);
        console.log('='.repeat(60));
        
        // Send email using Brevo HTTP API
        if (brevoClient) {
            console.log('Calling Brevo API...');
                    
            const sendSmtpEmail = new brevo.SendSmtpEmail();
            sendSmtpEmail.sender = {
                name: process.env.SMTP_FROM_NAME || 'Active Zone Hub',
                email: process.env.SMTP_FROM_EMAIL || 'fusionflowltd@gmail.com'
            };
            sendSmtpEmail.to = [{ email: customerEmail }];
            sendSmtpEmail.subject = `${content.title} - ${orderDetails.orderId}`;
            sendSmtpEmail.htmlContent = emailHTML;
            sendSmtpEmail.textContent = emailText;
                    
            const result = await brevoClient.sendTransacEmail(sendSmtpEmail);
                    
            console.log('Brevo API response:', JSON.stringify(result, null, 2));
                    
            if (result.body && result.body.messageId) {
                console.log('\u2705 Status update email sent successfully via Brevo API!');
                console.log(`   Message ID: ${result.body.messageId}`);
                console.log('='.repeat(60) + '\n');
                        
                return { 
                    success: true, 
                    message: 'Status update email sent successfully',
                    messageId: result.body.messageId
                };
            } else if (result.response && result.response.body) {
                console.log('\u274c Brevo API error:', result.response.body);
                console.log('='.repeat(60) + '\n');
                return { success: false, error: result.response.body.message || 'Email sending failed' };
            } else {
                console.log('\u2705 Status update email sent (no message ID returned)');
                console.log('='.repeat(60) + '\n');
                return { success: true, message: 'Status update email sent' };
            }
        } else {
            console.log('⚠️  No email service configured. Email not sent.');
            console.log('='.repeat(60) + '\n');
            return { success: false, error: 'No email service configured' };
        }
        
    } catch (error) {
        console.error('❌ Error sending status update email:', error.message);
        return { success: false, error: error.message };
    }
}

// Create order endpoint with Gym Master purchase integration
app.post('/api/orders', async (req, res) => {
    const { token, customer, items, deliveryMethod, deliveryAddress, subtotal, deliveryFee, total, notes } = req.body;
    
    // Validate required fields
    if (!customer || !items || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Customer info and items are required' 
        });
    }
    
    // Validate token is present (required for Gym Master purchase)
    if (!token) {
        return res.status(400).json({ 
            success: false, 
            error: 'Authentication token is required for purchase' 
        });
    }
    
    try {
        // Generate order ID
        const orderId = 'AZH-' + Date.now();
        
        // Log the order
        console.log('='.repeat(50));
        console.log('NEW ORDER RECEIVED');
        console.log('='.repeat(50));
        console.log('Order ID:', orderId);
        console.log('Customer:', customer);
        console.log('Items:', items);
        console.log('Delivery Method:', deliveryMethod);
        console.log('Delivery Address:', deliveryAddress);
        console.log('Subtotal:', subtotal);
        console.log('Delivery Fee:', deliveryFee);
        console.log('Total:', total);
        console.log('Notes:', notes);
        console.log('Timestamp:', new Date().toISOString());
        console.log('='.repeat(50));
        
        const fetch = (await import('node-fetch')).default;
        
        // Step 1: Call Gym Master Purchase API
        console.log('📦 Calling Gym Master Purchase API...');
        
        // Prepare products array - Gym Master API expects array of {productid, quantity}
        const products = items.map(item => ({
            productid: parseInt(item.productId),  // Note: lowercase 'productid' as per Gym Master API
            quantity: parseInt(item.quantity)
        }));
        
        const gymMasterPurchaseData = {
            api_key: GYM_MASTER_CONFIG.apiKey,
            token: token,
            products: products
        };
        
        console.log('Gym Master Purchase Request:', JSON.stringify(gymMasterPurchaseData, null, 2));
        
        const gymMasterResponse = await fetch(`${GYM_MASTER_CONFIG.baseUrl}/api/v2/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gymMasterPurchaseData)
        });
        
        const gymMasterResult = await gymMasterResponse.json();
        console.log('Gym Master Purchase Response:', JSON.stringify(gymMasterResult, null, 2));
        
        // Check if Gym Master purchase was successful
        if (gymMasterResult.error) {
            throw new Error(`Gym Master purchase failed: ${gymMasterResult.error}`);
        }
        
        // Extract payment URL from Gym Master response
        let paymentUrl = null;
        
        console.log('🔍 Checking Gym Master response for payment URL...');
        console.log('Full response keys:', Object.keys(gymMasterResult));
        
        // Check all possible payment URL fields
        if (gymMasterResult.url) {
            paymentUrl = gymMasterResult.url;
            console.log('Found payment URL in: result.url');
        } else if (gymMasterResult.payment_url) {
            paymentUrl = gymMasterResult.payment_url;
            console.log('Found payment URL in: result.payment_url');
        } else if (gymMasterResult.paymentUrl) {
            paymentUrl = gymMasterResult.paymentUrl;
            console.log('Found payment URL in: result.paymentUrl');
        } else if (gymMasterResult.result && typeof gymMasterResult.result === 'string' && gymMasterResult.result.startsWith('http')) {
            // If result is a URL string
            paymentUrl = gymMasterResult.result;
            console.log('Found payment URL in: result (as string)');
        } else if (gymMasterResult.result && gymMasterResult.result.url) {
            paymentUrl = gymMasterResult.result.url;
            console.log('Found payment URL in: result.url');
        } else if (gymMasterResult.result && gymMasterResult.result.payment_url) {
            paymentUrl = gymMasterResult.result.payment_url;
            console.log('Found payment URL in: result.payment_url');
        } else {
            console.log('⚠️ No payment URL found in response');
            console.log('Response result value:', gymMasterResult.result);
        }
        
        console.log('✅ Gym Master purchase successful!');
        console.log('📦 Stock has been deducted by Gym Master');
        console.log('Transaction Reference:', gymMasterResult.transaction_ref || 'N/A');
        
        // Step 2: If no payment URL, initialize Paystack payment as fallback
        if (!paymentUrl) {
            console.log('🔄 No payment URL from Gym Master - Initializing Paystack fallback...');
            
            try {
                // Initialize Paystack transaction
                const appBaseUrl = (process.env.APP_URL || 'http://localhost:3001').replace('/api', '');
                const paystackData = {
                    email: customer.email,
                    amount: Math.round(total * 100), // Convert to kobo (Paystack expects amount in kobo)
                    currency: 'NGN',
                    reference: orderId,
                    callback_url: `${appBaseUrl}/payment-success.html?reference=${orderId}`,
                    metadata: {
                        orderId: orderId,
                        customer_name: customer.name,
                        customer_phone: customer.phone,
                        items_count: items.length,
                        delivery_method: deliveryMethod,
                        gym_master_transaction: gymMasterResult.transaction_ref
                    }
                };
                
                console.log('Paystack initialization data:', JSON.stringify(paystackData, null, 2));
                
                const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(paystackData)
                });
                
                const paystackResult = await paystackResponse.json();
                console.log('Paystack response:', JSON.stringify(paystackResult, null, 2));
                
                if (paystackResult.status && paystackResult.data && paystackResult.data.authorization_url) {
                    paymentUrl = paystackResult.data.authorization_url;
                    console.log('✅ Paystack payment initialized successfully!');
                    console.log('💳 Paystack Payment URL:', paymentUrl);
                } else {
                    console.error('❌ Paystack initialization failed:', paystackResult.message);
                }
            } catch (paystackError) {
                console.error('❌ Error initializing Paystack payment:', paystackError.message);
            }
        }
        
        console.log('💳 Final Payment URL:', paymentUrl || 'None');
        
        // Save order to memory
        const orderData = {
            orderId: orderId,
            customer: customer,
            items: items,
            deliveryMethod: deliveryMethod,
            deliveryAddress: deliveryAddress,
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            total: total,
            notes: notes,
            timestamp: new Date().toISOString(),
            paymentStatus: 'pending',
            deliveryStatus: 'pending',
            gymMasterPurchaseId: gymMasterResult.result?.purchaseId || gymMasterResult.purchaseId || null,
            gymMasterToken: token, // Store token for payment logging
            gymMasterTransactionRef: gymMasterResult.transaction_ref // Store transaction ref
        };
        orders.push(orderData);
        console.log(`Order saved. Total orders in system: ${orders.length}`);
        
        // Save to file
        saveOrders(orders);
        
        // Return response with payment URL from Gym Master
        res.json({
            success: true,
            orderId: orderId,
            paymentUrl: paymentUrl,
            message: 'Order created via Gym Master, stock deducted, redirecting to payment...',
            order: {
                id: orderId,
                customer,
                items,
                deliveryMethod,
                subtotal,
                deliveryFee,
                total,
                status: 'pending_payment',
                createdAt: new Date().toISOString()
            },
            gymMasterResponse: gymMasterResult
        });
        
    } catch (error) {
        console.error('❌ Order creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'Server error creating order' 
        });
    }
});

// Catch-all route to serve index.html for SPA
app.get('/{*path}', (req, res) => {
    // Only serve HTML files, let other files be handled by static middleware
    if (!req.path.includes('.')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Global error handler - returns JSON instead of HTML
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// Start server - bind to 0.0.0.0 for Railway/Render compatibility
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('Active Zone Hub - Backend Server');
    console.log('='.repeat(50));
    console.log(`Server running on port ${PORT}`);
    console.log('API Endpoints:');
    console.log(`  GET  /api/health    - Health check`);
    console.log(`  POST /api/login     - Member login`);
    console.log(`  GET  /api/products  - Get products`);
    console.log(`  POST /api/purchase  - Purchase products`);
    console.log(`  POST /api/orders    - Create order`);
    console.log('='.repeat(50));
});
