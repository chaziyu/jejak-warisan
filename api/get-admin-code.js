// File: /api/get-admin-code.js
// SECURE VERSION: This endpoint now authenticates the admin and returns a temporary access token.

import crypto from 'crypto';

// In-memory storage for the temporary token.
// NOTE: For a multi-server production environment, use a shared store like Vercel KV or Redis instead.
let tempAdminToken = {
    token: null,
    expiry: null,
};

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { password } = request.body;
        const correctPassword = process.env.ADMIN_PASSWORD;

        if (!correctPassword) {
             return response.status(500).json({ error: 'Server misconfigured: Admin password not set.' });
        }
        
        // 1. Check the password
        if (password !== correctPassword) {
            return response.status(401).json({ error: 'Wrong password' });
        }

        // 2. If password is correct, generate a secure, single-use token
        const token = crypto.randomBytes(32).toString('hex');
        
        // 3. Store the token with a short expiry (e.g., 5 minutes)
        tempAdminToken = {
            token: token,
            expiry: Date.now() + 5 * 60 * 1000, // Token is valid for 5 minutes
        };

        // 4. Return the temporary token to the client
        return response.status(200).json({ success: true, token: token });

    } catch (error) {
        console.error("Error in /api/get-admin-code:", error.message);
        return response.status(500).json({ error: 'Server error during authentication.' });
    }
}
