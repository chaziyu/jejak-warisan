// This imports the knowledge file directly on the server.
import { BWM_KNOWLEDGE } from '../knowledge.js';

// This is NOT client-side code. This runs on Vercel's servers.
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    // --- START: ULTIMATE DEBUGGING CODE ---

    try {
        const { userQuery } = request.body;
        const GEMINI_API_KEY = process.env.MY_GEMINI_KEY;
        
        if (!GEMINI_API_KEY) {
            console.error("CRITICAL: MY_GEMINI_KEY environment variable is not set!");
            return response.status(500).json({ reply: "Server configuration error: API key is missing." });
        }

        // --- THIS IS THE FIX ---
        // Trying the 'gemini-1.5-pro' model on the 'v1beta' endpoint.
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;

        const systemPrompt = `You are an AI tour guide. Your knowledge is limited to the following text. Answer the user's question based ONLY on this text. If the answer is not in the text, say "I'm sorry, that information is not in the BWM document." --- DOCUMENT START --- ${BWM_KNOWLEDGE} --- DOCUMENT END ---`;

        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nUser Question: " + userQuery }] }]
            })
        });
        
        console.log(`Google API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
        const rawBody = await apiResponse.text();
        console.log('RAW RESPONSE BODY FROM GOOGLE:', rawBody);

        let data;
        try {
            data = JSON.parse(rawBody);
        } catch (parseError) {
            console.error('Failed to parse Google response as JSON.', parseError);
            return response.status(500).json({ reply: 'The AI service returned a malformed response.' });
        }

        if (data.error) {
             console.error('Google API returned an error object:', JSON.stringify(data.error, null, 2));
             return response.status(500).json({ reply: `API Error: ${data.error.message}` });
        }

        if (!data.candidates || data.candidates.length === 0) {
            console.error('API returned no candidates. This is likely due to safety filters.', JSON.stringify(data.promptFeedback, null, 2));
            return response.status(200).json({ reply: 'My apologies, your request could not be processed due to the safety filter. Please try rephrasing.' });
        }
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        return response.status(200).json({ reply: aiResponse });

    } catch (error) {
        console.error('FATAL ERROR in chat handler:', error);
        return response.status(500).json({ reply: 'A fatal error occurred on the server.' });
    }
    // --- END: ULTIMATE DEBUGGING CODE ---
}
