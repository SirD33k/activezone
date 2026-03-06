const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const speakeasy = require('speakeasy');
const { body, validationResult } = require('express-validator');

const TOTP_SECRET = process.env.TOTP_SECRET || speakeasy.generateSecret({ name: 'Active Zone Hub', issuer: 'Active Zone Hub' }).base32;
const TOTP_SECRET_ADMIN = process.env.TOTP_SECRET_ADMIN || speakeasy.generateSecret({ name: 'Active Zone Hub - Admin', issuer: 'Active Zone Hub' }).base32;

router.post('/login', [
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

router.get('/setup', async (req, res) => {
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

module.exports = router;
