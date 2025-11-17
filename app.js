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

// --- DOM Elements ---
let siteModal, siteModalImage, siteModalTitle, siteModalInfo, siteModalQuizQ, siteModalQuizInput, siteModalQuizBtn, siteModalQuizResult, closeSiteModal, siteModalAskAI;
let chatModal, closeChatModal, chatHistoryEl, chatInput, chatSendBtn, chatLimitText;
let passportModal, closePassportModal, passportInfo, passportGrid;

// --- CORE GAME & MAP INITIALIZATION ---
function initializeGameAndMap() {
    if (map) return;
    map = L.map('map').setView([3.1483, 101.6938], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 20
    }).addTo(map);

    setTimeout(() => { map.invalidateSize(); }, 100);

    const heritageZoneCoords = [[3.148934,101.694228],[3.148012,101.694051],[3.147936,101.694399],[3.147164,101.694292],[3.147067,101.695104],[3.146902,101.695994],[3.146215,101.695884],[3.146004,101.69586],[3.145961,101.695897],[3.145896,101.69616],[3.145642,101.696179],[3.145672,101.696616],[3.145883,101.696592],[3.145982,101.696922],[3.146416,101.69667],[3.146694,101.696546],[3.146828,101.696584],[3.146903,101.69689],[3.147075,101.697169],[3.147541,101.697517],[3.147889,101.697807],[3.147969,101.697872],[3.148366,101.697491],[3.149041,101.696868],[3.14933,101.696632],[3.149549,101.696718],[3.150106,101.697303],[3.15038,101.697576],[3.150439,101.697668],[3.150733,101.697576],[3.151065,101.697694],[3.151467,101.697791],[3.15181,101.698011],[3.152051,101.698306],[3.152158,101.698413],[3.152485,101.698435],[3.152586,101.698413],[3.151802,101.697252],[3.151796,101.697171],[3.152102,101.696968],[3.151684,101.696683],[3.151914,101.69627],[3.151298,101.695889],[3.151581,101.695549],[3.150951,101.695173],[3.150238,101.694712],[3.149922,101.69451],[3.148934,101.694228]];
    L.polygon(heritageZoneCoords, { color: '#666', fillColor: '#333', fillOpacity: 0.1, weight: 2, dashArray: '5, 5', interactive: false }).addTo(map);

    fetch('data.json').then(res => res.json()).then(sites => {
        allSiteData = sites;
        sites.forEach(site => {
            const marker = L.marker(site.coordinates).addTo(map);
            if (visitedSites.includes(site.id) || discoveredSites.includes(site.id)) {
                marker._icon.classList.add('marker-visited');
            }
            marker.on('click', () => handleMarkerClick(site, marker));
        });
        // Call progress and passport updates *after* data is loaded
        updateGameProgress();
        updatePassport(); 
    }).catch(err => console.error("Error loading Map Data:", err));

    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });
}

// --- GAME LOGIC FUNCTIONS ---

function handleMarkerClick(site, marker) {
    if (!siteModal) return; 

    siteModalTitle.textContent = site.name;
    siteModalInfo.textContent = site.info;
    siteModalImage.src = site.image || 'https://placehold.co/600x400/eee/ccc?text=Site+Image';
    
    // Hide 'Ask AI' button if it's not a main site (like Dataran Merdeka)
    if (site.id >= 1 && site.id <= 13) {
         siteModalQuizQ.parentElement.style.display = 'block';
         siteModalAskAI.style.display = 'block';
    } else {
        // Hide quiz and Ask AI button for non-quiz sites
         siteModalQuizQ.parentElement.style.display = 'none';
         siteModalAskAI.style.display = 'none';
    }

    siteModalQuizQ.textContent = site.quiz.q;
    siteModalQuizInput.value = "";
    siteModalQuizResult.classList.add('hidden');
    
    const newQuizBtn = siteModalQuizBtn.cloneNode(true);
    siteModalQuizBtn.parentNode.replaceChild(newQuizBtn, siteModalQuizBtn);
    siteModalQuizBtn = newQuizBtn; 
    
    siteModalQuizBtn.addEventListener('click', () => {
        const userAnswer = siteModalQuizInput.value.trim().toLowerCase();
        const correctAnswer = site.quiz.a.trim().toLowerCase();
        
        if (userAnswer === correctAnswer) {
            siteModalQuizResult.textContent = "Correct! Well done!";
            siteModalQuizResult.className = "text-sm mt-2 text-center font-bold text-green-600";
            
            if (!visitedSites.includes(site.id)) {
                visitedSites.push(site.id);
                localStorage.setItem('jejak_visited', JSON.stringify(visitedSites));
                marker._icon.classList.add('marker-visited');
                updateGameProgress();
            }
        } else {
            siteModalQuizResult.textContent = "Not quite, try again!";
            siteModalQuizResult.className = "text-sm mt-2 text-center font-bold text-red-600";
        }
        siteModalQuizResult.classList.remove('hidden');
    });

    siteModal.classList.remove('hidden');
}

async function handleSendMessage() {
    const userQuery = chatInput.value.trim();
    if (!userQuery || userMessageCount >= MAX_MESSAGES_PER_SESSION) return;

    chatInput.value = "";
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    addChatMessage('user', userQuery);
    const thinkingEl = addChatMessage('ai', '...');
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userQuery: userQuery,
                history: chatHistory.slice(-HISTORY_WINDOW_SIZE) 
            })
        });

        if (!response.ok) {
            throw new Error('AI server error');
        }

        const data = await response.json();
        
        chatHistory.push({ role: 'user', parts: [{ text: userQuery }] });
        chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
        
        userMessageCount++;
        localStorage.setItem('jejak_message_count', userMessageCount.toString());
        updateChatUIWithCount();
        
        thinkingEl.querySelector('p').innerHTML = data.reply; 

    } catch (error) {
        console.error("Chat error:", error);
        thinkingEl.querySelector('p').textContent = "Sorry, I couldn't connect. Please try again.";
        thinkingEl.classList.add('bg-red-100', 'text-red-900');
    }

    if (userMessageCount < MAX_MESSAGES_PER_SESSION) {
        chatInput.disabled = false;
        chatSendBtn.disabled = false;
        chatInput.focus();
    }
}

function addChatMessage(role, text) {
    const messageEl = document.createElement('div');
    const name = (role === 'user') ? 'You' : 'AI Guide';
    const align = (role === 'user') ? 'self-end' : 'self-start';
    const bg = (role === 'user') ? 'bg-white' : 'bg-blue-100';
    const textCol = (role === 'user') ? 'text-gray-900' : 'text-blue-900';
    
    messageEl.className = `p-3 rounded-lg ${bg} ${textCol} max-w-xs shadow-sm ${align}`;
    messageEl.innerHTML = `<p class="font-bold text-sm">${name}</p><p>${text}</p>`;
    
    chatHistoryEl.appendChild(messageEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight; 
    return messageEl;
}

// --- UI UPDATE FUNCTIONS ---

function updateGameProgress() {
    const visitedCount = visitedSites.length;
    const mainSitesTotal = allSiteData.filter(site => !isNaN(parseInt(site.id))).length || TOTAL_SITES;
    
    const percent = (visitedCount / mainSitesTotal) * 100;
    document.getElementById('progressBar').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = `${visitedCount}/${mainSitesTotal} Sites`;
}

function updateChatUIWithCount() {
    if (!chatLimitText) return; // Don't run if chat UI not set up
    const remaining = MAX_MESSAGES_PER_SESSION - userMessageCount;
    chatLimitText.textContent = `You have ${remaining} messages remaining.`;

    if (remaining <= 0) {
        disableChatUI(true);
    }
}

function disableChatUI(flag) {
    if (!chatInput || !chatSendBtn) return;
    chatInput.disabled = flag;
    chatSendBtn.disabled = flag;
    if (flag) {
        chatLimitText.textContent = "You have used all your messages for this session.";
        chatInput.placeholder = "No messages remaining.";
    }
}

/**
 * [REWRITTEN] Updates the passport with the new photo grid.
 */
function updatePassport() {
    if (!passportInfo || !passportGrid || allSiteData.length === 0) {
        console.log("Passport elements not ready, or data not loaded.");
        return;
    }

    const mainSites = allSiteData.filter(site => !isNaN(parseInt(site.id)));
    const visitedCount = visitedSites.length;
    
    passportInfo.textContent = `You have collected ${visitedCount} of the ${mainSites.length} stamps.`;
    passportGrid.innerHTML = ""; // Clear old grid

    mainSites.forEach(site => {
        const stamp = document.createElement('div');
        stamp.className = 'passport-stamp';
        
        const isVisited = visitedSites.includes(site.id);
        if (!isVisited) {
            stamp.classList.add('grayscale'); // Add grayscale class if not visited
        }

        const img = document.createElement('img');
        img.src = site.image || 'https://placehold.co/100x100/eee/ccc?text=?';
        img.alt = site.name;

        const name = document.createElement('p');
        name.textContent = site.name;

        stamp.appendChild(img);
        stamp.appendChild(name);
        passportGrid.appendChild(stamp);
    });
}


// --- APP STARTUP & LANDING PAGE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    
    function initApp() {
        const landingPage = document.getElementById('landing-page');
        const gatekeeper = document.getElementById('gatekeeper');
        const sessionData = JSON.parse(localStorage.getItem('jejak_session'));
        
        if (sessionData && sessionData.valid && (Date.now() - sessionData.start < SESSION_DURATION)) {
            // Session is VALID: Go straight to map
            if (landingPage) landingPage.remove();
            if (gatekeeper) gatekeeper.remove();
            document.getElementById('progress-container').classList.remove('hidden');
            
            initializeGameAndMap();
            setupGameUIListeners(); 
            // Note: updateGameProgress() and updatePassport() are called inside initializeGameAndMap
            // after the 'data.json' fetch is successful.
            
            if (userMessageCount >= MAX_MESSAGES_PER_SESSION) {
                disableChatUI(true);
            } else {
                updateChatUIWithCount();
            }
        } else {
            // Session is INVALID or EXPIRED: Show landing page
            localStorage.removeItem('jejak_message_count');
            userMessageCount = 0;
            localStorage.removeItem('jejak_session');
            setupLandingPage();
        }
    }

    function setupLandingPage() {
        document.getElementById('btnVisitor').addEventListener('click', () => {
            document.getElementById('landing-page').classList.add('hidden');
            document.getElementById('gatekeeper').classList.remove('hidden');
        });
        
        document.getElementById('btnStaff').addEventListener('click', () => {
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
        setupAdminLoginLogic(); 
    }

    // --- LOGIN & MODAL FUNCTIONS ---

    function showAdminCode() {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('staff-screen').classList.remove('hidden');
    }

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
                    document.getElementById('adminLoginForm').classList.add('hidden');
                    document.getElementById('passkeyDate').textContent = `Date: ${data.date}`;
                    document.getElementById('passkeyResult').textContent = data.passkey;
                    document.getElementById('adminResult').classList.remove('hidden');
                } else {
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

    function setupGatekeeperLogic() {
        const unlockBtn = document.getElementById('unlockBtn');
        const passcodeInput = document.getElementById('passcodeInput');

        unlockBtn.addEventListener('click', async () => {
            const enteredCode = passcodeInput.value;
            if (!enteredCode) return;
            
            unlockBtn.disabled = true;
            unlockBtn.textContent = 'Verifying...';
            
            await verifyCode(enteredCode);
            
            if (!localStorage.getItem('jejak_session')) {
                 unlockBtn.disabled = false;
                 unlockBtn.textContent = 'Verify & Unlock';
            }
        });
    }

    async function verifyCode(enteredCode) {
        const errorMsg = document.getElementById('errorMsg');
        errorMsg.classList.add('hidden');

        try {
            const response = await fetch('/api/check-passkey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passkey: enteredCode })
            });

            if (response.ok) {
                localStorage.setItem('jejak_session', JSON.stringify({
                    valid: true,
                    start: Date.now()
                }));

                document.getElementById('gatekeeper').style.opacity = 0;
                document.getElementById('landing-page').style.opacity = 0;

                setTimeout(() => {
                    document.getElementById('gatekeeper').remove();
                    document.getElementById('landing-page').remove();
                    document.getElementById('progress-container').classList.remove('hidden');
                    
                    initializeGameAndMap();
                    setupGameUIListeners();
                }, 500);

            } else {
                const data = await response.json();
                console.error('Passkey error:', data.error);
                errorMsg.textContent = data.error || 'Invalid or expired passkey.';
                errorMsg.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error during passkey verification:', error);
            errorMsg.textContent = 'Network error. Please try again.';
            errorMsg.classList.remove('hidden');
        }
    }
    
    /**
     * [UPDATED]
     * Finds all DOM elements and attaches all in-game listeners.
     */
    function setupGameUIListeners() {
        // --- Find all elements first ---
        siteModal = document.getElementById('siteModal');
        siteModalImage = document.getElementById('siteModalImage');
        siteModalTitle = document.getElementById('siteModalTitle');
        siteModalInfo = document.getElementById('siteModalInfo');
        siteModalQuizQ = document.getElementById('siteModalQuizQ');
        siteModalQuizInput = document.getElementById('siteModalQuizInput');
        siteModalQuizBtn = document.getElementById('siteModalQuizBtn');
        siteModalQuizResult = document.getElementById('siteModalQuizResult');
        closeSiteModal = document.getElementById('closeSiteModal');
        siteModalAskAI = document.getElementById('siteModalAskAI'); // New
        
        chatModal = document.getElementById('chatModal');
        closeChatModal = document.getElementById('closeChatModal');
        chatHistoryEl = document.getElementById('chatHistory');
        chatInput = document.getElementById('chatInput');
        chatSendBtn = document.getElementById('chatSendBtn');
        chatLimitText = document.getElementById('chatLimitText');

        passportModal = document.getElementById('passportModal');
        closePassportModal = document.getElementById('closePassportModal');
        passportInfo = document.getElementById('passportInfo');
        passportGrid = document.getElementById('passportGrid'); // New
        
        // --- Attach Listeners ---

        document.getElementById('btnRecenter').addEventListener('click', () => {
            if (map) {
                map.setView([3.1483, 101.6938], 16);
            }
        });

        document.getElementById('btnChat').addEventListener('click', () => {
            chatModal.classList.remove('hidden');
        });
        closeChatModal.addEventListener('click', () => {
            chatModal.classList.add('hidden');
        });
        
        document.getElementById('btnPassport').addEventListener('click', () => {
            updatePassport(); // Update content *before* showing
            passportModal.classList.remove('hidden');
        });
        closePassportModal.addEventListener('click', () => {
            passportModal.classList.add('hidden');
        });

        closeSiteModal.addEventListener('click', () => {
            siteModal.classList.add('hidden');
        });

        chatSendBtn.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });

        // --- NEW LISTENER FOR "ASK AI" BUTTON ---
        siteModalAskAI.addEventListener('click', () => {
            const siteName = siteModalTitle.textContent;
            if (!siteName || siteName === "Site Title") return;
            
            // Create a question
            const question = `Tell me more about ${siteName}.`;
            
            // Close site modal, open chat modal
            siteModal.classList.add('hidden');
            chatModal.classList.remove('hidden');
            
            // Send the question directly
            chatInput.value = question; // Pre-fill
            handleSendMessage(); // Send it
        });
    }

    // --- Run the app ---
    initApp();
});
