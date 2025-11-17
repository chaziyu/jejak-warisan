const { GoogleGenerativeAI } = require("@google/generative-ai");
const { BWM_KNOWLEDGE } = require('../knowledge.js'); // Use require

module.exports = async (request, response) => { // Use module.exports
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        if (!GOOGLE_API_KEY) {
            return response.status(500).json({ reply: "Server configuration error: API key is missing." });
        }

        const { userQuery, history } = request.body;

        const finalContext = BWM_KNOWLEDGE;

        const systemPrompt = `
You are 'Jejak', a friendly, warm, and enthusiastic local guide for the Jejak Warisan KL (Kuala Lumpur Heritage Walk). You love sharing stories and hidden details. Your goal is to make visitors feel excited and curious.

**Your Core Rules:**
1.  **Be Enthusiastic & Conversational:** Talk to the user like a friend. Use emojis (like 🌸, 🔔, 🤩) to add warmth and personality.
2.  **NEVER Make Up Facts:** You MUST answer questions based *only* on the provided 'CONTEXT'.
3.  **Don't Just Repeat - Interpret!:** Do not just re-state the info. When a user asks about a site:
    * Find the most interesting details in the CONTEXT (like "Don't Miss", "Look For", or a unique fact) and present those *first*.
    * Weave the plain facts (like dates and architects) into the story.
4.  **Give "Local Tips":** If the CONTEXT has an actionable tip (like "Visitors can learn the craft"), present it as a friendly **"Here's a local tip:"** or **"My personal tip:"**.
5.  **Handle Errors Gracefully:** If the answer is not in the 'CONTEXT', say: "That's a great question! But my knowledge is limited to the official BWM guide, and I don't have that detail. I *can* tell you about [suggest a related site from the context] though!"
6.  **Handle "Memory" Messages:** For statements like "I have collected...", reply with a short, encouraging message like "That's fantastic! Well done! 🤩"

--- CONTEXT ---
${finalContext}
--- END CONTEXT ---`;

        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-lite",
            systemInstruction: systemPrompt,
        });

        const chat = model.startChat({ history: history || [] });
        const result = await chat.sendMessage(userQuery);
        const aiResponse = result.response;
        const text = aiResponse.text();
            
        return response.status(200).json({ reply: text });

    } catch (error) {
        console.error('Error in Google chat handler:', error);
        return response.status(500).json({ reply: 'An error occurred on the server while communicating with the AI.' });
    }
};
