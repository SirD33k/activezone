const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const speakeasy = require('speakeasy');
const { sendStatusUpdateEmail } = require('../utils/email');

const ORDERS_FILE = path.join(__dirname, '../../../orders-data.json');
const TOTP_SECRET = process.env.TOTP_SECRET || 'DEMO_SECRET';

// Check if MongoDB is available
const USE_DB = process.env.DATABASE_ENABLED === 'true' && process.env.MONGODB_URI;
console.log('📦 Orders Router - USE_DB:', USE_DB, 'DATABASE_ENABLED:', process.env.DATABASE_ENABLED, 'MONGODB_URI:', process.env.MONGODB_URI ? 'set' : 'not set');

// Get MongoDB connection from main server if available
let db = null;

// This will be called by server.js to share the MongoDB connection
function setDatabase(database) {
    db = database;
    console.log('📦 Orders Router - Database connection set:', !!db);
}

// Debug endpoint to check status
router.get('/debug', (req, res) => {
    res.json({
        USE_DB,
        DATABASE_ENABLED: process.env.DATABASE_ENABLED,
        MONGODB_URI: process.env.MONGODB_URI ? 'set (hidden)' : 'not set',
        dbConnected: !!db,
        timestamp: new Date().toISOString()
    });
});

function loadOrders() {
    // If MongoDB is available, we should use it
    // But this function is synchronous, so we return empty and use async version
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const data = fs.readFileSync(ORDERS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error loading orders:', error.message);
        return [];
    }
}

// Async load orders from MongoDB or file
async function loadOrdersAsync() {
    console.log('📦 loadOrdersAsync - USE_DB:', USE_DB, 'db:', !!db);
    if (USE_DB && db) {
        try {
            const orders = await db.collection('orders')
                .find({})
                .sort({ createdAt: -1 })
                .toArray();
            console.log(`📦 Loaded ${orders.length} orders from MongoDB`);
            return orders;
        } catch (error) {
            console.error('Error loading orders from MongoDB:', error.message);
            return loadOrders(); // Fallback to file
        }
    }
    console.log('📦 Falling back to file storage (USE_DB or db not available)');
    return loadOrders();
}

function saveOrders(orders) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving orders:', error.message);
        return false;
    }
}

// Async save order to MongoDB or file
async function saveOrderAsync(order) {
    if (USE_DB && db) {
        try {
            await db.collection('orders').insertOne({
                ...order,
                createdAt: order.createdAt || new Date().toISOString()
            });
            console.log(`💾 Order ${order.id || order.orderId} saved to MongoDB`);
            return true;
        } catch (error) {
            console.error('Error saving order to MongoDB:', error.message);
            // Fallback to file
        }
    }
    // Fallback to file storage
    try {
        const orders = loadOrders();
        orders.push(order);
        return saveOrders(orders);
    } catch (error) {
        console.error('Error saving order to file:', error.message);
        return false;
    }
}

// Async update order in MongoDB or file
async function updateOrderAsync(orderId, updates) {
    if (USE_DB && db) {
        try {
            const result = await db.collection('orders').updateOne(
                { $or: [{ id: orderId }, { orderId: orderId }, { paymentReference: orderId }] },
                { $set: { ...updates, updatedAt: new Date().toISOString() } }
            );
            if (result.modifiedCount > 0) {
                console.log(`💾 Order ${orderId} updated in MongoDB`);
                return true;
            }
        } catch (error) {
            console.error('Error updating order in MongoDB:', error.message);
        }
    }
    // Fallback to file
    try {
        const orders = loadOrders();
        const index = orders.findIndex(o => o.id === orderId || o.orderId === orderId || o.paymentReference === orderId);
        if (index !== -1) {
            orders[index] = { ...orders[index], ...updates };
            return saveOrders(orders);
        }
    } catch (error) {
        console.error('Error updating order in file:', error.message);
    }
    return false;
}

// Async find order by reference
async function findOrderByReference(reference) {
    console.log('📦 findOrderByReference - ref:', reference, 'USE_DB:', USE_DB, 'db:', !!db);
    if (USE_DB && db) {
        try {
            const order = await db.collection('orders').findOne({
                $or: [{ id: reference }, { orderId: reference }, { paymentReference: reference }]
            });
            console.log('📦 MongoDB find result:', order ? 'found' : 'not found');
            return order;
        } catch (error) {
            console.error('Error finding order in MongoDB:', error.message);
        }
    }
    // Fallback to file
    const orders = loadOrders();
    const order = orders.find(o => o.id === reference || o.orderId === reference || o.paymentReference === reference);
    console.log('📦 File find result:', order ? 'found' : 'not found');
    return order;
}

// Async delete order
async function deleteOrderAsync(orderId) {
    if (USE_DB && db) {
        try {
            const result = await db.collection('orders').deleteOne({
                $or: [{ id: orderId }, { orderId: orderId }, { paymentReference: orderId }]
            });
            if (result.deletedCount > 0) {
                console.log(`🗑️ Order ${orderId} deleted from MongoDB`);
                return true;
            }
        } catch (error) {
            console.error('Error deleting order from MongoDB:', error.message);
        }
    }
    // Fallback to file
    try {
        const orders = loadOrders();
        const filteredOrders = orders.filter(o => o.id !== orderId && o.orderId !== orderId && o.paymentReference !== orderId);
        if (filteredOrders.length < orders.length) {
            return saveOrders(filteredOrders);
        }
    } catch (error) {
        console.error('Error deleting order from file:', error.message);
    }
    return false;
}

// Send order email (status update)
async function sendOrderEmail(order, status) {
    console.log(`📧 Sending ${status} email for order ${order.orderId}`);
    
    const customerEmail = order.customerEmail || order.customer?.email;
    if (!customerEmail) {
        console.log('⚠️  No customer email found, skipping email');
        return { success: false, error: 'No customer email' };
    }
    
    return await sendStatusUpdateEmail(customerEmail, order, status);
}

router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const search = req.query.search;
        
        let orders = await loadOrdersAsync();
        
        // Filter by search term (order ID, customer name, email, phone)
        if (search) {
            const searchLower = search.toLowerCase();
            orders = orders.filter(o => 
                (o.orderId || o.id || '').toLowerCase().includes(searchLower) ||
                (o.customer?.name && o.customer.name.toLowerCase().includes(searchLower)) ||
                (o.customerName && o.customerName.toLowerCase().includes(searchLower)) ||
                (o.customer?.email && o.customer.email.toLowerCase().includes(searchLower)) ||
                (o.customerEmail && o.customerEmail.toLowerCase().includes(searchLower)) ||
                (o.customer?.phone && o.customer.phone.toLowerCase().includes(searchLower)) ||
                (o.customerPhone && o.customerPhone.toLowerCase().includes(searchLower))
            );
        }
        
        // Filter by status if provided
        if (status && status !== 'all') {
            orders = orders.filter(o => (o.deliveryStatus || o.status || 'pending') === status);
        }
        
        // Sort by timestamp descending
        orders = orders.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
        
        // Calculate pagination
        const total = orders.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const paginatedOrders = orders.slice(startIndex, endIndex);
        
        res.json({ 
            success: true, 
            orders: paginatedOrders,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch orders' });
    }
});

router.get('/track/:reference', [
    param('reference').trim().notEmpty().withMessage('Reference is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { reference } = req.params;

    try {
        const order = await findOrderByReference(reference);

        if (order) {
            res.json({
                success: true,
                order: {
                    orderId: order.orderId || order.id,
                    status: order.status || order.deliveryStatus || 'pending',
                    deliveryStatus: order.deliveryStatus || order.status || 'pending',
                    paymentStatus: order.paymentStatus || 'pending',
                    items: order.items,
                    total: order.total,
                    subtotal: order.subtotal,
                    deliveryFee: order.deliveryFee || 0,
                    deliveryMethod: order.deliveryMethod || 'pickup',
                    deliveryAddress: order.deliveryAddress || null,
                    customer: order.customer || {
                        name: order.customerName || 'Customer',
                        email: order.customerEmail || '',
                        phone: order.customerPhone || ''
                    },
                    timestamp: order.timestamp || order.createdAt
                }
            });
        } else {
            res.status(404).json({ success: false, error: 'Order not found' });
        }
    } catch (error) {
        console.error('Error tracking order:', error);
        res.status(500).json({ success: false, error: 'Failed to track order' });
    }
});

router.patch('/:orderId/status', [
    param('orderId').trim().escape().notEmpty().withMessage('Order ID is required'),
    body('deliveryStatus').isIn(['pending', 'paid', 'processing', 'shipped', 'delivered']).withMessage('Invalid delivery status'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { orderId } = req.params;
    const { deliveryStatus } = req.body;

    try {
        const order = await findOrderByReference(orderId);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        const updated = await updateOrderAsync(orderId, {
            deliveryStatus: deliveryStatus,
            status: deliveryStatus,
            statusUpdatedAt: new Date().toISOString()
        });

        if (!updated) {
            return res.status(500).json({ success: false, error: 'Failed to update order' });
        }

        // Send status update email
        const emailResult = await sendOrderEmail({ ...order, deliveryStatus }, deliveryStatus);
        if (emailResult.success) {
            console.log(`✅ Email sent for order ${orderId}`);
        } else {
            console.log(`⚠️  Email failed for order ${orderId}: ${emailResult.error}`);
        }

        res.json({ success: true, message: 'Order status updated', emailSent: emailResult.success });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ success: false, error: 'Failed to update order' });
    }
});

router.delete('/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const totpCode = req.headers['x-totp-code'];

    if (!totpCode) {
        return res.status(401).json({ success: false, error: 'TOTP code required' });
    }

    if (!/^\d{6}$/.test(totpCode)) {
        return res.status(400).json({ success: false, error: 'Invalid code format' });
    }

    const isValid = speakeasy.totp.verify({
        secret: TOTP_SECRET,
        encoding: 'base32',
        token: totpCode,
        window: 2
    });

    if (!isValid) {
        console.log(`Invalid TOTP code attempted for order ${orderId}`);
        return res.status(403).json({ success: false, error: 'Invalid authentication code' });
    }

    try {
        const deleted = await deleteOrderAsync(orderId);

        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        console.log(`Order ${orderId} deleted by admin (TOTP verified)`);

        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: 'Failed to delete order' });
    }
});

// POST /api/orders is handled in server.js (with Paystack and Gym Master integration)
// This route was removed to avoid conflict with the main order creation handler

// Verify payment endpoint
router.get('/verify/:reference', async (req, res) => {
    const { reference } = req.params;
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    
    if (!paystackSecret) {
        return res.status(500).json({ success: false, error: 'Payment verification not configured' });
    }
    
    try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { 'Authorization': `Bearer ${paystackSecret}` }
        });
        
        const result = await response.json();
        
        if (result.status && result.data.status === 'success') {
            // Update order as paid
            const orders = loadOrders();
            const orderIndex = orders.findIndex(o => o.orderId === reference);
            
            if (orderIndex !== -1) {
                orders[orderIndex].paymentStatus = 'paid';
                orders[orderIndex].status = 'paid';
                orders[orderIndex].paidAt = new Date().toISOString();
                saveOrders(orders);
                
                // Send confirmation email
                const order = orders[orderIndex];
                console.log('Payment verified for order:', reference);
                console.log('Would send email to:', order.customerEmail);
            }
            
            res.json({ success: true, verified: true });
        } else {
            res.json({ success: true, verified: false });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, error: 'Failed to verify payment' });
    }
});

module.exports = router;
module.exports.setDatabase = setDatabase;
