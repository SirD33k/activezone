const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const GYM_MASTER_CONFIG = {
    apiKey: process.env.GYM_MASTER_API_KEY,
    baseUrl: process.env.GYM_MASTER_BASE_URL,
    companyId: process.env.GYM_MASTER_COMPANY_ID
};

router.post('/', [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    try {
        const fetch = globalThis.fetch;
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/member/login?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.token) {
            res.json({
                success: true,
                token: data.token,
                memberId: data.memberId,
                member: data.member
            });
        } else {
            res.status(401).json({
                success: false,
                error: data.message || 'Invalid email or password'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

module.exports = router;
