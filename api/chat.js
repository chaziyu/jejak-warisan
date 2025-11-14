// This is NOT client-side code. This runs on Vercel's servers.
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { userQuery, context } = request.body;
    const GEMINI_API_KEY = process.env.MY_GEMINI_KEY; // <-- Your secret key
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // This is the "prompt" you send to the AI
    const systemPrompt = `You are 'Jejak Warisan AI', a helpful and friendly tour guide for the Kuala Lumpur heritage walk.
    Your knowledge is STRICTLY LIMITED to the document provided.
    Answer the user's question based ONLY on the following text.
    Do not use any outside knowledge. If the answer is not in the text, say "I'm sorry, that information is not in the BWM document."

    --- DOCUMENT START ---
    ${context}
    --- DOCUMENT END ---
    `;

    try {
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [{ text: systemPrompt + "\n\nUser Question: " + userQuery }]
                    }
                ],
                // Safety settings to prevent hallucinations
                safetySettings: [
                    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH" },
                    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH" },
                ]
            })
        });

        const data = await apiResponse.json();
        
        // Send the AI's clean text response back to your app
        const aiResponse = data.candidates[0].content.parts[0].text;
        response.status(200).json({ reply: aiResponse });

    } catch (error) {
        response.status(500).json({ error: 'Failed to fetch from Gemini API' });
    }
}
