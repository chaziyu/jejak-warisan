// File: /api/check-passkey.js

// --- THIS FUNCTION IS NOW FIXED ---
function getTodayString() {
    const now = new Date();
    // Get the date string for the 'Asia/Kuala_Lumpur' timezone
    // The 'en-CA' (Canadian English) locale formats the date as YYYY-MM-DD.
    const todayStr = now.toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur'
    });
    return todayStr;
}
// --- END OF FIX ---

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { passkey } = request.body;
        if (!passkey) {
            return response.status(400).json({ error: 'Passkey required' });
        }

        const SHEET_URL = process.env.GOOGLE_SHEET_URL;
        if (!SHEET_URL) {
            return response.status(500).json({ error: 'Server misconfigured: Sheet URL missing' });
        }

        const sheetResponse = await fetch(SHEET_URL);
        if (!sheetResponse.ok) {
            return response.status(500).json({ error: 'Could not connect to passkey sheet' });
        }
        
        const data = await sheetResponse.text();
        const rows = data.split('\n');
        const todayStr = getTodayString(); // This will now be "2025-11-18"
        let validCode = null;

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols.length >= 2 && cols[0].trim() === todayStr) {
                validCode = cols[1].trim();
                break;
            }
        }

        if (validCode && passkey.trim().toUpperCase() === validCode.toUpperCase()) {
            return response.status(200).json({ success: true, message: 'Passkey valid' });
        } else {
            return response.status(401).json({ error: 'Invalid or expired passkey' });
        }

    } catch (error) {
        console.error('Error in passkey verification:', error);
        return response.status(500).json({ error: 'Server error' });
    }
}
