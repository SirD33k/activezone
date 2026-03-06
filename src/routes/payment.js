const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const ORDERS_FILE = path.join(__dirname, '../../../orders-data.json');

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

router.post('/', async (req, res) => {
    const { token, items, customer, deliveryMethod, deliveryAddress, subtotal, deliveryFee, total, notes } = req.body;

    if (!customer || !items || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Customer info and items are required' });
    }

    if (!token) {
        return res.status(400).json({ success: false, error: 'Authentication token is required for purchase' });
    }

    try {
        const orderId = 'AZH-' + Date.now();

        const newOrder = {
            id: orderId,
            orderId,
            customer,
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

        const initializePayment = async () => {
            const fetch = globalThis.fetch;
            const paystackUrl = 'https://api.paystack.co/transaction/initialize';
            const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

            const response = await fetch(paystackUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${paystackSecret}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: customer.email,
                    amount: total * 100,
                    reference: orderId,
                    metadata: {
                        orderId,
                        customer: customer.name,
                        phone: customer.phone
                    }
                })
            });

            return await response.json();
        };

        const paymentResult = await initializePayment();

        if (paymentResult.status) {
            res.json({
                success: true,
                orderId,
                authorizationUrl: paymentResult.data.authorization_url,
                reference: orderId
            });
        } else {
            res.status(400).json({
                success: false,
                error: paymentResult.message || 'Failed to initialize payment'
            });
        }
    } catch (error) {
        console.error('Error creating purchase:', error);
        res.status(500).json({ success: false, error: 'Failed to create purchase' });
    }
});

router.get('/verify/:reference', async (req, res) => {
    const { reference } = req.params;

    try {
        const fetch = globalThis.fetch;
        const paystackUrl = `https://api.paystack.co/transaction/verify/${reference}`;
        const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

        const response = await fetch(paystackUrl, {
            headers: { 'Authorization': `Bearer ${paystackSecret}` }
        });

        const data = await response.json();

        if (data.status && data.data.status === 'success') {
            const orders = loadOrders();
            const orderIndex = orders.findIndex(o => o.orderId === reference);

            if (orderIndex !== -1) {
                orders[orderIndex].paymentStatus = 'paid';
                orders[orderIndex].paymentReference = data.data.reference;
                orders[orderIndex].paidAt = new Date().toISOString();
                saveOrders(orders);

                res.json({
                    success: true,
                    verified: true,
                    message: 'Payment verified successfully'
                });
            } else {
                res.json({ success: true, verified: true, message: 'Payment verified (order may be archived)' });
            }
        } else {
            res.json({ success: true, verified: false, message: 'Payment not completed' });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ success: false, error: 'Failed to verify payment' });
    }
});

module.exports = router;
