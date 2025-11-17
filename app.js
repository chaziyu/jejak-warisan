// --- CONFIGURATION ---
const HISTORY_WINDOW_SIZE = 10;
const MAX_MESSAGES_PER_SESSION = 15;
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// --- GAME STATE ---
let map = null;
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
let discoveredSites = JSON.parse(localStorage.getItem('jejak_discovered')) || [];
const TOTAL_SITES = 13; 
let allSiteData = []; 
let chatHistory = [];
let userMessageCount = parseInt(localStorage.getItem('jejak_message_count')) || 0;

// --- CORE GAME & MAP INITIALIZATION ---
function initializeGameAndMap() {
    if (map) return;
    map = L.map('map').setView([3.1483, 101.6938], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 20
    }).addTo(map);

    // --- MAP FIX ---
    // This tells Leaflet to re-check its size after the 
    // container is visible, which fixes the "map not showing" bug.
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
    // --- END MAP FIX ---

    const heritageZoneCoords = [[3.148934,101.694228],[3.148012,101.694051],[3.147936,101.694399],[3.147164,101.694292],[3.147067,101.695104],[3.146902,101.695994],[3.146215,101.695884],[3.146004,101.69586],[3.145961,101.695897],[3.145896,101.69616],[3.145642,101.696179],[3.145672,101.696616],[3.145883,101.696592],[3.145982,101.696922],[3.146416,101.69667],[3.146694,101.696546],[3.146828,101.696584],[3.146903,101.69689],[3.147075,101.697169],[3.147541,101.697517],[3.147889,101.697807],[3.147969,101.697872],[3.148366,101.697491],[3.149041,101.696868],[3.14933,101.696632],[3.149549,101.696718],[3.150106,101.697303],[3.15038,101.697576],[3.150439,101.697668],[3.150733,101.697576],[3.151065,101.697694],[3.151467,101.697791],[3.15181,101.698011],[3.152051,101.698306],[3.152158,101.698413],[3.152485,101.698435],[3.152586,101.698413],[3.151802,101.697252],[3.151796,101.697171],[3.152102,101.696968],[3.151684,101.696683],[3.151914,101.69627],[3.151298,101.695889],[3.151581,101.695549],[3.150951,101.695173],[3.150238,101.694712],[3.149922,101.69451],[3.148934,101.694228]];
    L.polygon(heritageZoneCoords, { color: '#666', fillColor: '#333', fillOpacity: 0.1, weight: 2, dashArray: '5, 5', interactive: false }).addTo(map);

    fetch('data.json').then(res => res.json()).then(sites => {
        allSiteData = sites;
        updatePassport();
        sites.forEach(site => {
            const marker = L.marker(site.coordinates).addTo(map);
            if (visitedSites.includes(site.id) || discoveredSites.includes(site.id)) {
                marker._icon.classList.add('marker-visited');
            }
            marker.on('click', () => handleMarkerClick(site, marker));
        });
    }).catch(err => console.error("Error loading Map Data:", err));

    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });
}

// --- GLOBAL UI HANDLERS (STUBS) ---
// Adding placeholder functions so the app doesn't crash
function updatePassport() { console.log("updatePassport called"); }
function handleMarkerClick(site, marker) { console.log("handleMarkerClick called", site.name); }
function updateGameProgress() { console.log("updateGameProgress called"); }
function updateChatUIWithCount() { console.log("updateChatUIWithCount called"); }
function disableChatUI(flag) { console.log("disableChatUI called", flag); }
// --- END STUBS ---


// --- APP STARTUP & LANDING PAGE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Main startup logic ---
    function initApp() {
        const landingPage = document.getElementById('landing-page');
        const gatekeeper = document.getElementById('gatekeeper');
        const sessionData = JSON.parse(localStorage.getItem('jejak_session'));
        
        if (sessionData && sessionData.valid && (Date.now() - sessionData.start < SESSION_DURATION)) {
            // Session is VALID: Go straight to map
            if (landingPage) landingPage.remove();
            if (gatekeeper) gatekeeper.remove();
            document.getElementById('progress-container').classList.remove('hidden');
            initializeGameAndMap(); // This is safe now because the map fix is inside
            updateGameProgress();
            updateChatUIWithCount();
            if (userMessageCount >= MAX_MESSAGES_PER_SESSION) {
                disableChatUI(true);
            }
        } else {
            // Session is INVALID or EXPIRED: Show landing page
            localStorage.removeItem('jejak_message_count');
            userMessageCount = 0;
            localStorage.removeItem('jejak_session');
            setupLandingPage();
        }
    }

    // --- Attaches listeners to the Home/Staff/Visitor buttons ---
    function setupLandingPage() {
        document.getElementById('btnVisitor').addEventListener('click', () => {
            document.getElementById('landing-page').classList.add('hidden');
            document.getElementById('gatekeeper').classList.remove('hidden');
        });
        
        // This was the broken part. It now calls the NEW function below
        document.getElementById('btnStaff').addEventListener('click', () => {
            showAdminCode();
        });

        document.getElementById('backToHome').addEventListener('click', () => {
            document.getElementById('gatekeeper').classList.add('hidden');
            document.getElementById('landing-page').classList.remove('hidden');
        });
        
        // Listener for the new "close" button on the staff screen
        document.getElementById('closeStaffScreen').addEventListener('click', () => {
            document.getElementById('staff-screen').classList.add('hidden');
            document.getElementById('landing-page').classList.remove('hidden');
        });
        
        setupGatekeeperLogic();
        setupAdminLoginLogic(); // Connects the new admin form
    }

    //
    // --- ALL THE MISSING FUNCTIONS ARE ADDED BELOW ---
    //

    /**
     * [FIXED] This function was MISSING.
     * It shows the staff login modal.
     */
    function showAdminCode() {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('staff-screen').classList.remove('hidden');
    }

    /**
     * [FIXED] This function was MISSING.
     * It attaches the event listener to the admin login button.
     */
    function setupAdminLoginLogic() {
        document.getElementById('adminLoginBtn').addEventListener('click', async () => {
            const password = document.getElementById('adminPasswordInput').value;
            const errorMsg = document.getElementById('adminErrorMsg');
            const loginBtn = document.getElementById('adminLoginBtn');

            loginBtn.disabled = true;
            loginBtn.textContent = 'Checking...';
            errorMsg.classList.add('hidden');

            try {
                const response = await fetch('/api/get-admin-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: password })
                });

                const data = await response.json();

                if (response.ok) {
                    // SUCCESS: Show the passkey
                    document.getElementById('adminLoginForm').classList.add('hidden');
                    document.getElementById('passkeyDate').textContent = `Date: ${data.date}`;
                    document.getElementById('passkeyResult').textContent = data.passkey;
                    document.getElementById('adminResult').classList.remove('hidden');
                } else {
                    // FAILURE: Show error
                    errorMsg.textContent = data.error || 'Wrong password.';
                    errorMsg.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error in admin login:', error);
                errorMsg.textContent = 'Network error. Please try again.';
                errorMsg.classList.remove('hidden');
            }

            loginBtn.disabled = false;
            loginBtn.textContent = 'Get Passkey';
        });
    }

    /**
     * [FIXED] This function was MISSING.
     * It attaches the event listener to the visitor passkey "Unlock" button.
     */
    function setupGatekeeperLogic() {
        const unlockBtn = document.getElementById('unlockBtn');
        const passcodeInput = document.getElementById('passcodeInput');

        unlockBtn.addEventListener('click', async () => {
            const enteredCode = passcodeInput.value;
            if (!enteredCode) return;
            
            unlockBtn.disabled = true;
            unlockBtn.textContent = 'Verifying...';
            
            await verifyCode(enteredCode); // Call the verification function
            
            if (!localStorage.getItem('jejak_session')) {
                 unlockBtn.disabled = false;
                 unlockBtn.textContent = 'Verify & Unlock';
            }
        });
    }

    /**
     * [FIXED] This function was MISSING.
     * It verifies the visitor passkey against the server API.
     */
    async function verifyCode(enteredCode) {
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.classList.add('hidden');

        try {
            // This part is correct. It calls the file you named 'check-passkey.js'
            const response = await fetch('/api/check-passkey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passkey: enteredCode })
            });

            if (response.ok) {
                // SUCCESS: Create session and start game
                localStorage.setItem('jejak_session', JSON.stringify({
                    valid: true,
                    //
                    // --- THIS IS THE FIX ---
                    //
                    start: Date.now() // Was Date.Mnow()
                    //
                    // --- END FIX ---
                    //
                }));

                document.getElementById('gatekeeper').style.opacity = 0;
                document.getElementById('landing-page').style.opacity = 0;

                setTimeout(() => {
                    document.getElementById('gatekeeper').remove();
                    document.getElementById('landing-page').remove();
                    document.getElementById('progress-container').classList.remove('hidden');
                    initializeGameAndMap(); // This call is now safe
                    updateGameProgress();
                }, 500); // Wait for fade-out

            } else {
                // FAILURE: Show error message
                const data = await response.json();
                console.error('Passkey error:', data.error);
                errorMsg.textContent = data.error || 'Invalid or expired passkey.';
                errorMsg.classList.remove('hidden');
            }
        } catch (error) {
            // The Date.Mnow() crash was being caught here, showing "Network error"
            console.error('Error during passkey verification:', error);
            errorMsg.textContent = 'Network error. Please try again.';
            errorMsg.classList.remove('hidden');
        }
    }
    
    // --- Run the app ---
    initApp();
});
