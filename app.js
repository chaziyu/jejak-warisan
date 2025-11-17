// --- CONFIGURATION ---
const HISTORY_WINDOW_SIZE = 10; // Send only the last 10 messages to the AI

// --- GAME STATE ---
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
let discoveredSites = JSON.parse(localStorage.getItem('jejak_discovered')) || [];
const TOTAL_SITES = 13; 
let allSiteData = []; 
let chatHistory = [];

// --- 1. APP NAVIGATION & SECURITY ---

function initApp() {
    // ... (This section is unchanged, your session logic is good)
}

function setupLandingPage() {
    // ... (Unchanged)
}

// --- UPDATED to use SECURE TOKEN FLOW ---
async function showAdminCode() {
    const staffScreen = document.getElementById('staff-screen');
    const passkeyDisplay = document.getElementById('adminPasskeyDisplay');
    const dateDisplay = document.getElementById('adminDateDisplay');
    
    const pass = prompt("👮 BWM STAFF LOGIN\nPlease enter your password:");
    if (!pass) {
        document.getElementById('landing-page').classList.remove('hidden');
        return;
    }

    staffScreen.classList.remove('hidden');
    passkeyDisplay.textContent = "AUTHENTICATING...";
    passkeyDisplay.classList.add('animate-pulse');

    try {
        // STEP 1: Send password to get a secure, temporary token
        const tokenResponse = await fetch('/api/get-admin-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) throw new Error(tokenData.error || 'Authentication failed');

        const { token } = tokenData;
        passkeyDisplay.textContent = "FETCHING CODE...";

        // STEP 2: Use the temporary token to fetch the actual passkey
        const passkeyResponse = await fetch('/api/fetch-todays-code', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Send the token for verification
            }
        });

        const passkeyData = await passkeyResponse.json();
        if (!passkeyResponse.ok) throw new Error(passkeyData.error || 'Failed to fetch passkey');
        
        passkeyDisplay.classList.remove('animate-pulse');
        passkeyDisplay.textContent = passkeyData.passkey;
        dateDisplay.textContent = `Date: ${passkeyData.date}`;

    } catch (e) {
        passkeyDisplay.classList.remove('animate-pulse');
        passkeyDisplay.textContent = "ERROR";
        dateDisplay.textContent = e.message;
        console.error("Staff Login Error:", e);
        setTimeout(() => {
            staffScreen.classList.add('hidden');
            document.getElementById('landing-page').classList.remove('hidden');
        }, 3000);
    }
}


function setupGatekeeperLogic() {
    // ... (Unchanged)
}

async function verifyCode(enteredCode) {
    // ... (Unchanged, this part is secure as is)
}


// --- 2. MAP & GAMIFICATION LOGIC ---

document.addEventListener('DOMContentLoaded', () => {

    initApp();
    updateGameProgress(); 

    // --- CHATBOT LOGIC with PERFORMANCE FIX ---
    const btnChat = document.getElementById('btnChat');
    const chatModal = document.getElementById('chatModal');
    // ... other element selectors
    
    async function handleChatSend(query, isSilent = false) {
        const userQuery = query || chatInput.value.trim();
        if (!userQuery) return;

        if (!isSilent) {
            addChatMessage(userQuery, 'user');
        }
        
        chatInput.value = '';
        chatSendBtn.disabled = true;
        chatSendBtn.textContent = '...';

        try {
            // --- PERFORMANCE FIX: Send only the last few messages ---
            const recentHistory = chatHistory.slice(-HISTORY_WINDOW_SIZE);

            const response = await fetch('/api/chat', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userQuery: userQuery,
                    history: recentHistory // Send only the recent history
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.reply || "Failed to get response from AI.");
            addChatMessage(data.reply, 'bot');

        } catch (error) {
            console.error("Chat Error:", error);
            addChatMessage(`Error: ${error.message}`, 'bot');
        } finally {
            chatSendBtn.disabled = false;
            chatSendBtn.textContent = 'Send';
        }
    }
    
    // ... (The rest of app.js is correct and remains unchanged)
    // - addChatMessage()
    // - Passport Logic
    // - Quiz Logic
    // - Map Initialization
    // - Marker Logic, etc.
});```

---

### Step 2: Add the New Secure API File

Create this **new file** inside your `/api/` folder. It is essential for the secure admin login to work.

#### `/api/fetch-todays-code.js` (NEW FILE)
*(**Purpose:** This secure endpoint only provides the daily passkey if a valid, non-expired temporary token is provided by the client.)*

```javascript
// File: /api/fetch-todays-code.js
// NEW SECURE ENDPOINT: Requires a temporary token to release the daily passkey.

// This needs to access the same in-memory token from the other API file.
// NOTE: This will only work reliably on a single-instance serverless environment.
// For scaling, a shared data store like Vercel KV is required.
let tempAdminToken = {
    token: null,
    expiry: null,
};

function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Get the token from the Authorization header
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return response.status(401).json({ error: 'Authorization token required' });
        }
        const clientToken = authHeader.split(' ')[1];

        // 2. Validate the token and its expiry
        if (!tempAdminToken.token || clientToken !== tempAdminToken.token) {
            return response.status(401).json({ error: 'Invalid token' });
        }
        if (Date.now() > tempAdminToken.expiry) {
            return response.status(401).json({ error: 'Token expired' });
        }
        
        // 3. If token is valid, fetch the Google Sheet
        const SHEET_URL = process.env.GOOGLE_SHEET_URL;
        if (!SHEET_URL) {
            return response.status(500).json({ error: 'Server misconfigured: Sheet URL missing' });
        }
        
        const sheetResponse = await fetch(SHEET_URL);
        if (!sheetResponse.ok) {
            return response.status(500).json({ error: 'Failed to fetch Google Sheet' });
        }
        
        const data = await sheetResponse.text();
        const rows = data.split('\n');
        const todayStr = getTodayString();
        let todayCode = "NOT FOUND";

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols.length >= 2 && cols[0].trim() === todayStr) {
                todayCode = cols[1].trim();
                break;
            }
        }
        
        // 4. Invalidate the token after use to make it single-use
        tempAdminToken = { token: null, expiry: null };
        
        // 5. Return the code to the admin
        return response.status(200).json({ success: true, passkey: todayCode, date: todayStr });

    } catch (error) {
        console.error("Error in /api/fetch-todays-code:", error.message);
        return response.status(500).json({ error: 'Server error' });
    }
}
