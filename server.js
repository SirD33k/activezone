// server.js - Backend API Server for Gym Master Integration

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const brevo = require('@getbrevo/brevo');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const fetch = globalThis.fetch;
const logger = require('./src/utils/logger');
require('dotenv').config();

// Import routes
const memberRoutes = require('./src/routes/member');
const authRoutes = require('./src/routes/auth');
const productsRoutes = require('./src/routes/products');
const paymentRoutes = require('./src/routes/payment');
const ordersRoutes = require('./src/routes/orders');
const contactRoutes = require('./src/routes/contact');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// File-based storage for orders (when database is not available)
const ORDERS_FILE = path.join(__dirname, 'orders-data.json');

// Helper function to load orders from file
function loadOrdersFromFile() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const data = fs.readFileSync(ORDERS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error loading orders from file:', error.message);
        return [];
    }
}

// Helper function to save orders to file
function saveOrdersToFile(orders) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving orders to file:', error.message);
        return false;
    }
}

// Helper function to save a single order to file
async function saveOrderToFile(order) {
    try {
        const orders = loadOrdersFromFile();
        orders.push(order);
        saveOrdersToFile(orders);
        console.log(`💾 Order ${order.id} saved to file`);
        return true;
    } catch (error) {
        console.error('❌ Error saving order to file:', error.message);
        return false;
    }
}

// Helper function to update order in file
async function updateOrderInFile(orderId, updates) {
    try {
        const orders = loadOrdersFromFile();
        const index = orders.findIndex(o => o.id === orderId || o.paymentReference === orderId);
        if (index !== -1) {
            orders[index] = { ...orders[index], ...updates };
            saveOrdersToFile(orders);
            console.log(`💾 Order ${orderId} updated in file`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error updating order in file:', error.message);
        return false;
    }
}

// Helper function to get order from file by ID
async function getOrderFromFile(orderId) {
    try {
        const orders = loadOrdersFromFile();
        return orders.find(o => o.id === orderId || o.paymentReference === orderId) || null;
    } catch (error) {
        console.error('❌ Error getting order from file:', error.message);
        return null;
    }
}

// MongoDB Database Configuration
// Connect to MongoDB Atlas if DATABASE_ENABLED=true and MONGODB_URI is provided
let mongoClient = null;
let db = null;
const USE_DB = process.env.DATABASE_ENABLED === 'true' && process.env.MONGODB_URI;

if (USE_DB) {
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB_NAME || 'activezone';
    
    MongoClient.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000
    })
        .then(client => {
            mongoClient = client;
            db = client.db(dbName);
            logger.info('MongoDB connected', { database: dbName });
            
            // Share database connection with orders router
            ordersRoutes.setDatabase(db);
            
            // Create indexes for better performance
            db.collection('orders').createIndex({ id: 1 }, { unique: true });
            db.collection('orders').createIndex({ paymentReference: 1 });
            db.collection('orders').createIndex({ createdAt: -1 });
        })
        .catch(error => {
            logger.error('MongoDB connection failed', { error: error.message });
        });
} else {
    logger.info('Running in file-based mode. Set DATABASE_ENABLED=true and MONGODB_URI in .env to use MongoDB');
}

// Helper function to load orders from MongoDB
async function loadOrdersFromDB() {
    if (!USE_DB || !db) {
        return loadOrdersFromFile();
    }
    try {
        const orders = await db.collection('orders')
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        return orders;
    } catch (error) {
        console.error('Error loading orders from MongoDB:', error.message);
        return [];
    }
}

// Helper function to save a new order to MongoDB
async function saveOrderToDB(order) {
    if (!USE_DB || !db) {
        console.log('💾 Saving order to file storage');
        return await saveOrderToFile(order);
    }
    try {
        await db.collection('orders').insertOne({
            ...order,
            createdAt: order.createdAt || new Date().toISOString()
        });
        console.log(`💾 Order ${order.id} saved to MongoDB`);
        return true;
    } catch (error) {
        console.error('❌ Error saving order to MongoDB:', error.message);
        return false;
    }
}

// Helper function to delete an order from MongoDB
async function deleteOrderFromDB(orderId) {
    if (!USE_DB || !db) {
        // Delete from file
        try {
            const orders = loadOrdersFromFile();
            const filteredOrders = orders.filter(o => o.id !== orderId && o.paymentReference !== orderId);
            if (filteredOrders.length < orders.length) {
                saveOrdersToFile(filteredOrders);
                console.log(`🗑️ Order ${orderId} deleted from file`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error deleting order from file:', error.message);
            return false;
        }
    }
    try {
        const result = await db.collection('orders').deleteOne({
            $or: [{ id: orderId }, { paymentReference: orderId }]
        });
        if (result.deletedCount > 0) {
            console.log(`🗑️ Order ${orderId} deleted from MongoDB`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error deleting order from MongoDB:', error.message);
        return false;
    }
}

// Helper function to update order payment status in MongoDB
async function updateOrderPaymentInDB(orderId, paymentData) {
    if (!USE_DB || !db) {
        console.log('💾 Updating payment status in file storage');
        return await updateOrderInFile(orderId, paymentData);
    }
    try {
        const result = await db.collection('orders').updateOne(
            { $or: [{ id: orderId }, { paymentReference: orderId }] },
            { $set: { ...paymentData, paidAt: paymentData.paidAt || new Date().toISOString() } }
        );
        
        if (result.modifiedCount > 0) {
            console.log(`💳 Order ${orderId} payment status updated to: ${paymentData.paymentStatus}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error updating order payment in MongoDB:', error.message);
        return false;
    }
}

// Database operations object
const OrderDB = {
    getAll: loadOrdersFromDB,
    save: saveOrderToDB,
    delete: deleteOrderFromDB,
    updatePayment: updateOrderPaymentInDB,
    getById: async (id) => {
        if (!USE_DB || !db) return await getOrderFromFile(id);
        try {
            return await db.collection('orders').findOne({
                $or: [{ id: id }, { paymentReference: id }]
            });
        } catch (error) {
            console.error('Error in OrderDB.getById:', error.message);
            throw error;
        }
    },
    getByReference: async (reference) => {
        if (!USE_DB || !db) return await getOrderFromFile(reference);
        try {
            return await db.collection('orders').findOne({ paymentReference: reference });
        } catch (error) {
            console.error('Error in OrderDB.getByReference:', error.message);
            throw error;
        }
    },
    updateStatus: async (id, status) => {
        if (!USE_DB || !db) {
            // Update status in file
            try {
                const orders = loadOrdersFromFile();
                const index = orders.findIndex(o => o.id === id || o.paymentReference === id);
                if (index !== -1) {
                    orders[index].status = status;
                    orders[index].statusUpdatedAt = new Date().toISOString();
                    saveOrdersToFile(orders);
                    console.log(`📦 Order ${id} status updated to: ${status}`);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error updating order status in file:', error.message);
                return false;
            }
        }
        try {
            const result = await db.collection('orders').updateOne(
                { $or: [{ id: id }, { paymentReference: id }] },
                { $set: { status: status, statusUpdatedAt: new Date().toISOString() } }
            );
            return result.modifiedCount > 0;
        } catch (error) {
            console.error('Error in OrderDB.updateStatus:', error.message);
            throw error;
        }
    }
};

// Gym Master API Configuration
const GYM_MASTER_CONFIG = {
    apiKey: process.env.GYM_MASTER_API_KEY || '7adf342b0c2124f391d4b7934e8430bb',
    baseUrl: process.env.GYM_MASTER_BASE_URL || 'https://activezone.gymmasteronline.com/portal',
    companyId: process.env.GYM_MASTER_COMPANY_ID || '1152997'
};

// Paystack Configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
if (!PAYSTACK_SECRET_KEY) {
    console.warn('⚠️  WARNING: PAYSTACK_SECRET_KEY not set in .env file');
}

// TOTP Configuration for order deletion
const TOTP_SECRET = process.env.TOTP_SECRET || speakeasy.generateSecret({
    name: 'Active Zone Hub - Order Management',
    issuer: 'Active Zone Hub'
}).base32;

// TOTP Configuration for admin login
const TOTP_SECRET_ADMIN = process.env.TOTP_SECRET_ADMIN || speakeasy.generateSecret({
    name: 'Active Zone Hub - Admin Login',
    issuer: 'Active Zone Hub'
}).base32;

// Log TOTP secrets on startup (for initial setup)
if (!process.env.TOTP_SECRET || !process.env.TOTP_SECRET_ADMIN) {
    console.log('\n' + '='.repeat(50));
    console.log('🔒 GOOGLE AUTHENTICATOR SETUP');
    console.log('='.repeat(50));
    if (!process.env.TOTP_SECRET_ADMIN) {
        console.log('Admin Login Secret:');
        console.log(`TOTP_SECRET_ADMIN=${TOTP_SECRET_ADMIN}`);
    }
    if (!process.env.TOTP_SECRET) {
        console.log('Order Delete Secret:');
        console.log(`TOTP_SECRET=${TOTP_SECRET}`);
    }
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    console.log(`\nOr scan QR codes at: ${appUrl}/api/totp/setup`);
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

// ============================================
// RATE LIMITING - Protect against brute force
// ============================================

// Strict rate limit for admin login (5 attempts per 15 minutes)
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limit for order deletion (3 attempts per 15 minutes)
const deleteRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 attempts
    message: { success: false, error: 'Too many delete attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Moderate rate limit for general API (100 requests per minute)
const generalRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { success: false, error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection?.remoteAddress
        };
        
        if (res.statusCode >= 400) {
            logger.warn('Request failed', logData);
        } else {
            logger.info('Request', logData);
        }
    });
    
    next();
});

// Apply general rate limiting to all API routes
app.use('/api', generalRateLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Use route files
app.use('/api/member', memberRoutes);
app.use('/api/login', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/purchase', paymentRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

// Check if member exists endpoint
app.get('/api/check-member', async (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    try {
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
    
    // Check if Paystack is configured
    if (!PAYSTACK_SECRET_KEY) {
        console.error('Cannot verify payment: PAYSTACK_SECRET_KEY not configured');
        // For testing: simulate successful payment if no Paystack key
        // This allows testing the flow without Paystack credentials
        console.log('⚠️ Simulating successful payment for testing (no Paystack key)');
        
        // Check if we have the order locally
        const order = await OrderDB.getByReference(reference);
        if (order) {
            await OrderDB.updatePayment(order.id, {
                paymentStatus: 'paid',
                status: 'paid',
                paidAt: new Date().toISOString()
            });
            console.log(`Order ${reference} marked as PAID (test mode)`);
        }
        
        return res.json({
            success: true,
            message: 'Payment verified (test mode - no Paystack credentials)',
            testMode: true,
            data: {
                reference: reference,
                amount: order?.total || 0,
                paidAt: new Date().toISOString(),
                channel: 'test'
            }
        });
    }
    
    try {
        console.log('Verifying payment for reference:', reference);
        
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`
            }
        });
        
        const result = await response.json();
        console.log('Paystack verification response:', JSON.stringify(result, null, 2));
        
        if (!response.ok) {
            console.error('Paystack API error:', result);
            return res.status(response.status).json({
                success: false,
                message: result.message || 'Paystack API error',
                error: result
            });
        }
        
        if (result.status && result.data.status === 'success') {
            // Update order status to paid in MySQL (if database is available)
            const order = await OrderDB.getByReference(reference);
            if (order) {
                // Update payment status using OrderDB helper
                await OrderDB.updatePayment(order.id, {
                    paymentStatus: 'paid',
                    status: 'paid',
                    paidAt: result.data.paid_at
                });
                
                console.log(`Order ${reference} marked as PAID`);
                
                // Note: Gym Master payment logging requires admin API credentials
                // Payment status must be manually updated in Gym Master admin dashboard
                console.log(`⚠️  Manual action required: Mark payment as "Paid" in Gym Master admin panel`);
                console.log(`   Transaction Reference: ${order.gymMasterTransactionRef}`);
                console.log(`   Order ID: ${order.id}`);
                console.log(`   Amount: ₦${result.data.amount / 100}`);
                
                // Send order confirmation email with tracking link
                const customerName = order.customerName || 'Valued Customer';
                
                // Prepare email order object
                const emailOrder = {
                    ...order,
                    orderId: order.id,
                    customer: {
                        name: customerName,
                        email: order.customerEmail,
                        phone: order.customerPhone
                    },
                    timestamp: order.createdAt
                };
                
                sendOrderConfirmationEmail(order.customerEmail, emailOrder).then(emailResult => {
                    if (emailResult.success) {
                        console.log(`✅ Order confirmation email sent to ${order.customerEmail}`);
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

// Update order delivery status (admin only)
app.patch('/api/orders/:orderId/status', [
    param('orderId').trim().escape().notEmpty().withMessage('Order ID is required'),
    body('deliveryStatus').isIn(['pending', 'paid', 'processing', 'shipped', 'delivered']).withMessage('Invalid delivery status'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { orderId } = req.params;
    const { deliveryStatus } = req.body;
    
    const validStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
    
    if (!deliveryStatus || !validStatuses.includes(deliveryStatus)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid delivery status. Must be one of: ' + validStatuses.join(', ')
        });
    }
    
    try {
        const order = await OrderDB.getById(orderId);
        
        if (order) {
            const oldStatus = order.status || 'pending';
            await OrderDB.updateStatus(orderId, deliveryStatus);
            
            console.log(`Order ${orderId} status updated: ${oldStatus} → ${deliveryStatus}`);
            
            // Send status update email (only for processing, shipped, delivered)
            if (['processing', 'shipped', 'delivered'].includes(deliveryStatus)) {
                // Map DB order to email order object
                const emailOrder = {
                    ...order,
                    orderId: order.id,
                    customer: {
                        name: order.customerName,
                        email: order.customerEmail,
                        phone: order.customerPhone
                    },
                    timestamp: order.createdAt
                };
                
                sendStatusUpdateEmail(order.customerEmail, emailOrder, deliveryStatus)
                    .then(result => {
                        if (result.success) {
                            console.log(`✅ Status update email sent to ${order.customerEmail}`);
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
                order: { ...order, status: deliveryStatus },
                emailSent: ['processing', 'shipped', 'delivered'].includes(deliveryStatus)
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, error: 'Failed to update order status' });
    }
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
    try {
        const testEmail = req.query.email || 'yarima.abubakar@activezone.ng';
        
        console.log('\n' + '='.repeat(60));
        console.log('🧪 SENDING TEST EMAIL');
        console.log('='.repeat(60));
        console.log(`To: ${testEmail}`);
        console.log(`From: ${process.env.SMTP_FROM_NAME || 'Active Zone Hub'} <${process.env.SMTP_FROM_EMAIL || 'activezone6060@gmail.com'}>`);
        console.log('='.repeat(60));
        
        if (!brevoClient) {
            console.log('❌ No email service configured');
            console.log('='.repeat(60) + '\n');
            return res.status(500).json({
                success: false,
                error: 'Email service not configured. Please check BREVO_API_KEY in .env file'
            });
        }
        
        // Send test email using Brevo
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = {
            name: process.env.SMTP_FROM_NAME || 'Active Zone Hub',
            email: process.env.SMTP_FROM_EMAIL || 'activezone6060@gmail.com'
        };
        sendSmtpEmail.to = [{ email: testEmail }];
        sendSmtpEmail.subject = 'Test Email from Active Zone Hub';
        sendSmtpEmail.htmlContent = '<h1 style="color: #e53935;">Test Email</h1><p>This is a test email to verify Brevo email configuration is working correctly.</p><p><strong>If you received this, your email service is working! ✅</strong></p>';
        sendSmtpEmail.textContent = 'This is a test email to verify Brevo email configuration is working correctly. If you received this, your email service is working!';
        
        const result = await brevoClient.sendTransacEmail(sendSmtpEmail);
        
        console.log('✅ Test email sent successfully!');
        if (result.body && result.body.messageId) {
            console.log(`   Message ID: ${result.body.messageId}`);
        }
        console.log('='.repeat(60) + '\n');
        
        res.json({
            success: true,
            message: 'Test email sent successfully via Brevo',
            messageId: result.body?.messageId || 'N/A',
            recipient: testEmail
        });
    } catch (error) {
        console.error('❌ Test email failed:', error.message);
        console.log('='.repeat(60) + '\n');
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.toString()
        });
    }
});

// Admin login with password (rate limited)
app.post('/api/admin/login', loginRateLimiter, [
    body('password').trim().notEmpty().withMessage('Password is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { password } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ActiveZone@2026';
    
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});

// TOTP Setup endpoint - Display QR code for Google Authenticator
app.get('/api/totp/setup', async (req, res) => {
    try {
        const otpauthUrlLogin = speakeasy.otpauthURL({
            secret: TOTP_SECRET_ADMIN,
            label: 'Active Zone Hub - Admin Login',
            issuer: 'Active Zone Hub',
            encoding: 'base32'
        });
        
        const otpauthUrlDelete = speakeasy.otpauthURL({
            secret: TOTP_SECRET,
            label: 'Active Zone Hub - Order Delete',
            issuer: 'Active Zone Hub',
            encoding: 'base32'
        });
        
        const qrCodeLogin = await QRCode.toDataURL(otpauthUrlLogin, { 
            width: 300,
            margin: 2,
            color: { dark: '#1a1a1a', light: '#ffffff' }
        });
        const qrCodeDelete = await QRCode.toDataURL(otpauthUrlDelete, { 
            width: 300,
            margin: 2,
            color: { dark: '#1a1a1a', light: '#ffffff' }
        });
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Authenticator Setup</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; text-align: center; background: #f5f5f5; }
                    h1 { color: #e53935; margin-bottom: 30px; }
                    h2 { color: #333; margin-top: 0; }
                    .qr-section { background: #fff; padding: 30px; border-radius: 12px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .qr-code { margin: 20px 0; text-align: center; }
                    .qr-code img { width: 250px; height: 250px; border: 3px solid #e53935; border-radius: 8px; padding: 10px; background: #fff; }
                    .secret { background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0; font-family: monospace; font-size: 18px; border: 2px dashed #ccc; word-break: break-all; letter-spacing: 2px; }
                    .instructions { text-align: left; line-height: 2; background: #fff; padding: 25px; border-radius: 12px; margin-top: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .step { margin: 10px 0; padding-left: 30px; position: relative; }
                    .step::before { content: counter(step); counter-increment: step; position: absolute; left: 0; width: 22px; height: 22px; background: #e53935; color: #fff; border-radius: 50%; text-align: center; line-height: 22px; font-size: 12px; font-weight: bold; }
                    .instructions { counter-reset: step; }
                    .note { background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 14px; border-left: 4px solid #ffc107; }
                    .account-type { display: inline-block; background: #e53935; color: #fff; padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-bottom: 10px; }
                    .copy-btn { background: #e53935; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 10px; }
                    .copy-btn:hover { background: #c62828; }
                </style>
            </head>
            <body>
                <h1>🔒 Google Authenticator Setup</h1>
                
                <div class="qr-section">
                    <span class="account-type">ADMIN LOGIN</span>
                    <h2>📱 Admin Login Code</h2>
                    <p>Use this to log into the Orders Admin page</p>
                    <div class="qr-code">
                        <img src="${qrCodeLogin}" alt="QR Code for Login" />
                    </div>
                    <p><strong>Or enter manually in the app:</strong></p>
                    <div class="secret">${TOTP_SECRET_ADMIN}</div>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${TOTP_SECRET_ADMIN}').then(() => alert('Secret copied!'))">📋 Copy Secret</button>
                </div>
                
                <div class="qr-section">
                    <span class="account-type" style="background: #ff9800;">ORDER DELETE</span>
                    <h2>🗑️ Delete Orders Code</h2>
                    <p>Use this to delete unpaid orders</p>
                    <div class="qr-code">
                        <img src="${qrCodeDelete}" alt="QR Code for Delete" />
                    </div>
                    <p><strong>Or enter manually in the app:</strong></p>
                    <div class="secret">${TOTP_SECRET}</div>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${TOTP_SECRET}').then(() => alert('Secret copied!'))">📋 Copy Secret</button>
                </div>
                
                <div class="instructions">
                    <h3>📋 Setup Instructions:</h3>
                    <div class="step">Download Google Authenticator (or Microsoft/Authy) from your app store</div>
                    <div class="step">Open the app and tap "+" or "Add account"</div>
                    <div class="step">Scan the QR code OR tap "Enter a setup key" and paste the secret</div>
                    <div class="step">Repeat for BOTH codes above (they are separate accounts)</div>
                    <div class="step">Use the Admin Login code to access orders.html</div>
                </div>
                
                <div class="note">
                    ⚠️ <strong>Important:</strong> These are TWO separate accounts in your authenticator app. Save both secrets securely - you'll need them to regain access if you change phones.
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('TOTP setup error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate QR code' });
    }
});

// Delete order endpoint with TOTP verification
app.delete('/api/orders/:orderId', deleteRateLimiter, async (req, res) => {
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
    
    try {
        // Find order
        const order = await OrderDB.getById(orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }
        
        // Only allow deletion of unpaid orders or pending processing
        if (order.paymentStatus === 'paid' && order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete paid orders that are being processed'
            });
        }
        
        // Remove order from MySQL
        const success = await OrderDB.delete(orderId);
        
        if (success) {
            console.log(`✅ Order ${orderId} deleted by admin (TOTP verified)`);
            res.json({
                success: true,
                message: 'Order deleted successfully',
                orderId: orderId
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to delete order'
            });
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: 'Server error deleting order' });
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
        console.log(`   From: ${process.env.SMTP_FROM_NAME || 'Active Zone Hub'} <${process.env.SMTP_FROM_EMAIL || 'activezone6060@gmail.com'}>`);
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
            <p>Dear <strong>${orderDetails.customer?.name || orderDetails.customerName || 'Valued Customer'}</strong>,</p>
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
                        <td style="color: #333333;">${new Date(orderDetails.timestamp || orderDetails.createdAt).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}</td>
                    </tr>
                    <tr>
                        <td class="label">Total Amount:</td>
                        <td><strong style="color: #e53935;">₦${(orderDetails.total || 0).toLocaleString()}</strong></td>
                    </tr>
                </table>
                
                <h3 style="margin-top: 20px;">Items Ordered:</h3>
                <ul class="items">
                    ${(orderDetails.items || []).map(item => `
                        <li>
                            <strong style="color: #1a1a1a;">${item.name}</strong><br>
                            <span style="color: #666;">Qty: ${item.quantity} × ₦${(item.price || 0).toLocaleString()} = ₦${((item.price || 0) * item.quantity).toLocaleString()}</span>
                        </li>
                    `).join('')}
                </ul>
                
                <h3>🚚 Delivery Information:</h3>
                ${orderDetails.deliveryMethod === 'delivery' && orderDetails.deliveryAddress ? `
                    <p style="color: #333333;">
                        <strong style="color: #1a1a1a;">Delivery Address:</strong><br>
                        ${orderDetails.deliveryAddress?.street || 'N/A'}<br>
                        ${orderDetails.deliveryAddress?.city || 'N/A'}, ${orderDetails.deliveryAddress?.state || 'N/A'}
                    </p>
                    <p style="color: #333333;"><strong style="color: #1a1a1a;">Delivery Fee:</strong> ₦${(orderDetails.deliveryFee || 0).toLocaleString()}</p>
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
Dear ${orderDetails.customer?.name || orderDetails.customerName || 'Valued Customer'},

Thank you for your order at Active Zone Hub!

Your Order Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order Reference: ${orderDetails.orderId}
Order Date: ${new Date(orderDetails.timestamp || orderDetails.createdAt).toLocaleString()}
Total Amount: ₦${(orderDetails.total || 0).toLocaleString()}

Items Ordered:
${(orderDetails.items || []).map(item => `• ${item.name} (Qty: ${item.quantity}) - ₦${((item.price || 0) * item.quantity).toLocaleString()}`).join('\n')}

Delivery Information:
${orderDetails.deliveryMethod === 'delivery' && orderDetails.deliveryAddress ? 
`Delivery Address:
${orderDetails.deliveryAddress?.street || 'N/A'}
${orderDetails.deliveryAddress?.city || 'N/A'}, ${orderDetails.deliveryAddress?.state || 'N/A'}
Delivery Fee: ₦${(orderDetails.deliveryFee || 0).toLocaleString()}` : 
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
                email: process.env.SMTP_FROM_EMAIL || 'activezone6060@gmail.com'
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
            <p>Dear <strong>${orderDetails.customer?.name || orderDetails.customerName || 'Valued Customer'}</strong>,</p>
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
                        <td style="color: #333333;">${new Date(orderDetails.timestamp || orderDetails.createdAt).toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}</td>
                    </tr>
                    <tr>
                        <td class="label">Total Amount:</td>
                        <td><strong style="color: #e53935;">₦${(orderDetails.total || 0).toLocaleString()}</strong></td>
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
Dear ${orderDetails.customer?.name || orderDetails.customerName || 'Valued Customer'},

${content.title.replace(/[📦🚚🎉]/g, '').trim()}

${content.message}
${content.description}

${content.nextStep}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your Order Details:
Order Reference: ${orderDetails.orderId}
Order Date: ${new Date(orderDetails.timestamp || orderDetails.createdAt).toLocaleString()}
Total Amount: ₦${(orderDetails.total || 0).toLocaleString()}
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
                email: process.env.SMTP_FROM_EMAIL || 'activezone6060@gmail.com'
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
app.post('/api/orders', [
    body('customer').isObject().withMessage('Customer must be an object'),
    body('customer.name').trim().escape().notEmpty().withMessage('Customer name is required'),
    body('customer.email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('deliveryMethod').optional().isIn(['delivery', 'pickup']).withMessage('Invalid delivery method'),
    body('total').isFloat({ min: 0 }).withMessage('Total must be a positive number'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { token, customer, items, deliveryMethod, deliveryAddress, subtotal, deliveryFee, total, notes } = req.body;
    
    // Validate required fields
    if (!customer || !items || items.length === 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Customer info and items are required' 
        });
    }
    
    // Check if Gym Master is configured
    const gymMasterConfigured = GYM_MASTER_CONFIG.apiKey && GYM_MASTER_CONFIG.baseUrl;
    
    // Token is required only if Gym Master is configured
    if (gymMasterConfigured && !token) {
        return res.status(400).json({ 
            success: false, 
            error: 'Authentication token is required for purchase. Please log in or create an account.' 
        });
    }
    
    // If Gym Master is not configured, proceed with local-only order
    if (!gymMasterConfigured) {
        console.log('⚠️ Gym Master not configured - processing order locally only');
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
        
        let paymentUrl = null;
        let gymMasterResult = null;
        
        // Step 1: Call Gym Master Purchase API (if configured)
        if (gymMasterConfigured && token) {
            console.log('📦 Calling Gym Master Purchase API...');
            
            // Prepare products array - Gym Master API expects array of {productid, quantity}
            const products = items.map(item => ({
                productid: parseInt(item.productId),  // Note: lowercase 'productid' as per Gym Master API
                quantity: parseInt(item.quantity)
            }));
            
            // Add delivery or pickup product to Gym Master order
            const DELIVERY_PRODUCT_ID = 730312;  // Delivery ₦5,000
            const PICKUP_PRODUCT_ID = 730313;    // Pick-Up ₦0 (Free)
            
            if (deliveryMethod === 'delivery') {
                products.push({
                    productid: DELIVERY_PRODUCT_ID,
                    quantity: 1
                });
                console.log('✅ Added Delivery product (730312) - ₦5,000');
            } else {
                products.push({
                    productid: PICKUP_PRODUCT_ID,
                    quantity: 1
                });
                console.log('✅ Added Pick-Up product (730313) - Free');
            }
            
            const gymMasterPurchaseData = {
                api_key: GYM_MASTER_CONFIG.apiKey,
                token: token,
                products: products
            };
            
            console.log('Gym Master Purchase Request:', JSON.stringify(gymMasterPurchaseData, null, 2));
            
            try {
                const gymMasterResponse = await fetch(`${GYM_MASTER_CONFIG.baseUrl}/api/v2/products`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(gymMasterPurchaseData)
                });
                
                gymMasterResult = await gymMasterResponse.json();
                console.log('Gym Master Purchase Response:', JSON.stringify(gymMasterResult, null, 2));
                
                // Check if Gym Master purchase was successful
                if (gymMasterResult.error) {
                    console.error('Gym Master purchase failed:', gymMasterResult.error);
                    // Continue with local order
                } else {
                    console.log('✅ Gym Master purchase successful!');
                    console.log('📦 Stock has been deducted by Gym Master');
                    
                    // Extract payment URL from Gym Master response
                    if (gymMasterResult.url) {
                        paymentUrl = gymMasterResult.url;
                    } else if (gymMasterResult.payment_url) {
                        paymentUrl = gymMasterResult.payment_url;
                    } else if (gymMasterResult.result?.url) {
                        paymentUrl = gymMasterResult.result.url;
                    }
                    
                    console.log('Transaction Reference:', gymMasterResult.transaction_ref || 'N/A');
                }
            } catch (gmError) {
                console.error('❌ Gym Master API error:', gmError.message);
                // Continue with local order
            }
        } else {
            console.log('⚠️ Skipping Gym Master - not configured or no token');
        }
        
        // Step 2: Initialize Paystack payment
        console.log('🔄 Initializing Paystack payment...');
        
        try {
            // Initialize Paystack transaction
            // Determine the base URL for callback - prioritize Vercel URL, then APP_URL, then default
            let appBaseUrl;
            if (process.env.VERCEL_URL) {
                // Vercel automatically sets this (without protocol)
                appBaseUrl = `https://${process.env.VERCEL_URL}`;
                console.log('Using VERCEL_URL:', appBaseUrl);
            } else if (process.env.APP_URL) {
                appBaseUrl = process.env.APP_URL.replace(/\/$/, '').replace('/api', '');
                console.log('Using APP_URL:', appBaseUrl);
            } else {
                appBaseUrl = 'https://activezone.vercel.app';
                console.log('Using default URL:', appBaseUrl);
            }
            
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
                    gym_master_transaction: gymMasterResult?.transaction_ref || null
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
                
        console.log('💳 Final Payment URL:', paymentUrl || 'None');
        
        // Save order to MySQL
        const orderData = {
            id: orderId,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            deliveryMethod: deliveryMethod,
            deliveryAddress: deliveryAddress,
            items: items,
            subtotal: subtotal,
            deliveryFee: deliveryFee,
            total: total,
            notes: notes,
            status: 'pending',
            paymentStatus: 'pending',
            paymentReference: orderId,
            gymMasterToken: token,
            gymMasterMemberId: gymMasterResult.result?.purchaseId || gymMasterResult.purchaseId || null,
            createdAt: new Date().toISOString()
        };
        
        const dbSuccess = await OrderDB.save(orderData);
        
        if (dbSuccess) {
            console.log(`Order ${orderId} saved to MySQL`);
        } else {
            console.error(`Failed to save order ${orderId} to MySQL`);
        }
        
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
                createdAt: orderData.createdAt
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
    logger.error('Server error', {
        message: err.message,
        path: req.path,
        method: req.method,
        stack: err.stack
    });
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, error: err.message });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
    }
    
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// 404 handler for unmatched routes
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Contact form endpoint - Send message via email
app.post('/api/contact', [
    body('name').trim().escape().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('message').trim().escape().notEmpty().withMessage('Message is required'),
    body('phone').optional().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { name, email, phone, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !message) {
        return res.status(400).json({
            success: false,
            error: 'Name, email, and message are required'
        });
    }
    
    try {
        console.log('\n' + '='.repeat(60));
        console.log('📧 NEW CONTACT FORM MESSAGE');
        console.log('='.repeat(60));
        console.log(`From: ${name} <${email}>`);
        console.log(`Phone: ${phone || 'Not provided'}`);
        console.log(`Message: ${message}`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        console.log('='.repeat(60));
        
        // Prepare email content
        const emailSubject = `New Contact Message from ${name}`;
        
        const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: #ffffff; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 28px; color: #ffffff; }
        .content { background: #ffffff; padding: 30px; border-left: 1px solid #ddd; border-right: 1px solid #ddd; }
        .message-box { background: #f9f9f9; padding: 25px; border-radius: 8px; margin: 25px 0; border: 1px solid #e0e0e0; }
        .message-box h3 { color: #e53935; margin-top: 0; }
        .message-box p { color: #333333; white-space: pre-wrap; }
        .contact-info { background: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin: 20px 0; }
        .contact-info h3 { color: #1565c0; margin-top: 0; }
        .footer { background: #1a1a1a; color: #ffffff; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
        .footer p { color: #ffffff; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 0; color: #333333; }
        .label { font-weight: bold; color: #666666; width: 120px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 New Contact Message</h1>
            <p>Active Zone Hub</p>
        </div>
        
        <div class="content">
            <p><strong>You have received a new message from your website contact form.</strong></p>
            
            <div class="contact-info">
                <h3>📋 Sender Information</h3>
                <table>
                    <tr>
                        <td class="label">Name:</td>
                        <td><strong>${name}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Email:</td>
                        <td><a href="mailto:${email}" style="color: #e53935;">${email}</a></td>
                    </tr>
                    ${phone ? `
                    <tr>
                        <td class="label">Phone:</td>
                        <td><a href="tel:${phone}" style="color: #e53935;">${phone}</a></td>
                    </tr>
                    ` : ''}
                    <tr>
                        <td class="label">Date:</td>
                        <td>${new Date().toLocaleString('en-NG', { dateStyle: 'full', timeStyle: 'short' })}</td>
                    </tr>
                </table>
            </div>
            
            <div class="message-box">
                <h3>💬 Message:</h3>
                <p>${message}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <p style="color: #666;">To respond to this message, simply reply to this email.</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Active Zone Hub - Contact Form Notification</strong></p>
            <p>This message was automatically sent from your website contact form</p>
        </div>
    </div>
</body>
</html>
        `;
        
        const emailText = `
NEW CONTACT FORM MESSAGE
========================

From: ${name} <${email}>
Phone: ${phone || 'Not provided'}
Date: ${new Date().toLocaleString()}

MESSAGE:
--------
${message}

========================

To respond, simply reply to this email.
        `;
        
        // Send email using Brevo
        if (brevoClient) {
            console.log('Sending email via Brevo...');
            
            const sendSmtpEmail = new brevo.SendSmtpEmail();
            sendSmtpEmail.sender = {
                name: 'Active Zone Hub Website',
                email: process.env.SMTP_FROM_EMAIL || 'activezone6060@gmail.com'
            };
            sendSmtpEmail.to = [{ 
                name: 'Active Zone Hub Support',
                email: 'support@activezone.ng' 
            }];
            sendSmtpEmail.replyTo = { email: email, name: name };
            sendSmtpEmail.subject = emailSubject;
            sendSmtpEmail.htmlContent = emailHTML;
            sendSmtpEmail.textContent = emailText;
            
            const result = await brevoClient.sendTransacEmail(sendSmtpEmail);
            
            console.log('✅ Contact form email sent successfully!');
            if (result.body && result.body.messageId) {
                console.log(`   Message ID: ${result.body.messageId}`);
            }
            console.log('='.repeat(60) + '\n');
            
            return res.json({
                success: true,
                message: 'Message sent successfully! We will get back to you soon.'
            });
        } else {
            console.log('⚠️  No email service configured. Saving message to file...');
            
            // Fallback: Save to file if email service unavailable
            try {
                const messagesFile = path.join(__dirname, 'contact-messages.json');
                let messages = [];
                
                if (fs.existsSync(messagesFile)) {
                    const data = fs.readFileSync(messagesFile, 'utf8');
                    messages = JSON.parse(data);
                }
                
                const messageData = {
                    id: 'MSG-' + Date.now(),
                    name,
                    email,
                    phone,
                    message,
                    timestamp: new Date().toISOString(),
                    status: 'pending'
                };
                
                messages.push(messageData);
                fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
                
                console.log('✅ Message saved to contact-messages.json');
                console.log('='.repeat(60) + '\n');
                
                return res.json({
                    success: true,
                    message: 'Message received! We will contact you soon.',
                    savedToFile: true
                });
            } catch (fileError) {
                console.error('❌ Error saving message to file:', fileError.message);
                console.log('='.repeat(60) + '\n');
                
                return res.status(500).json({
                    success: false,
                    error: 'Failed to process message'
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error processing contact form:', error.message);
        console.log('='.repeat(60) + '\n');
        
        return res.status(500).json({
            success: false,
            error: 'Failed to send message. Please try again.'
        });
    }
});

// Export app for serverless (Vercel)
module.exports = app;

// Only start server if running directly (not in serverless environment)
if (require.main === module) {
    const http = require('http');
    const https = require('https');

    // Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
        app.use((req, res, next) => {
            if (!req.secure && req.get('X-Forwarded-Proto') !== 'https') {
                return res.redirect('https://' + req.get('host') + req.url);
            }
            next();
        });
    }

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Check for SSL certificates
    const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
    const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

    if (SSL_KEY_PATH && SSL_CERT_PATH && fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
        const httpsOptions = {
            key: fs.readFileSync(SSL_KEY_PATH),
            cert: fs.readFileSync(SSL_CERT_PATH)
        };
        
        const httpsServer = https.createServer(httpsOptions, app);
        
        httpsServer.listen(PORT, '0.0.0.0', () => {
            logger.info(`HTTPS Server running on port ${PORT}`);
            logger.info('SSL/TLS enabled');
        });
        
        // Redirect HTTP to HTTPS
        httpServer.listen(80, '0.0.0.0', () => {
            logger.info('HTTP Server running - redirecting to HTTPS');
        });
    } else {
        httpServer.listen(PORT, '0.0.0.0', () => {
            if (process.env.NODE_ENV === 'production') {
                logger.warn('Running in production without HTTPS! Set SSL_KEY_PATH and SSL_CERT_PATH for secure connections');
            }
            logger.info(`HTTP Server running on port ${PORT}`);
        });
    }
}
