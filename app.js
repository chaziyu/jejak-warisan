// --- CONFIGURATION ---
const HISTORY_WINDOW_SIZE = 10; // Send only the last 10 messages to the AI

// --- GAME STATE ---
let map = null; // IMPORTANT: Map is not initialized until after login.
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
let discoveredSites = JSON.parse(localStorage.getItem('jejak_discovered')) || [];
const TOTAL_SITES = 13; 
let allSiteData = []; 
let chatHistory = [];

// --- CORE GAME & MAP INITIALIZATION ---
// This function will now be called ONLY after the user gets past the landing page.
function initializeGameAndMap() {
    if (map) return; // Prevent re-initializing

    // 1. Initialize Map
    map = L.map('map').setView([3.1483, 101.6938], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // 2. Setup User Location
    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });

    // 3. Get all UI elements needed for the game
    const siteModal = document.getElementById('siteModal');
    const elements = {
        title: document.getElementById('modalTitle'),
        built: document.getElementById('modalBuilt'),
        architects: document.getElementById('modalArchitects'),
        info: document.getElementById('modalInfo'),
        img: document.getElementById('modalImage'),             
        imgContainer: document.getElementById('modalImageContainer') 
    };

    // 4. Fetch site data and create map markers
    fetch('data.json')
        .then(res => res.json())
        .then(sites => {
            allSiteData = sites; // Store data globally
            sites.forEach(site => {
                const [lat, lng] = [parseFloat(site.coordinates[0]), parseFloat(site.coordinates[1])];
                const marker = L.marker([lat, lng]).addTo(map);
                if (visitedSites.includes(site.id) || discoveredSites.includes(site.id)) {
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
                    
                    document.getElementById('btnDirections').href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;

                    const btnAskAI = document.getElementById('btnAskAI');
                    btnAskAI.onclick = (e) => {
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
                            };
                        }
                    }
                    if (btnCollect.disabled) {
                        btnCollect.classList.add('opacity-50', 'cursor-not-allowed');
                    } else {
                        btnCollect.classList.remove('opacity-50', 'cursor-not-allowed');
                    }

                    siteModal.classList.remove('hidden');
                });
            });
        })
        .catch(err => console.error("Error loading Map Data:", err));
}

// --- APP STARTUP & UI LOGIC ---

document.addEventListener('DOMContentLoaded', () => {

    function initApp() {
        const landingPage = document.getElementById('landing-page');
        const gatekeeper = document.getElementById('gatekeeper');
        const sessionData = JSON.parse(localStorage.getItem('jejak_session'));
        const SESSION_DURATION = 24 * 60 * 60 * 1000; 
    
        if (sessionData && sessionData.valid && (Date.now() - sessionData.start < SESSION_DURATION)) {
            if(landingPage) landingPage.remove();
            if(gatekeeper) gatekeeper.remove();
            document.getElementById('game-ui').classList.remove('hidden');
            initializeGameAndMap();
            updateGameProgress();
        } else {
            localStorage.removeItem('jejak_session');
            setupLandingPage();
        }
    }
    
    function setupLandingPage() {
        const btnVisitor = document.getElementById('btnVisitor');
        const btnStaff = document.getElementById('btnStaff');
        const landingPage = document.getElementById('landing-page');
        const gatekeeper = document.getElementById('gatekeeper');
        const backToHome = document.getElementById('backToHome');
        const closeStaffScreen = document.getElementById('closeStaffScreen');
        const staffScreen = document.getElementById('staff-screen');
    
        if(btnVisitor) btnVisitor.addEventListener('click', () => {
            landingPage.classList.add('hidden');
            gatekeeper.classList.remove('hidden');
        });
    
        if(btnStaff) btnStaff.addEventListener('click', () => {
            landingPage.classList.add('hidden');
            showAdminCode(); 
        });
    
        if(backToHome) backToHome.addEventListener('click', () => {
            gatekeeper.classList.add('hidden');
            landingPage.classList.remove('hidden');
        });
    
        if(closeStaffScreen) closeStaffScreen.addEventListener('click', () => {
            staffScreen.classList.add('hidden');
            landingPage.classList.remove('hidden');
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
        passkeyDisplay.textContent = "AUTHENTICATING...";
        passkeyDisplay.classList.add('animate-pulse');
        try {
            const tokenResponse = await fetch('/api/get-admin-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass })
            });
            const tokenData = await tokenResponse.json();
            if (!tokenResponse.ok) throw new Error(tokenData.error || 'Authentication failed');
            const { token } = tokenData;
            passkeyDisplay.textContent = "FETCHING CODE...";
            const passkeyResponse = await fetch('/api/fetch-todays-code', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
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
            setTimeout(() => {
                staffScreen.classList.add('hidden');
                document.getElementById('landing-page').classList.remove('hidden');
            }, 3000);
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
            errorMsg.textContent = "Connection error. Please try again.";
            errorMsg.classList.remove('hidden');
            btn.textContent = "Verify & Unlock";
            btn.disabled = false;
        }
    }

    const btnChat = document.getElementById('btnChat');
    const chatModal = document.getElementById('chatModal');
    const closeChatModal = document.getElementById('closeChatModal');
    if (btnChat) btnChat.addEventListener('click', () => chatModal.classList.remove('hidden'));
    if (closeChatModal) closeChatModal.addEventListener('click', () => chatModal.classList.add('hidden'));

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

    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatInput = document.getElementById('chatInput');
    if (chatSendBtn) chatSendBtn.addEventListener('click', () => handleChatSend());
    if (chatInput) chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSend();
    });

    const btnPassport = document.getElementById('btnPassport');
    const passportModal = document.getElementById('passportModal');
    const closePassportModal = document.getElementById('closePassportModal');
    if (btnPassport) btnPassport.addEventListener('click', () => {
        updatePassport(); 
        passportModal.classList.remove('hidden');
    });
    if (closePassportModal) closePassportModal.addEventListener('click', () => passportModal.classList.add('hidden'));

    async function updatePassport() {
        const passportGrid = document.getElementById('passportGrid');
        const passportCount = document.getElementById('passportCount');
        if (!passportGrid || !passportCount) return;
        if (allSiteData.length === 0) {
            try {
                const response = await fetch('data.json');
                allSiteData = await response.json();
            } catch (e) {
                passportGrid.innerHTML = 'Error loading stamps.';
                return;
            }
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

    const quizModal = document.getElementById('quizModal');
    const closeQuizModal = document.getElementById('closeQuizModal');
    if (closeQuizModal) closeQuizModal.addEventListener('click', () => quizModal.classList.add('hidden'));

    function openQuizModal(site, marker, btnCollect) {
        document.getElementById('siteModal').classList.add('hidden');
        document.getElementById('quizTitle').textContent = `Quiz for: ${site.name}`;
        document.getElementById('quizQuestion').textContent = site.quiz.q;
        const quizInput = document.getElementById('quizInput');
        quizInput.value = '';
        document.getElementById('quizError').classList.add('hidden');
        quizModal.classList.remove('hidden');
        document.getElementById('quizSubmitBtn').onclick = () => checkQuizAnswer(site, marker, btnCollect, quizInput);
    }

    function checkQuizAnswer(site, marker, btnCollect, quizInput) {
        if (quizInput.value.trim().toLowerCase() === site.quiz.a.toLowerCase()) {
            quizModal.classList.add('hidden');
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

    function updateGameProgress() {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        if(!progressBar || !progressText) return;
        const count = visitedSites.filter(id => !isNaN(id)).length;
        progressBar.style.width = `${(count / TOTAL_SITES) * 100}%`;
        progressText.textContent = `${count}/${TOTAL_SITES} Sites`;
    }

    const btnRecenter = document.getElementById('btnRecenter');
    if(btnRecenter) btnRecenter.addEventListener('click', () => {
        if(map) map.setView([3.1483, 101.6938], 16);
    });

    const btnShare = document.getElementById('btnShare');
    if(btnShare) btnShare.addEventListener('click', () => {
        const text = "I just became an Official Explorer by visiting all 13 Heritage Sites in Kuala Lumpur! 🇲Y✨ Try the Jejak Warisan challenge here: #ThisKulCity #BadanWarisanMalaysia";
        window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + window.location.href)}`, '_blank');
    });

    const closeModal = document.getElementById('closeModal');
    const closeReward = document.getElementById('closeReward');
    if(closeModal) closeModal.addEventListener('click', () => document.getElementById('siteModal').classList.add('hidden'));
    if(closeReward) closeReward.addEventListener('click', () => document.getElementById('rewardModal').classList.add('hidden'));

    // --- START THE APP ---
    initApp();
});
