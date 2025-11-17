// This imports the knowledge file directly on the server.
import { BWM_KNOWLEDGE } from '../knowledge.js';

// This is NOT client-side code. This runs on Vercel's servers.
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { userQuery } = request.body;
        // 1. Read the new Cohere API key
        const COHERE_API_KEY = process.env.MY_COHERE_KEY;

        if (!COHERE_API_KEY) {
            console.error("CRITICAL: MY_COHERE_KEY environment variable is not set!");
            return response.status(500).json({ reply: "Server configuration error: API key is missing." });
        }

        // 2. Define the system prompt (Preamble for Cohere)
        const systemPrompt = `You are an AI tour guide. Your knowledge is limited to the following text. Answer the user's question based ONLY on this text. If the answer is not in the text, say "I'm sorry, that information is not in the BWM document." --- DOCUMENT START --- ${BWM_KNOWLEDGE} --- DOCUMENT END ---`;

        // 3. Call the Cohere API
        const apiResponse = await fetch("https://api.cohere.com/v1/chat", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${COHERE_API_KEY}` // Use Cohere key
            },
            body: JSON.stringify({
                model: "command-r", // Use Cohere's 'command-r' model
                message: userQuery, // The user's query
                preamble: systemPrompt // The system prompt
            })
        });

        console.log(`Cohere API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
        const data = await apiResponse.json();

        // 4. Check for errors from Cohere
        if (!apiResponse.ok) {
            console.error('Cohere API returned an error object:', data);
            return response.status(500).json({ reply: `API Error: ${data.message}` });
        }

        // 5. Get the response text (Cohere's format is data.text)
        const aiResponse = data.text;
        return response.status(200).json({ reply: aiResponse });

    } catch (error) {
        console.error('FATAL ERROR in chat handler:', error);
        return response.status(500).json({ reply: 'A fatal error occurred on the server.' });
    }
}
