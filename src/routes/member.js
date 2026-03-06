const express = require('express');
const router = express.Router();

const { body, query, validationResult } = require('express-validator');
const GYM_MASTER_CONFIG = {
    apiKey: process.env.GYM_MASTER_API_KEY,
    baseUrl: process.env.GYM_MASTER_BASE_URL,
    companyId: process.env.GYM_MASTER_COMPANY_ID
};

router.get('/exists', [
    query('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email } = req.query;

    try {
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/member/exists?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}&email=${encodeURIComponent(email)}`;

        console.log('Checking if member exists:', email);

        const response = await fetch(url);
        const data = await response.json();

        console.log('Member exists response:', data);

        res.json({
            success: true,
            exists: data.exists || false,
            memberId: data.memberId || null,
            message: data.message || 'Check complete'
        });
    } catch (error) {
        console.error('Error checking member:', error);
        res.status(500).json({ success: false, error: 'Failed to check member existence' });
    }
});

router.post('/create', [
    body('firstName').trim().escape().notEmpty().withMessage('First name is required'),
    body('lastName').trim().escape().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { firstName, lastName, email, phone, address } = req.body;

    try {
        const fetch = globalThis.fetch;
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/member/create?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}`;

        const postData = {
            firstName,
            lastName,
            email,
            phone,
            address
        };

        console.log('Creating prospect:', postData);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
        });

        const data = await response.json();

        console.log('Prospect created:', data);

        if (data.success || data.memberId) {
            res.json({
                success: true,
                memberId: data.memberId || data.id,
                message: 'Prospect created successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: data.message || 'Failed to create prospect'
            });
        }
    } catch (error) {
        console.error('Error creating prospect:', error);
        res.status(500).json({ success: false, error: 'Failed to create prospect' });
    }
});

router.post('/profile/update', [
    body('token').trim().notEmpty().withMessage('Authentication token is required'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { token, phone, address } = req.body;

    try {
        const fetch = globalThis.fetch;
        const url = `${GYM_MASTER_CONFIG.baseUrl}/api/v2/member/profile/update?api_key=${GYM_MASTER_CONFIG.apiKey}&companyId=${GYM_MASTER_CONFIG.companyId}&token=${encodeURIComponent(token)}`;

        const postData = {};
        if (phone) postData.phone = phone;
        if (address) postData.address = address;

        console.log('Updating member profile:', postData);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData)
        });

        const data = await response.json();

        console.log('Profile update response:', data);

        res.json({
            success: data.success !== false,
            message: data.message || 'Profile updated'
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

module.exports = router;
