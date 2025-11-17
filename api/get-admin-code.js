// File: /api/get-admin-code.js

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
        // --- NEW LOGGING ---
        console.log("Staff login API endpoint was triggered.");
        
        const { password } = request.body;
        const correctPassword = process.env.ADMIN_PASSWORD;

        // --- NEW LOGGING ---
        console.log(`Password received from client: '${password}'`);
        console.log(`Is ADMIN_PASSWORD variable set on server? ${!!correctPassword}`);
        
        // 1. Check the password
        if (password !== correctPassword) {
            // --- NEW LOGGING ---
            console.error("Password check FAILED. Client password did not match server password.");
            return response.status(401).json({ error: 'Wrong password' });
        }

        // --- NEW LOGGING ---
        console.log("Password check SUCCESSFUL. Fetching Google Sheet...");

        // 2. If password is correct, fetch the Google Sheet
        const SHEET_URL = process.env.GOOGLE_SHEET_URL;
        if (!SHEET_URL) {
            console.error("CRITICAL: GOOGLE_SHEET_URL is not set on server!");
            return response.status(500).json({ error: 'Server error: Sheet URL missing' });
        }
        
        const sheetResponse = await fetch(SHEET_URL);
        if (!sheetResponse.ok) {
            console.error("Failed to fetch Google Sheet.");
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
        
        // --- NEW LOGGING ---
        console.log(`Found passkey for ${todayStr}: ${todayCode}`);
        
        // 3. Return the code to the admin
        return response.status(200).json({ success: true, passkey: todayCode, date: todayStr });

    } catch (error) {
        console.error("A fatal error occurred in /api/get-admin-code:", error.message);
        return response.status(500).json({ error: 'Server error' });
    }
}
