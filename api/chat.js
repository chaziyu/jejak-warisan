// --- THIS IS THE FIX FOR THE CHATBOT (Step 1) ---
// Import the knowledge file directly from the server.
// The '../' goes up one directory from 'api' to the root.
import { BWM_KNOWLEDGE } from '../knowledge.js';

// This is NOT client-side code. This runs on Vercel's servers.
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // --- START: ULTIMATE DEBUGGING CODE ---

    try {
        // --- THIS IS THE FIX FOR THE CHATBOT (Step 2) ---
        // We only get the userQuery from the body.
        const { userQuery } = request.body;
        const GEMINI_API_KEY = process.env.MY_GEMINI_KEY;
        
        if (!GEMINI_API_KEY) {
            console.error("CRITICAL: MY_GEMINI_KEY environment variable is not set!");
            return response.status(500).json({ reply: "Server configuration error: API key is missing." });
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        // --- THIS IS THE FIX FOR THE CHATBOT (Step 3) ---
        // We use the imported BWM_KNOWLEDGE variable, not the 'context' from the body.
        const systemPrompt = `You are an AI tour guide. Your knowledge is limited to the following text. Answer the user's question based ONLY on this text. If the answer is not in the text, say "I'm sorry, that information is not in the BWM document." --- DOCUMENT START --- ${BWM_KNOWLEDGE} --- DOCUMENT END ---`;

        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nUser Question: " + userQuery }] }]
            })
        });
        
        // Log the basic status first, as this will never fail.
        console.log(`Google API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);

        // Safely get the raw text body, which works even if it's not JSON.
        const rawBody = await apiResponse.text();
        
        // Log the entire raw response. THIS IS THE MOST IMPORTANT LOG.
        console.log('RAW RESPONSE BODY FROM GOOGLE:', rawBody);

        // Now, safely try to parse the body as JSON.
        let data;
        try {
            data = JSON.parse(rawBody);
        }
