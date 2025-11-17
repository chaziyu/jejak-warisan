import { GoogleGenerativeAI } from "@google/generative-ai";
import { BWM_KNOWLEDGE } from '../knowledge.js';
// We removed the KV import, so this file is clean.

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // --- 1. Get the new Google Key ---
        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        if (!GOOGLE_API_KEY) {
            console.error("CRITICAL: GOOGLE_API_KEY environment variable is not set!");
            return response.status(500).json({ reply: "Server configuration error: API key is missing." });
        }

        // --- 2. Get data from the client (app.js) ---
        const { userQuery, history } = request.body;

        // --- 3. This is the same System Prompt for the AI ---
        const systemPrompt = `You are an AI tour guide for the Jejak Warisan (Heritage Walk) in Kuala Lumpur. Your knowledge is limited to the BWM Document provided below.

--- MAIN TASK ---
Answer the user's questions based ONLY on the BWM document. If the answer is not in the text, say "I'm sorry, that information is not in the BWM document."

--- SECOND TASK: USER MEMORY ---
The user will send you 'memory' messages like "I have just collected the stamp for...".
- When you receive one, just give a short, encouraging reply like "Great! Well done." or "Excellent! What's next?".
- Use this chat history to remember what the user has done.
- If the user asks "What stamps have I collected?" or "Where have I been?", answer them by listing the sites from the 'memory' messages you received.

--- FORMATTING RULES ---
- Always use Markdown for formatting.
- When you need to list items (like locations, suggestions, or steps), use bullet points (*), not numbered lists.
- For each main bullet point, add a one-line description.
- If a main bullet point has specific examples (like building names), list them as indented sub-bullets (  *).
- Always use newlines (\n) to separate items. DO NOT output a single run-on paragraph.
- Use an appropriate emoji at the start of each main bullet point.

--- DOCUMENT START ---
${BWM_KNOWLEDGE}
--- DOCUMENT END ---`;

        // --- 4. Initialize the Google AI Client ---
        const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({
            // --- THIS IS THE FIX ---
            // Switched to the "Flash-Lite" model
            model: "gemini-2.5-flash-lite",
            // --- END OF FIX ---
            systemInstruction: systemPrompt,
        });

        // --- 5. Start a chat session with the previous history ---
        const chat = model.startChat({
            history: history || [], 
        });

        // --- 6. Send the new user query ---
        // This includes the smart "503 Error" handling
        try {
            const result = await chat.sendMessage(userQuery);
            const aiResponse = result.response;
            const text = aiResponse.text();
            
            return response.status(200).json({ reply: text });

        } catch (error) {
            // Check if it's the 503 "Overloaded" error
            if (error.status === 503) {
                console.warn("Google AI model is overloaded (503). Sending friendly error.");
                return response.status(200).json({ reply: "I'm sorry, the AI guide is very busy right now. Please try asking again in a moment." });
            } else {
                // If it's a *different* error, we still want to know about it
                throw error;
            }
        }

    } catch (error) {
        // This will now only catch *other* fatal errors
        console.error('FATAL ERROR in Google chat handler:', error);
        return response.status(500).json({ reply: 'A fatal error occurred on the server.' });
    }
}
