// database/db.js - PostgreSQL Database Configuration
const { Pool } = require('pg');

// Database connection pool
let pool = null;

// Initialize database connection
function initDatabase() {
    // Check if database URL is provided
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
        console.log('⚠️  No DATABASE_URL found - using file storage fallback');
        return null;
    }

    try {
        // Create connection pool
        pool = new Pool({
            connectionString: dbUrl,
            ssl: process.env.NODE_ENV === 'production' ? {
                rejectUnauthorized: false // Required for AWS RDS
            } : false,
            max: 20, // Maximum pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });

        // Test connection
        pool.query('SELECT NOW()', (err, res) => {
            if (err) {
                console.error('❌ Database connection failed:', err.message);
                pool = null;
            } else {
                console.log('✅ Database connected successfully');
                console.log(`   Time: ${res.rows[0].now}`);
            }
        });

        // Handle pool errors
        pool.on('error', (err) => {
            console.error('❌ Unexpected database error:', err);
        });

        return pool;
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        return null;
    }
}

// Get database pool instance
function getPool() {
    return pool;
}

// Close database connection
async function closeDatabase() {
    if (pool) {
        await pool.end();
        console.log('Database connection closed');
    }
}

// Order Database Operations
const OrderDB = {
    // Create order
    async create(order) {
        if (!pool) throw new Error('Database not initialized');

        const query = `
            INSERT INTO orders (
                id, customer_name, customer_email, customer_phone,
                delivery_method, delivery_address, items,
                subtotal, delivery_fee, total, notes,
                status, payment_status, payment_reference,
                gym_master_token, gym_master_member_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `;

        const values = [
            order.id,
            order.customerName,
            order.customerEmail,
            order.customerPhone,
            order.deliveryMethod,
            JSON.stringify(order.deliveryAddress || {}),
            JSON.stringify(order.items),
            order.subtotal,
            order.deliveryFee,
            order.total,
            order.notes || null,
            order.status || 'pending',
            order.paymentStatus || 'pending',
            order.paymentReference || null,
            order.gymMasterToken || null,
            order.gymMasterMemberId || null
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    },

    // Get all orders
    async getAll() {
        if (!pool) throw new Error('Database not initialized');

        const query = 'SELECT * FROM orders ORDER BY created_at DESC';
        const result = await pool.query(query);
        
        // Convert JSONB fields back to objects
        return result.rows.map(row => ({
            ...row,
            deliveryAddress: row.delivery_address,
            items: row.items,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            deliveryMethod: row.delivery_method,
            deliveryFee: parseFloat(row.delivery_fee),
            subtotal: parseFloat(row.subtotal),
            total: parseFloat(row.total),
            paymentStatus: row.payment_status,
            paymentReference: row.payment_reference,
            gymMasterToken: row.gym_master_token,
            gymMasterMemberId: row.gym_master_member_id,
            trackingNumber: row.tracking_number,
            estimatedDelivery: row.estimated_delivery,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    },

    // Get order by ID
    async getById(id) {
        if (!pool) throw new Error('Database not initialized');

        const query = 'SELECT * FROM orders WHERE id = $1';
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            ...row,
            deliveryAddress: row.delivery_address,
            items: row.items,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            deliveryMethod: row.delivery_method,
            deliveryFee: parseFloat(row.delivery_fee),
            subtotal: parseFloat(row.subtotal),
            total: parseFloat(row.total),
            paymentStatus: row.payment_status,
            paymentReference: row.payment_reference,
            gymMasterToken: row.gym_master_token,
            gymMasterMemberId: row.gym_master_member_id,
            trackingNumber: row.tracking_number,
            estimatedDelivery: row.estimated_delivery,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    },

    // Get order by payment reference
    async getByReference(reference) {
        if (!pool) throw new Error('Database not initialized');

        const query = 'SELECT * FROM orders WHERE payment_reference = $1';
        const result = await pool.query(query, [reference]);
        
        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            ...row,
            deliveryAddress: row.delivery_address,
            items: row.items,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            deliveryMethod: row.delivery_method,
            deliveryFee: parseFloat(row.delivery_fee),
            subtotal: parseFloat(row.subtotal),
            total: parseFloat(row.total),
            paymentStatus: row.payment_status,
            paymentReference: row.payment_reference,
            gymMasterToken: row.gym_master_token,
            gymMasterMemberId: row.gym_master_member_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    },

    // Update order
    async update(id, updates) {
        if (!pool) throw new Error('Database not initialized');

        const fields = [];
        const values = [];
        let paramCount = 1;

        // Build dynamic update query
        Object.keys(updates).forEach(key => {
            // Convert camelCase to snake_case for database columns
            const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            
            if (key === 'deliveryAddress' || key === 'items') {
                fields.push(`${dbKey} = $${paramCount}`);
                values.push(JSON.stringify(updates[key]));
            } else {
                fields.push(`${dbKey} = $${paramCount}`);
                values.push(updates[key]);
            }
            paramCount++;
        });

        values.push(id);
        const query = `
            UPDATE orders 
            SET ${fields.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        return result.rows[0];
    },

    // Delete order
    async delete(id) {
        if (!pool) throw new Error('Database not initialized');

        const query = 'DELETE FROM orders WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);
        return result.rows.length > 0;
    }
};

// Email Log Operations (optional)
const EmailLogDB = {
    async log(orderI, emailType, recipientEmail, status, messageId = null, errorMessage = null) {
        if (!pool) return; // Silently fail if DB not available

        const query = `
            INSERT INTO email_logs (order_id, email_type, recipient_email, status, message_id, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;

        try {
            await pool.query(query, [orderId, emailType, recipientEmail, status, messageId, errorMessage]);
        } catch (error) {
            console.error('Failed to log email:', error.message);
        }
    }
};

module.exports = {
    initDatabase,
    getPool,
    closeDatabase,
    OrderDB,
    EmailLogDB
};
