const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { body, param, validationResult } = require('express-validator');
const speakeasy = require('speakeasy');
const { sendStatusUpdateEmail } = require('../utils/email');

const ORDERS_FILE = path.join(__dirname, '../../../orders-data.json');
const TOTP_SECRET = process.env.TOTP_SECRET || 'DEMO_SECRET';

function loadOrders() {
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

function saveOrders(orders) {
    try {
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error saving orders:', error.message);
        return false;
    }
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
        
        let orders = loadOrders();
        
        // Filter by search term (order ID, customer name, email, phone)
        if (search) {
            const searchLower = search.toLowerCase();
            orders = orders.filter(o => 
                o.orderId.toLowerCase().includes(searchLower) ||
                (o.customer?.name && o.customer.name.toLowerCase().includes(searchLower)) ||
                (o.customer?.email && o.customer.email.toLowerCase().includes(searchLower)) ||
                (o.customer?.phone && o.customer.phone.toLowerCase().includes(searchLower))
            );
        }
        
        // Filter by status if provided
        if (status && status !== 'all') {
            orders = orders.filter(o => (o.deliveryStatus || 'pending') === status);
        }
        
        // Sort by timestamp descending
        orders = orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
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
        const orders = loadOrders();
        const order = orders.find(o => o.orderId === reference);

        if (order) {
            res.json({
                success: true,
                order: {
                    orderId: order.orderId,
                    status: order.deliveryStatus || 'pending',
                    deliveryStatus: order.deliveryStatus || 'pending',
                    paymentStatus: order.paymentStatus,
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
        const orders = loadOrders();
        const orderIndex = orders.findIndex(o => o.orderId === orderId || o.id === orderId);

        if (orderIndex === -1) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        // Ensure orderId field exists
        if (!orders[orderIndex].orderId) {
            orders[orderIndex].orderId = orders[orderIndex].id;
        }

        orders[orderIndex].deliveryStatus = deliveryStatus;
        orders[orderIndex].statusUpdatedAt = new Date().toISOString();

        saveOrders(orders);

        // Send status update email
        const emailResult = await sendOrderEmail(orders[orderIndex], deliveryStatus);
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
        const orders = loadOrders();
        const filteredOrders = orders.filter(o => o.orderId !== orderId);

        if (filteredOrders.length === orders.length) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }

        saveOrders(filteredOrders);
        console.log(`Order ${orderId} deleted by admin (TOTP verified)`);

        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ success: false, error: 'Failed to delete order' });
    }
});

router.post('/', [
    body('customer').isObject().withMessage('Customer must be an object'),
    body('customer.name').trim().escape().notEmpty().withMessage('Customer name is required'),
    body('customer.email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('deliveryMethod').optional().isIn(['delivery', 'pickup']),
    body('total').isFloat({ min: 0 }).withMessage('Total must be a positive number'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { token, customer, items, deliveryMethod, deliveryAddress, subtotal, deliveryFee, total, notes } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, error: 'Authentication token is required for purchase' });
    }

    try {
        const orderId = 'AZH-' + Date.now();
        
        const newOrder = {
            id: orderId,
            orderId,
            customer,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            items,
            deliveryMethod: deliveryMethod || 'pickup',
            deliveryAddress,
            subtotal: subtotal || 0,
            deliveryFee: deliveryFee || 0,
            total,
            notes,
            paymentStatus: 'pending',
            deliveryStatus: 'pending',
            timestamp: new Date().toISOString()
        };

        const orders = loadOrders();
        orders.push(newOrder);
        saveOrders(orders);

        // Initialize Paystack payment
        let paymentUrl = null;
        const appBaseUrl = process.env.APP_URL || 'http://localhost:3001';
        try {
            const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
            if (paystackSecret) {
                const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${paystackSecret}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: customer.email,
                        amount: total * 100,
                        reference: orderId,
                        callback_url: `${appBaseUrl}/payment-success.html?reference=${orderId}`,
                        metadata: {
                            orderId,
                            customer: customer.name,
                            phone: customer.phone
                        }
                    })
                });
                
                const paystackResult = await paystackResponse.json();
                if (paystackResult.status && paystackResult.data?.authorization_url) {
                    paymentUrl = paystackResult.data.authorization_url;
                }
            }
        } catch (paystackError) {
            console.error('Paystack error:', paystackError.message);
        }

        console.log('New order created:', orderId);

        res.json({ 
            success: true, 
            orderId, 
            paymentUrl,
            message: paymentUrl ? 'Redirecting to payment...' : 'Order created successfully'
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, error: 'Failed to create order' });
    }
});

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
