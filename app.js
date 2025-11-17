// --- CONFIGURATION ---
// (No audio)

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
        btnStaff.addEventListener('click', () => {
            const landingPage = document.getElementById('landing-page');
            landingPage.classList.add('hidden');
            showAdminCode(); 
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
    
    const pass = prompt("👮 BWM STAFF LOGIN\nPlease enter your password:");
    if (!pass) {
        document.getElementById('landing-page').classList.remove('hidden');
        return;
    }

    staffScreen.classList.remove('hidden');
    passkeyDisplay.textContent = "LOADING...";
    passkeyDisplay.classList.add('animate-pulse');

    try {
        const response = await fetch('/api/get-admin-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch');

        passkeyDisplay.classList.remove('animate-pulse');
        passkeyDisplay.textContent = data.passkey;
        dateDisplay.textContent = `Date: ${data.date}`;

    } catch (e) {
        passkeyDisplay.classList.remove('animate-pulse');
        passkeyDisplay.textContent = "ERROR";
        dateDisplay.textContent = e.message;
        console.error("Staff Login Fetch Error:", e);
        setTimeout(() => {
            staffScreen.classList.add('hidden');
            document.getElementById('landing-page').classList.remove('hidden');
        }, 2000);
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
    btn.disabled = true;
    errorMsg.classList.add('hidden');

    try {
        const response = await fetch('/api/verify-passkey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passkey: enteredCode })
        });

        if (response.ok) {
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
            const data = await response.json();
            errorMsg.textContent = data.error || "Invalid Passkey.";
            errorMsg.classList.remove('hidden');
            btn.textContent = "Verify & Unlock";
            btn.disabled = false;
        }
    } catch (err) {
        console.error("Fetch error:", err);
        errorMsg.textContent = "Connection error. Please try again.";
        errorMsg.classList.remove('hidden');
        btn.textContent = "Verify & Unlock";
        btn.disabled = false;
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

        addChatMessage(query, 'user');
        chatInput.value = '';
        chatSendBtn.disabled = true;
        chatSendBtn.textContent = '...';

        try {
            const response = await fetch('/api/chat', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userQuery: query
                })
            });

            const data = await response.json();
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (chatSendBtn) chatSendBtn.addEventListener('click', handleChatSend);
    if (chatInput) chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSend();
    });

    // --- END: CHATBOT LOGIC ---

    // --- NEW PASSPORT LOGIC ---
    const btnPassport = document.getElementById('btnPassport');
    const passportModal = document.getElementById('passportModal');
    const closePassportModal = document.getElementById('closePassportModal');
    const passportGrid = document.getElementById('passportGrid');
    const passportCount = document.getElementById('passportCount');

    function updatePassport() {
        if (!passportGrid || !passportCount) return;

        passportGrid.innerHTML = ''; // Clear the grid
        let collectedCount = 0;

        // Loop from 1 to 13 (TOTAL_SITES)
        for (let i = 1; i <= TOTAL_SITES; i++) {
            const siteId = String(i); // Site IDs are strings
            const stampEl = document.createElement('div');
            stampEl.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'w-16', 'h-16', 'md:w-20', 'md:h-20', 'border', 'rounded-lg', 'shadow-sm', 'transition-all');

            if (visitedSites.includes(siteId)) {
                // Collected stamp
                stampEl.classList.add('bg-green-100', 'border-green-300');
                stampEl.innerHTML = `
                    <div class="text-3xl">✅</div>
                    <div class="text-xs font-bold text-green-800">Site ${siteId}</div>
                `;
                collectedCount++;
            } else {
                // Locked stamp
                stampEl.classList.add('bg-gray-100', 'border-gray-200', 'opacity-60');
                stampEl.innerHTML = `
                    <div class="text-3xl">🔒</div>
                    <div class="text-xs font-bold text-gray-500">Site ${siteId}</div>
                `;
            }
            passportGrid.appendChild(stampEl);
        }
        
        passportCount.textContent = collectedCount;
    }

    if (btnPassport) {
        btnPassport.addEventListener('click', () => {
            updatePassport(); // Update stamps every time it's opened
            passportModal.classList.remove('hidden');
        });
    }
    if (closePassportModal) {
        closePassportModal.addEventListener('click', () => {
            passportModal.classList.add('hidden');
        });
    }
    // --- END NEW PASSPORT LOGIC ---


    initApp();
    updateGameProgress(); 

    // Initialize Map
    const map = L.map('map').setView([3.1483, 101.6938], 16);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // --- KML HERITAGE ZONE POLYGON ---
    const heritageZoneCoords = [
        [3.148934, 101.694228], [3.148012, 101.694051], [3.147936, 101.694399],
        [3.147164, 101.694292], [3.147067, 101.695104], [3.146902, 101.695994],
        [3.146215, 101.695884], [3.146004, 101.695860], [3.145961, 101.695897],
        [3.145896, 101.696160], [3.145642, 101.696179], [3.145672, 101.696616],
        [3.145883, 101.696592], [3.145982, 101.696922], [3.146416, 101.696670],
        [3.146694, 101.696546], [3.146828, 101.696584], [3.146903, 101.696890],
        [3.147075, 101.697169], [3.147541, 101.697517], [3.147889, 101.697807],
        [3.147969, 101.697872], [3.148366, 101.697491], [3.149041, 101.696868],
        [3.149330, 101.696632], [3.149549, 101.696718], [3.150106, 101.697303],
        [3.150380, 101.697576], [3.150439, 101.697668], [3.L.polygon(heritageZoneCoords, {
        color: '#666',          
        fillColor: '#333',      
        fillOpacity: 0.1,       
        weight: 2,
        dashArray: '5, 5',
        interactive: false
    }).addTo(map);

    // -----------------------------------------------

    const siteModal = document.getElementById('siteModal');
    const closeModal = document.getElementById('closeModal');
    const btnCollect = document.getElementById('btnCollectStamp');
    const btnDirections = document.getElementById('btnDirections');
    const rewardModal = document.getElementById('rewardModal');
    const closeReward = document.getElementById('closeReward');
    const btnShare = document.getElementById('btnShare');
    const btnRecenter = document.getElementById('btnRecenter');

    const elements = {
        title: document.getElementById('modalTitle'),
        built: document.getElementById('modalBuilt'),
        architects: document.getElementById('modalArchitects'),
        info: document.getElementById('modalInfo'),
        img: document.getElementById('modalImage'),             
        imgContainer: document.getElementById('modalImageContainer') 
    };

    fetch('data.json')
        .then(res => res.json())
        .then(sites => {
            sites.forEach(site => {
                const lat = parseFloat(site.coordinates[0]);
                const lng = parseFloat(site.coordinates[1]);

                const marker = L.marker([lat, lng]).addTo(map);

                if (visitedSites.includes(site.id)) {
                    marker._icon.classList.add('marker-visited');
                }

                marker.on('click', () => {
                    elements.title.textContent = `${site.id}. ${site.name}`;
                    elements.built.textContent = site.built || "N/A";
                    elements.architects.textContent = site.architects || "N/A";
                    elements.info.textContent = site.info;
                    
                    if (site.image) {
                        elements.img.src = site.image;
                        elements.imgContainer.classList.remove('hidden');
                    } else {
                        elements.imgContainer.classList.add('hidden');
                    }
                    
                    btnDirections.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

                    const isNumberedSite = !isNaN(site.id);
                    if (!isNumberedSite) {
                        btnCollect.style.display = 'none'; 
                    } else {
                        btnCollect.style.display = 'flex';
                        if (visitedSites.includes(site.id)) {
                            btnCollect.innerHTML = "✅ Stamp Collected";
                            btnCollect.classList.add('opacity-50', 'cursor-not-allowed');
                            btnCollect.disabled = true;
                        } else {
                            btnCollect.innerHTML = "🏆 Collect Stamp";
                            btnCollect.classList.remove('opacity-50', 'cursor-not-allowed');
                            btnCollect.disabled = false;
                            
                            btnCollect.onclick = () => {
                                collectStamp(site.id, marker, btnCollect);
                            };
                        }
                    }
                    siteModal.classList.remove('hidden');
                });
            });
        })
        .catch(err => {
            console.error("Error loading Map Data:", err);
            alert("Fatal Error: Could not load heritage site data. Please check your internet connection and refresh the page.");
        });

    function collectStamp(siteId, marker, btn) {
        if (!visitedSites.includes(siteId)) {
            // (Audio removed as requested)
            
            visitedSites.push(siteId);
            localStorage.setItem('jejak_visited', JSON.stringify(visitedSites));
            
            marker._icon.classList.add('marker-visited');
            btn.innerHTML = "✅ Stamp Collected";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.disabled = true;

            updateGameProgress();

            const numberedSitesVisited = visitedSites.filter(id => !isNaN(id)).length;
            if (numberedSitesVisited >= TOTAL_SITES) {
                setTimeout(() => {
                    siteModal.classList.add('hidden');
                    rewardModal.classList.remove('hidden');
                }, 1000);
            }
        }
    }

    function updateGameProgress() {
        const progressBar = document.getElementById('progressBar');
        const progress
