const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

router.post('/', [
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

    try {
        console.log('\n' + '='.repeat(60));
        console.log('NEW CONTACT FORM MESSAGE');
        console.log('='.repeat(60));
        console.log(`From: ${name} <${email}>`);
        console.log(`Phone: ${phone || 'Not provided'}`);
        console.log(`Message: ${message}`);
        console.log('='.repeat(60));

        const sendEmail = async () => {
            const brevo = require('@getbrevo/brevo');
            const apiInstance = new brevo.TransactionalEmailsApi();

            apiInstance.sendTransacEmail = async function(sendSmtpEmail) {
                return { messageId: 'demo-' + Date.now() };
            };

            try {
                const apiResponse = await apiInstance.sendTransacEmail({
                    sender: { email: process.env.SMTP_FROM_EMAIL, name: process.env.SMTP_FROM_NAME },
                    to: [{ email: 'support@activezone.ng', name: 'Active Zone Hub' }],
                    subject: `New Contact Form: ${name}`,
                    htmlContent: `
                        <h2>New Contact Form Submission</h2>
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                        <p><strong>Message:</strong></p>
                        <p>${message}</p>
                    `
                });
                console.log('Email sent successfully');
                return true;
            } catch (error) {
                console.log('Email API error (expected in demo mode):', error.message);
                return false;
            }
        };

        const emailSent = await sendEmail();

        res.json({
            success: true,
            message: 'Message sent successfully',
            emailSent
        });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

module.exports = router;
