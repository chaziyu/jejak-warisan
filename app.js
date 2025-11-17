// --- CONFIGURATION ---
const HISTORY_WINDOW_SIZE = 10; // Send only the last 10 messages to the AI

// --- GAME STATE ---
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
let discoveredSites = JSON.parse(localStorage.getItem('jejak_discovered')) || [];
const TOTAL_SITES = 13; 
let allSiteData = []; 
let chatHistory = [];

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

    initApp();
    updateGameProgress(); 

    const btnChat = document.getElementById('btnChat');
    const chatModal = document.getElementById('chatModal');
    const closeChatModal = document.getElementById('closeChatModal');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');

    if (btnChat) btnChat.addEventListener('click', () => chatModal.classList.remove('hidden'));
    if (closeChatModal) closeChatModal.addEventListener('click', () => chatModal.classList.add('hidden'));

    async function handleChatSend(query, isSilent = false) {
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
                body: JSON.stringify({
                    userQuery: userQuery,
                    history: recentHistory
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

    function addChatMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('flex');
        let innerHtml = '';
        if (sender === 'user') {
            innerHtml = `<div class="bg-blue-600 text-white p-3 rounded-lg ml-auto max-w-xs"><p>${message}</p></div>`;
            messageDiv.classList.add('justify-end');
        } else {
            innerHtml = `<div class="bg-gray-200 text-gray-800 p-3 rounded-lg max-w-xs"><p>${message}</p></div>`;
        }
        messageDiv.innerHTML = innerHtml;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        chatHistory.push({
            role: (sender === 'user' ? 'user' : 'model'),
            parts: [{ text: message }]
        });
    }

    if (chatSendBtn) chatSendBtn.addEventListener('click', () => handleChatSend());
    if (chatInput) chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSend();
    });

    const btnPassport = document.getElementById('btnPassport');
    const passportModal = document.getElementById('passportModal');
    const closePassportModal = document.getElementById('closePassportModal');
    const passportGrid = document.getElementById('passportGrid');
    const passportCount = document.getElementById('passportCount');

    async function updatePassport() {
        if (!passportGrid || !passportCount) return;
        passportGrid.innerHTML = 'Loading stamps...'; 
        let collectedCount = 0;

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

        mainSites.forEach(site => {
            const stampEl = document.createElement('div');
            stampEl.classList.add('relative', 'w-full', 'aspect-square', 'border', 'rounded-lg', 'shadow-sm', 'transition-all', 'overflow-hidden');
            const isCollected = visitedSites.includes(site.id);
            
            if (isCollected) {
                stampEl.classList.add('bg-green-100', 'border-green-300');
                stampEl.innerHTML = `
                    <img src="${site.image}" alt="${site.name}" class="w-full h-full object-cover">
                    <div class="absolute bottom-0 left-0 w-full bg-black/50 text-white p-1 text-center"><p class="text-xs font-bold">${site.id}. ${site.name}</p></div>
                    <div class="absolute top-1 right-1 text-2xl">✅</div>`;
                collectedCount++;
            } else {
                stampEl.classList.add('bg-gray-100', 'border-gray-200');
                stampEl.innerHTML = `
                    <img src="${site.image}" alt="${site.name}" class="w-full h-full object-cover filter grayscale opacity-60">
                    <div class="absolute bottom-0 left-0 w-full bg-black/50 text-white p-1 text-center"><p class="text-xs font-bold opacity-70">${site.id}. ???</p></div>`;
            }
            passportGrid.appendChild(stampEl);
        });
        passportCount.textContent = collectedCount;
    }

    if (btnPassport) {
        btnPassport.addEventListener('click', () => {
            updatePassport(); 
            passportModal.classList.remove('hidden');
        });
    }
    if (closePassportModal) closePassportModal.addEventListener('click', () => passportModal.classList.add('hidden'));

    const quizModal = document.getElementById('quizModal');
    const closeQuizModal = document.getElementById('closeQuizModal');
    const quizTitle = document.getElementById('quizTitle');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizInput = document.getElementById('quizInput');
    const quizSubmitBtn = document.getElementById('quizSubmitBtn');
    const quizError = document.getElementById('quizError');

    function openQuizModal(site, marker, btnCollect) {
        siteModal.classList.add('hidden'); 
        quizTitle.textContent = `Quiz for: ${site.name}`;
        quizQuestion.textContent = site.quiz.q;
        quizInput.value = '';
        quizError.classList.add('hidden'); 
        quizModal.classList.remove('hidden');
        quizSubmitBtn.onclick = () => checkQuizAnswer(site, marker, btnCollect);
    }
    
    if (closeQuizModal) closeQuizModal.addEventListener('click', () => quizModal.classList.add('hidden'));

    function checkQuizAnswer(site, marker, btnCollect) {
        const userAnswer = quizInput.value.trim();
        const correctAnswer = site.quiz.a;

        if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
            quizModal.classList.add('hidden');
            collectStamp(site.id, marker, btnCollect, site.name);
        } else {
            quizError.textContent = "Not quite! Try reading the info again.";
            quizError.classList.remove('hidden');
        }
    }

    const map = L.map('map').setView([3.1483, 101.6938], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

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
            allSiteData = sites;
            sites.forEach(site => {
                const [lat, lng] = [parseFloat(site.coordinates[0]), parseFloat(site.coordinates[1])];
                const marker = L.marker([lat, lng]).addTo(map);
                if (visitedSites.includes(site.id)) marker._icon.classList.add('marker-visited');

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

                    const btnAskAI = document.getElementById('btnAskAI');
                    btnAskAI.onclick = (e) => {
                        e.preventDefault();
                        siteModal.classList.add('hidden');
                        chatModal.classList.remove('hidden');
                        chatInput.value = `Tell me more about the ${site.name}.`;
                    };

                    const isNumberedSite = !isNaN(site.id);
                    btnCollect.style.display = 'flex'; 

                    if (isNumberedSite) {
                        if (visitedSites.includes(site.id)) {
                            btnCollect.innerHTML = "✅ Stamp Collected";
                            btnCollect.className = 'flex-1 bg-yellow-400 text-yellow-900 font-bold py-3 rounded-lg shadow-sm transition flex justify-center items-center gap-2 opacity-50 cursor-not-allowed';
                            btnCollect.disabled = true;
                        } else {
                            btnCollect.innerHTML = "🏆 Earn Stamp (Quiz!)";
                            btnCollect.className = 'flex-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-3 rounded-lg shadow-sm transition flex justify-center items-center gap-2';
                            btnCollect.disabled = false;
                            btnCollect.onclick = () => openQuizModal(site, marker, btnCollect);
                        }
                    } else {
                        if (discoveredSites.includes(site.id)) {
                            btnCollect.innerHTML = "✅ Discovered!";
                            btnCollect.className = 'flex-1 bg-yellow-400 text-yellow-900 font-bold py-3 rounded-lg shadow-sm transition flex justify-center items-center gap-2 opacity-50 cursor-not-allowed';
                            btnCollect.disabled = true;
                        } else {
                            btnCollect.innerHTML = "💡 Discover this Point";
                            btnCollect.className = 'flex-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-3 rounded-lg shadow-sm transition flex justify-center items-center gap-2';
                            btnCollect.disabled = false;
                            btnCollect.onclick = () => {
                                discoveredSites.push(site.id);
                                localStorage.setItem('jejak_discovered', JSON.stringify(discoveredSites));
                                btnCollect.innerHTML = "✅ Discovered!";
                                btnCollect.classList.add('opacity-50', 'cursor-not-allowed');
                                btnCollect.disabled = true;
                            };
                        }
                    }
                    siteModal.classList.remove('hidden');
                });
            });
        })
        .catch(err => console.error("Error loading Map Data:", err));

    function collectStamp(siteId, marker, btn, siteName) {
        if (!visitedSites.includes(siteId)) {
            visitedSites.push(siteId);
            localStorage.setItem('jejak_visited', JSON.stringify(visitedSites));
            marker._icon.classList.add('marker-visited');
            btn.innerHTML = "✅ Stamp Collected";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.disabled = true;
            updateGameProgress();
            handleChatSend(`I have just collected the stamp for ${siteName}.`, true);
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
        const progressText = document.getElementById('progressText');
        if(!progressBar || !progressText) return;
        const count = visitedSites.filter(id => !isNaN(id)).length;
        const percent = (count / TOTAL_SITES) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${count}/${TOTAL_SITES} Sites`;
    }
    
    if(btnRecenter) btnRecenter.addEventListener('click', () => map.setView([3.1483, 101.6938], 16));

    if(btnShare) {
        btnShare.addEventListener('click', () => {
            const text = "I just became an Official Explorer by visiting all 13 Heritage Sites in Kuala Lumpur! 🇲Y✨ Try the Jejak Warisan challenge here: #ThisKulCity #BadanWarisanMalaysia";
            const url = "https://jejak-warisan.vercel.app";
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
            window.open(whatsappUrl, '_blank');
        });
    }

    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });

    if(closeModal) closeModal.addEventListener('
