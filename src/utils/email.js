// Email utility module for Brevo integration
const brevo = require('@getbrevo/brevo');
require('dotenv').config();

// Initialize Brevo client
let brevoClient = null;

if (process.env.BREVO_API_KEY) {
    try {
        const apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
        brevoClient = apiInstance;
        console.log('✅ Email utility: Brevo client initialized');
    } catch (error) {
        console.error('❌ Email utility: Brevo initialization error:', error.message);
    }
}

/**
 * Send order confirmation email
 */
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
        
        // Plain text version
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
        console.log('='.repeat(60));
        
        if (!brevoClient) {
            console.log('⚠️  No email service configured. Email not sent.');
            return { success: false, error: 'No email service configured' };
        }
        
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
        
        if (result.body && result.body.messageId) {
            console.log('✅ Email sent successfully via Brevo API!');
            console.log(`   Message ID: ${result.body.messageId}`);
            return { success: true, messageId: result.body.messageId };
        }
        
        return { success: true, message: 'Email sent' };
        
    } catch (error) {
        console.error('❌ Error sending order confirmation email:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send order status update email
 */
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
        
        const customerName = orderDetails.customer?.name || orderDetails.customerName || 'Valued Customer';
        
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
            <p>Dear <strong>${customerName}</strong>,</p>
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
Dear ${customerName},

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
        
        if (!brevoClient) {
            console.log('⚠️  No email service configured. Email not sent.');
            return { success: false, error: 'No email service configured' };
        }
        
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
        
        if (result.body && result.body.messageId) {
            console.log('✅ Status update email sent successfully via Brevo API!');
            console.log(`   Message ID: ${result.body.messageId}`);
            return { success: true, messageId: result.body.messageId };
        }
        
        return { success: true, message: 'Status update email sent' };
        
    } catch (error) {
        console.error('❌ Error sending status update email:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendOrderConfirmationEmail,
    sendStatusUpdateEmail,
    isConfigured: () => brevoClient !== null
};
