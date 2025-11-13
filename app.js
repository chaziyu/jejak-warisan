// --- CONFIGURATION ---
// 🔴 YOUR SPECIFIC GOOGLE SHEET LINK IS HERE 🔴
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOtyJ200uEv2yu24C-DesB5g57iBX9CpO_qp8mAQCKX1LYrS_S8BnZGtfVDq_9LqnJ7HO6nbXpu8J4/pub?gid=0&single=true&output=csv"; 
const ADMIN_PASSWORD = "BWM"; // Password for NGO staff

// --- 1. APP NAVIGATION & SECURITY LOGIC ---

function getTodayString() {
    // Returns "YYYY-MM-DD" to match Google Sheet format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function initApp() {
    const landingPage = document.getElementById('landing-page');
    const gatekeeper = document.getElementById('gatekeeper');
    
    // 1. Check if user is ALREADY logged in (Valid Session?)
    const sessionData = JSON.parse(localStorage.getItem('jejak_session'));
    const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 Hours

    if (sessionData && sessionData.valid) {
        if (Date.now() - sessionData.start < SESSION_DURATION) {
            // Logged in? Destroy landing page & gatekeeper immediately
            landingPage.remove();
            gatekeeper.remove();
            return; 
        } else {
            localStorage.removeItem('jejak_session'); // Expired
        }
    }

    // 2. Not logged in? Setup the interactive buttons
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

    // Visitor Click -> Hide Landing, Show Lock Screen
    btnVisitor.addEventListener('click', () => {
        landingPage.classList.add('hidden');
        gatekeeper.classList.remove('hidden');
    });

    // Staff Click -> Ask for Password -> Show BIG RESULT SCREEN
    btnStaff.addEventListener('click', async () => {
        const pass = prompt("👮 BWM STAFF LOGIN\nPlease enter your password:");
        if (pass === ADMIN_PASSWORD) {
            await showAdminCode();
        } else if (pass !== null) {
            alert("❌ Wrong password");
        }
    });

    // Back Button (on visitor lock screen) -> Go back to Landing
    backToHome.addEventListener('click', () => {
        gatekeeper.classList.add('hidden');
        landingPage.classList.remove('hidden');
    });

    // Close Button (on staff result screen) -> Go back to Landing
    closeStaffScreen.addEventListener('click', () => {
        staffScreen.classList.add('hidden');
        // Optional: Reload page to clear everything or just stay on landing
        landingPage.classList.remove('hidden');
    });

    // Initialize the visitor lock screen logic
    setupGatekeeperLogic();
}

async function showAdminCode() {
    const staffScreen = document.getElementById('staff-screen');
    const passkeyDisplay = document.getElementById('adminPasskeyDisplay');
    const dateDisplay = document.getElementById('adminDateDisplay');
    
    // Show Loading State
    staffScreen.classList.remove('hidden');
    passkeyDisplay.textContent = "LOADING...";
    passkeyDisplay.classList.add('animate-pulse');

    try {
        const response = await fetch(SHEET_URL);
        const data = await response.text();
        const rows = data.split('\n');
        const todayStr = getTodayString();
        
        let todayCode = "NOT FOUND";
        
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            // Match date in Column A
            if (cols[0] && cols[0].trim() === todayStr) {
                todayCode = cols[1].trim();
                break;
            }
        }

        // Update the Big Screen
        passkeyDisplay.classList.remove('animate-pulse');
        passkeyDisplay.textContent = todayCode;
        dateDisplay.textContent = `Date: ${todayStr}`;

    } catch (e) {
        console.error(e);
        passkeyDisplay.textContent = "ERROR";
        alert("Error connecting to Google Sheet. Check internet.");
        staffScreen.classList.add('hidden'); // Hide if error
    }
}

function setupGatekeeperLogic() {
    const btn = document.getElementById('unlockBtn');
    const input = document.getElementById('passcodeInput');
    
    btn.addEventListener('click', () => {
        if(input.value) verifyCode(input.value);
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value) verifyCode(input.value);
    });
}

async function verifyCode(enteredCode) {
    const btn = document.getElementById('unlockBtn');
    const errorMsg = document.getElementById('errorMsg');
    const input = document.getElementById('passcodeInput');
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

        // Search CSV for today's passkey
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(',');
            if (cols.length >= 2 && cols[0].trim() === todayStr) {
                validCode = cols[1].trim();
                break;
            }
        }

        // Check Logic
        if (validCode && enteredCode.trim().toUpperCase() === validCode.toUpperCase()) {
            // SUCCESS
            const session = { valid: true, start: Date.now() };
            localStorage.setItem('jejak_session', JSON.stringify(session));
            
            // Hide everything
            gatekeeper.style.opacity = '0';
            landingPage.style.opacity = '0';
            
            setTimeout(() => {
                gatekeeper.remove();
                landingPage.remove();
            }, 500);
        } else {
            // FAIL
            btn.textContent = "Verify & Unlock";
            errorMsg.textContent = "Invalid Passkey.";
            errorMsg.classList.remove('hidden');
            input.classList.add('border-red-500');
        }
    } catch (err) {
        console.error(err);
        btn.textContent = "Error";
        alert("Connection Error.");
    }
}

// --- 2. MAP & MODAL LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    initApp(); // Start the navigation logic first

    // Initialize Map
    const map = L.map('map').setView([3.1483, 101.6938], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Modal & Data Logic
    const siteModal = document.getElementById('siteModal');
    const closeModal = document.getElementById('closeModal');
    const elements = {
        title: document.getElementById('modalTitle'),
        built: document.getElementById('modalBuilt'),
        architects: document.getElementById('modalArchitects'),
        info: document.getElementById('modalInfo')
    };

    const hideModal = () => siteModal.classList.add('hidden');
    closeModal.addEventListener('click', hideModal);
    siteModal.addEventListener('click', (e) => {
        if (e.target === siteModal) hideModal();
    });

    fetch('data.json')
        .then(res => res.json())
        .then(sites => {
            sites.forEach(site => {
                const marker = L.marker(site.coordinates).addTo(map);
                marker.on('click', () => {
                    elements.title.textContent = `${site.id}. ${site.name}`;
                    elements.built.textContent = site.built || "N/A";
                    elements.architects.textContent = site.architects || "N/A";
                    elements.info.textContent = site.info;
                    siteModal.classList.remove('hidden');
                });
            });
        });

    // User Location
    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });
});
