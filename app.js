// --- CONFIGURATION ---
const HISTORY_WINDOW_SIZE = 10;

// --- GAME STATE ---
let map = null; // Map is not initialized on page load to allow landing page buttons to work.
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
let discoveredSites = JSON.parse(localStorage.getItem('jejak_discovered')) || [];
const TOTAL_SITES = 13; 
let allSiteData = []; 
let chatHistory = [];


// --- CORE GAME & MAP INITIALIZATION ---
// This function will be called ONLY after the user gets past the landing page.
function initializeGameAndMap() {
    if (map) return; // Prevent re-initializing

    // 1. Initialize Map
    map = L.map('map').setView([3.1483, 101.6938], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 2. KML HERITAGE ZONE POLYGON (Bug Fix: Moved inside init to ensure map exists)
    const heritageZoneCoords = [[3.148934,101.694228],[3.148012,101.694051],[3.147936,101.694399],[3.147164,101.694292],[3.147067,101.695104],[3.146902,101.695994],[3.146215,101.695884],[3.146004,101.69586],[3.145961,101.695897],[3.145896,101.69616],[3.145642,101.696179],[3.145672,101.696616],[3.145883,101.696592],[3.145982,101.696922],[3.146416,101.69667],[3.146694,101.696546],[3.146828,101.696584],[3.146903,101.69689],[3.147075,101.697169],[3.147541,101.697517],[3.147889,101.697807],[3.147969,101.697872],[3.148366,101.697491],[3.149041,101.696868],[3.14933,101.696632],[3.149549,101.696718],[3.150106,101.697303],[3.15038,101.697576],[3.150439,101.697668],[3.150733,101.697576],[3.151065,101.697694],[3.151467,101.697791],[3.15181,101.698011],[3.152051,101.698306],[3.152158,101.698413],[3.152485,101.698435],[3.152586,101.698413],[3.151802,101.697252],[3.151796,101.697171],[3.152102,101.696968],[3.151684,101.696683],[3.151914,101.69627],[3.151298,101.695889],[3.151581,101.695549],[3.150951,101.695173],[3.150238,101.694712],[3.149922,101.69451],[3.148934,101.694228]];
    L.polygon(heritageZoneCoords, { color: '#666', fillColor: '#333', fillOpacity: 0.1, weight: 2, dashArray: '5, 5', interactive: false }).addTo(map);

    // 3. Fetch site data and create map markers
    fetch('data.json')
        .then(res => res.json())
        .then(sites => {
            allSiteData = sites;
            updatePassport(); // Bug Fix: Initial passport load
            sites.forEach(site => {
                const [lat, lng] = [parseFloat(site.coordinates[0]), parseFloat(site.coordinates[1])];
                const marker = L.marker([lat, lng]).addTo(map);

                if (visitedSites.includes(site.id) || discoveredSites.includes(site.id)) {
                    marker._icon.classList.add('marker-visited');
                }

                marker.on('click', () => handleMarkerClick(site, marker));
            });
        })
        .catch(err => console.error("Error loading Map Data:", err));

    // 4. Setup User Location
    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });
}

// --- GLOBAL UI HANDLERS & LOGIC ---
// These functions are now in the global scope so they are always accessible.

function handleMarkerClick(site, marker) {
    const siteModal = document.getElementById('siteModal');
    // ... (populate modal content) ...
    document.getElementById('modalTitle').textContent = `${site.id}. ${site.name}`;
    document.getElementById('modalBuilt').textContent = site.built || "N/A";
    document.getElementById('modalArchitects').textContent = site.architects || "N/A";
    document.getElementById('modalInfo').textContent = site.info;
    const imgContainer = document.getElementById('modalImageContainer');
    if (site.image) {
        document.getElementById('modalImage').src = site.image;
        imgContainer.classList.remove('hidden');
    } else {
        imgContainer.classList.add('hidden');
    }
    document.getElementById('btnDirections').href = `https://www.google.com/maps/dir/?api=1&destination=${site.coordinates[0]},${site.coordinates[1]}&travelmode=walking`;
    document.getElementById('btnAskAI').onclick = (e) => {
        e.preventDefault();
        siteModal.classList.add('hidden');
        document.getElementById('chatModal').classList.remove('hidden');
        document.getElementById('chatInput').value = `Tell me more about the ${site.name}.`;
    };

    const btnCollect = document.getElementById('btnCollectStamp');
    const isNumberedSite = !isNaN(site.id);
    btnCollect.style.display = 'flex';

    if (isNumberedSite) {
        if (visitedSites.includes(site.id)) {
            btnCollect.innerHTML = "✅ Stamp Collected";
            btnCollect.disabled = true;
        } else {
            btnCollect.innerHTML = "🏆 Earn Stamp (Quiz!)";
            btnCollect.disabled = false;
            btnCollect.onclick = () => openQuizModal(site, marker, btnCollect);
        }
    } else {
        if (discoveredSites.includes(site.id)) {
            btnCollect.innerHTML = "✅ Discovered!";
            btnCollect.disabled = true;
        } else {
            btnCollect.innerHTML = "💡 Discover this Point";
            btnCollect.disabled = false;
            btnCollect.onclick = () => {
                discoveredSites.push(site.id);
                localStorage.setItem('jejak_discovered', JSON.stringify(discoveredSites));
                marker._icon.classList.add('marker-visited');
                btnCollect.innerHTML = "✅ Discovered!";
                btnCollect.disabled = true;
                btnCollect.classList.add('opacity-50', 'cursor-not-allowed');
                updatePassport(); // Bug Fix: Update passport after discovery
            };
        }
    }
    if (btnCollect.disabled) {
        btnCollect.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        btnCollect.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    siteModal.classList.remove('hidden');
}

function openQuizModal(site, marker, btnCollect) {
    document.getElementById('siteModal').classList.add('hidden');
    document.getElementById('quizTitle').textContent = `Quiz for: ${site.name}`;
    document.getElementById('quizQuestion').textContent = site.quiz.q;
    const quizInput = document.getElementById('quizInput');
    quizInput.value = '';
    document.getElementById('quizError').classList.add('hidden');
    document.getElementById('quizModal').classList.remove('hidden');
    document.getElementById('quizSubmitBtn').onclick = () => checkQuizAnswer(site, marker, btnCollect, quizInput);
}

function checkQuizAnswer(site, marker, btnCollect, quizInput) {
    if (quizInput.value.trim().toLowerCase() === site.quiz.a.toLowerCase()) {
        document.getElementById('quizModal').classList.add('hidden');
        collectStamp(site.id, marker, btnCollect, site.name);
    } else {
        const quizError = document.getElementById('quizError');
        quizError.textContent = "Not quite! Try reading the info again.";
        quizError.classList.remove('hidden');
    }
}

function collectStamp(siteId, marker, btn, siteName) {
    if (!visitedSites.includes(siteId)) {
        visitedSites.push(siteId);
        localStorage.setItem('jejak_visited', JSON.stringify(visitedSites));
        marker._icon.classList.add('marker-visited');
        btn.innerHTML = "✅ Stamp Collected";
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        updateGameProgress();
        updatePassport(); // Bug Fix: Update passport after collecting stamp
        handleChatSend(`I have just collected the stamp for ${siteName}.`, true);
        const numberedSitesVisited = visitedSites.filter(id => !isNaN(id)).length;
        if (numberedSitesVisited >= TOTAL_SITES) {
            setTimeout(() => {
                document.getElementById('siteModal').classList.add('hidden');
                document.getElementById('rewardModal').classList.remove('hidden');
            }, 1000);
        }
    }
}

async function updatePassport() {
    const passportGrid = document.getElementById('passportGrid');
    const passportCount = document.getElementById('passportCount');
    if (!passportGrid || !passportCount) return;
    if (allSiteData.length === 0) {
        try {
            const response = await fetch('data.json');
            allSiteData = await response.json();
        } catch (e) { passportGrid.innerHTML = 'Error loading stamps.'; return; }
    }
    const mainSites = allSiteData.filter(site => !isNaN(site.id));
    passportGrid.innerHTML = '';
    let collectedCount = 0;
    mainSites.forEach(site => {
        const stampEl = document.createElement('div');
        const isCollected = visitedSites.includes(site.id);
        stampEl.className = 'relative w-full aspect-square border rounded-lg shadow-sm overflow-hidden';
        stampEl.classList.toggle('bg-green-100', isCollected);
        stampEl.classList.toggle('bg-gray-100', !isCollected);
        stampEl.innerHTML = `
            <img src="${site.image}" alt="${site.name}" class="w-full h-full object-cover ${!isCollected ? 'filter grayscale opacity-60' : ''}">
            <div class="absolute bottom-0 left-0 w-full bg-black/50 text-white p-1 text-center"><p class="text-xs font-bold ${!isCollected ? 'opacity-70' : ''}">${site.id}. ${isCollected ? site.name : '???'}</p></div>
            ${isCollected ? '<div class="absolute top-1 right-1 text-2xl">✅</div>' : ''}`;
        if(isCollected) collectedCount++;
        passportGrid.appendChild(stampEl);
    });
    passportCount.textContent = collectedCount;
}

function updateGameProgress() {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (!progressBar || !progressText) return;
    const count = visitedSites.filter(id => !isNaN(id)).length;
    progressBar.style.width = `${(count / TOTAL_SITES) * 100}%`;
    progressText.textContent = `${count}/${TOTAL_SITES} Sites`;
}

async function handleChatSend(query, isSilent = false) {
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const userQuery = query || chatInput.value.trim();
    if (!userQuery) return;
    if (!isSilent) addChatMessage(userQuery, 'user');
    chatInput.value = '';
    chatSendBtn.disabled = true;
    chatSendBtn.textContent = '...';
    try {
        const recentHistory = chatHistory.slice(-HISTORY_WINDOW_SIZE);
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userQuery, history: recentHistory })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.reply || "Failed to get response.");
        addChatMessage(data.reply, 'bot');
    } catch (error) {
        addChatMessage(`Error: ${error.message}`, 'bot');
    } finally {
        chatSendBtn.disabled = false;
        chatSendBtn.textContent = 'Send';
    }
}

function addChatMessage(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('flex', 'justify-' + (sender === 'user' ? 'end' : 'start'));
    messageDiv.innerHTML = `<div class="${sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'} p-3 rounded-lg max-w-xs"><p>${message}</p></div>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatHistory.push({
        role: (sender === 'user' ? 'user' : 'model'),
        parts: [{ text: message }]
    });
}

// --- APP STARTUP & LANDING PAGE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    function initApp() {
        const landingPage = document.getElementById('landing-page');
        const gatekeeper = document.getElementById('gatekeeper');
        const sessionData = JSON.parse(localStorage.getItem('jejak_session'));
        const SESSION_DURATION = 24 * 60 * 60 * 1000;
        if (sessionData && sessionData.valid && (Date.now() - sessionData.start < SESSION_DURATION)) {
            if (landingPage) landingPage.remove();
            if (gatekeeper) gatekeeper.remove();
            document.getElementById('game-ui').classList.remove('hidden');
            initializeGameAndMap();
            updateGameProgress();
        } else {
            localStorage.removeItem('jejak_session');
            setupLandingPage();
        }
    }

    function setupLandingPage() {
        // ... (This function is now simple and just sets up listeners)
        document.getElementById('btnVisitor').addEventListener('click', () => {
            document.getElementById('landing-page').classList.add('hidden');
            document.getElementById('gatekeeper').classList.remove('hidden');
        });
        document.getElementById('btnStaff').addEventListener('click', () => {
            document.getElementById('landing-page').classList.add('hidden');
            showAdminCode();
        });
        document.getElementById('backToHome').addEventListener('click', () => {
            document.getElementById('gatekeeper').classList.add('hidden');
            document.getElementById('landing-page').classList.remove('hidden');
        });
        document.getElementById('closeStaffScreen').addEventListener('click', () => {
            document.getElementById('staff-screen').classList.add('hidden');
            document.getElementById('landing-page').classList.remove('hidden');
        });
        setupGatekeeperLogic();
    }

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
        passkeyDisplay.textContent = "VERIFYING...";
        passkeyDisplay.classList.add('animate-pulse');
        try {
            const response = await fetch('/api/get-admin-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch passkey');
            passkeyDisplay.classList.remove('animate-pulse');
            passkeyDisplay.textContent = data.passkey;
            dateDisplay.textContent = `Date: ${data.date}`;
        } catch (e) {
            passkeyDisplay.classList.remove('animate-pulse');
            passkeyDisplay.textContent = "ERROR";
            dateDisplay.textContent = e.message;
            setTimeout(() => {
                staffScreen.classList.add('hidden');
                document.getElementById('landing-page').classList.remove('hidden');
            }, 3000);
        }
    }

    function setupGatekeeperLogic() {
        const btn = document.getElementById('unlockBtn');
        const input = document.getElementById('passcodeInput');
        if (btn && input) {
            btn.addEventListener('click', () => { if (input.value) verifyCode(input.value); });
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && input.value) verifyCode(input.value); });
        }
    }

    async function verifyCode(enteredCode) {
        const btn = document.getElementById('unlockBtn');
        const errorMsg = document.getElementById('errorMsg');
        btn.textContent = "Verifying...";
        btn.disabled = true;
        errorMsg.classList.add('hidden');
        try {
            const response = await fetch('/api/verify-passkey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passkey: enteredCode })
            });
            if (response.ok) {
                localStorage.setItem('jejak_session', JSON.stringify({ valid: true, start: Date.now() }));
                document.getElementById('gatekeeper').style.opacity = '0';
                document.getElementById('landing-page').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('gatekeeper').remove();
                    document.getElementById('landing-page').remove();
                    document.getElementById('game-ui').classList.remove('hidden');
                    initializeGameAndMap();
                    updateGameProgress();
                }, 500);
            } else {
                const data = await response.json();
                errorMsg.textContent = data.error || "Invalid Passkey.";
                errorMsg.classList.remove('hidden');
                btn.textContent = "Verify & Unlock";
                btn.disabled = false;
            }
        } catch (err) {
            errorMsg.textContent = "Connection error.";
            errorMsg.classList.remove('hidden');
            btn.textContent = "Verify & Unlock";
            btn.disabled = false;
        }
    }

    // Set up listeners for in-game buttons
    document.getElementById('btnChat').addEventListener('click', () => document.getElementById('chatModal').classList.remove('hidden'));
    document.getElementById('closeChatModal').addEventListener('click', () => document.getElementById('chatModal').classList.add('hidden'));
    document.getElementById('chatSendBtn').addEventListener('click', () => handleChatSend());
    document.getElementById('chatInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleChatSend(); });
    document.getElementById('btnPassport').addEventListener('click', () => {
        updatePassport();
        document.getElementById('passportModal').classList.remove('hidden');
    });
    document.getElementById('closePassportModal').addEventListener('click', () => document.getElementById('passportModal').classList.add('hidden'));
    document.getElementById('closeQuizModal').addEventListener('click', () => document.getElementById('quizModal').classList.add('hidden'));
    document.getElementById('btnRecenter').addEventListener('click', () => { if (map) map.setView([3.1483, 101.6938], 16); });
    document.getElementById('btnShare').addEventListener('click', () => {
        const text = "I just became an Official Explorer by visiting all 13 Heritage Sites in Kuala Lumpur! 🇲Y✨ Try the Jejak Warisan challenge here: #ThisKulCity #BadanWarisanMalaysia";
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + window.location.href)}`, '_blank');
    });
    document.getElementById('closeModal').addEventListener('click', () => document.getElementById('siteModal').classList.add('hidden'));
    document.getElementById('closeReward').addEventListener('click', () => document.getElementById('rewardModal').classList.add('hidden'));

    // --- START THE APP ---
    initApp();
});
