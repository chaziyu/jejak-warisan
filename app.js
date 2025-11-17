// --- CONFIGURATION ---
import { BWM_KNOWLEDGE } from './knowledge.js';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOtyJ200uEv2yu24C-DesB5g57iBX9CpO_qp8mAQCKX1LYrS_S8BnZGtfVDq_9LqnJ7HO6nbXpu8J4/pub?gid=0&single=true&output=csv"; 
const ADMIN_PASSWORD = "BWM"; 

// --- GAME STATE ---
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
const TOTAL_SITES = 13; 

// --- 1. APP NAVIGATION & SECURITY ---

function getTodayString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function initApp() {
    const landingPage = document.getElementById('landing-page');
    const gatekeeper = document.getElementById('gatekeeper');
    
    const sessionData = JSON.parse(localStorage.getItem('jejak_session'));
    const SESSION_DURATION = 24 * 60 * 60 * 1000; 

    if (sessionData && sessionData.valid) {
        if (Date.now() - sessionData.start < SESSION_DURATION) {
            if(landingPage) landingPage.remove();
            if(gatekeeper) gatekeeper.remove();
            document.getElementById('game-ui').classList.remove('hidden');
            return; 
        } else {
            localStorage.removeItem('jejak_session');
        }
    }
    setupLandingPage();
}

function setupLandingPage() {
    const btnVisitor = document.getElementById('btnVisitor');
    const btnStaff = document.getElementById('btnStaff');
    const landingPage = document.getElementById('landing-page');
    const gatekeeper = document.getElementById('gatekeeper');
    const backToHome = document.getElementById('backToHome');
    const closeStaffScreen = document.getElementById('closeStaffScreen');
    const staffScreen = document.getElementById('staff-screen');

    if(btnVisitor) {
        btnVisitor.addEventListener('click', () => {
            landingPage.classList.add('hidden');
            gatekeeper.classList.remove('hidden');
        });
    }

    if(btnStaff) {
        btnStaff.addEventListener('click', async () => {
            const pass = prompt("👮 BWM STAFF LOGIN\nPlease enter your password:");
            if (pass === ADMIN_PASSWORD) {
                await showAdminCode();
            } else if (pass !== null) {
                alert("❌ Wrong password");
            }
        });
    }

    if(backToHome) {
        backToHome.addEventListener('click', () => {
            gatekeeper.classList.add('hidden');
            landingPage.classList.remove('hidden');
        });
    }

    if(closeStaffScreen) {
        closeStaffScreen.addEventListener('click', () => {
            staffScreen.classList.add('hidden');
            landingPage.classList.remove('hidden');
        });
    }

    setupGatekeeperLogic();
}

async function showAdminCode() {
    const staffScreen = document.getElementById('staff-screen');
    const passkeyDisplay = document.getElementById('adminPasskeyDisplay');
    const dateDisplay = document.getElementById('adminDateDisplay');
    
    staffScreen.classList.remove('hidden');
    passkeyDisplay.textContent = "LOADING...";
    passkeyDisplay.classList.add('animate-pulse');

    try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.text();
        const rows = data.split('\n');
        const todayStr = getTodayString();
        let todayCode = "NOT FOUND";
        
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols[0] && cols[0].trim() === todayStr) {
                todayCode = cols[1].trim();
                break;
            }
        }
        passkeyDisplay.classList.remove('animate-pulse');
        passkeyDisplay.textContent = todayCode;
        dateDisplay.textContent = `Date: ${todayStr}`;
    } catch (e) {
        // --- THIS IS THE FIX FOR THE STAFF LOGIN ---
        // Instead of hiding the screen, show the error.
        passkeyDisplay.classList.remove('animate-pulse');
        passkeyDisplay.textContent = "ERROR";
        dateDisplay.textContent = "Could not connect to Google Sheet.";
        console.error("Staff Login Fetch Error:", e);
        // We no longer alert or hide the screen, so staff can see the error.
    }
}

function setupGatekeeperLogic() {
    const btn = document.getElementById('unlockBtn');
    const input = document.getElementById('passcodeInput');
    
    if(btn && input) {
        btn.addEventListener('click', () => { if(input.value) verifyCode(input.value); });
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && input.value) verifyCode(input.value); });
    }
}

async function verifyCode(enteredCode) {
    const btn = document.getElementById('unlockBtn');
    const errorMsg = document.getElementById('errorMsg');
    const landingPage = document.getElementById('landing-page');
    const gatekeeper = document.getElementById('gatekeeper');
    
    btn.textContent = "Verifying...";
    errorMsg.classList.add('hidden');

    try {
        const response = await fetch(SHEET_URL);
        const data = await response.text();
        const rows = data.split('\n');
        const todayStr = getTodayString();
        let validCode = null;

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols.length >= 2 && cols[0].trim() === todayStr) {
                validCode = cols[1].trim();
                break;
            }
        }

        if (validCode && enteredCode.trim().toUpperCase() === validCode.toUpperCase()) {
            const session = { valid: true, start: Date.now() };
            localStorage.setItem('jejak_session', JSON.stringify(session));
            
            gatekeeper.style.opacity = '0';
            if(landingPage) landingPage.style.opacity = '0';
            
            setTimeout(() => {
                gatekeeper.remove();
                if(landingPage) landingPage.remove();
                document.getElementById('game-ui').classList.remove('hidden');
            }, 500);
        } else {
            btn.textContent = "Verify & Unlock";
            errorMsg.textContent = "Invalid Passkey.";
            errorMsg.classList.remove('hidden');
        }
    } catch (err) {
        btn.textContent = "Error";
        alert("Connection Error.");
    }
}

// --- 2. MAP & GAMIFICATION LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    // --- START: CHATBOT LOGIC ---

const btnChat = document.getElementById('btnChat');
const chatModal = document.getElementById('chatModal');
const closeChatModal = document.getElementById('closeChatModal');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');

if (btnChat) {
    btnChat.addEventListener('click', () => {
        chatModal.classList.remove('hidden');
    });
}

if (closeChatModal) {
    closeChatModal.addEventListener('click', () => {
        chatModal.classList.add('hidden');
    });
}

async function handleChatSend() {
    const query = chatInput.value.trim();
    if (!query) return;

    // 1. Display user's message
    addChatMessage(query, 'user');
    chatInput.value = '';
    chatSendBtn.disabled = true;
    chatSendBtn.textContent = '...';

    try {
        // --- THIS IS THE FIX FOR THE CHATBOT ---
        // We only send the query. The context is now on the server.
        const response = await fetch('/api/chat', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userQuery: query
                // No longer sending: context: BWM_KNOWLEDGE
            })
        });

        const data = await response.json();

        // 3. Display the AI's response
        addChatMessage(data.reply, 'bot');

    } catch (error) {
        addChatMessage('Error: Could not connect to the AI guide.', 'bot');
    } finally {
        chatSendBtn.disabled = false;
        chatSendBtn.textContent = 'Send';
    }
}

function addChatMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('flex');

    let innerHtml = '';
    if (sender === 'user') {
        innerHtml = `
            <div class="bg-blue-600 text-white p-3 rounded-lg ml-auto max-w-xs">
                <p>${message}</p>
            </div>`;
        messageDiv.classList.add('justify-end');
    } else {
        innerHtml = `
            <div class="bg-gray-200 text-gray-800 p-3 rounded-lg max-w-xs">
                <p>${message}</p>
            </div>`;
    }

    messageDiv.innerHTML = innerHtml;
    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

if (chatSendBtn) chatSendBtn.addEventListener('click', handleChatSend);
if (chatInput) chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleChatSend();
});

// --- END: CHATBOT LOGIC ---
    initApp();
    updateGameProgress(); 

    // Initialize Map
    // Initialize Map
    const map = L.map('map').setView([3.1483, 101.6938], 16);

    // USE THIS CLEAN STYLE (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // --- KML HERITAGE ZONE POLYGON ---
    // Coordinates extracted from your KML and swapped to [Lat, Lng] for Leaflet
    const heritageZoneCoords = [
        [3.148934, 101.694228], [3.148012, 101.694051], [3.147936, 101.694399],
        [3.147164, 101.694292], [3.147067, 101.695104], [3.146902, 101.695994],
        [3.146215, 101.695884], [3.146004, 101.695860], [3.145961, 101.695897],
        [3.145896, 101.696160], [3.145642, 101.696179], [3.145672, 101.696616],
        [3.145883, 101.696592], [3.145982, 101.696922], [3.146416, 101.696670],
        [3.146694, 101.696546], [3.146828, 101.696584], [3.146903, 101.696890],
        [3.147075, 101.697169], [3.147541, 101.697517], [3.147889, 101.697807],
        [3.147969, 101.697872], [3.148366, 101.697491], [3.
