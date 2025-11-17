// --- CONFIGURATION ---
const HISTORY_WINDOW_SIZE = 10; // Send only the last 10 messages to the AI

// --- GAME STATE ---
let map = null; // IMPORTANT: Map is not initialized yet.
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
let discoveredSites = JSON.parse(localStorage.getItem('jejak_discovered')) || [];
const TOTAL_SITES = 13; 
let allSiteData = []; 
let chatHistory = [];


// --- 1. CORE MAP INITIALIZATION ---
// This entire block of code will now only run AFTER the user logs in.
function initializeMap() {
    if (map) return; // Don't initialize more than once

    map = L.map('map').setView([3.1483, 101.6938], 16);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    const siteModal = document.getElementById('siteModal');
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

    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });
}

// --- 2. APP STARTUP & UI LOGIC ---

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
            initializeMap(); // <<--- INITIALIZE MAP HERE
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
        // ... (This function is correct and unchanged)
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
                    initializeMap(); // <<--- OR INITIALIZE MAP HERE
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
            console.error("Fetch error:", err);
            errorMsg.textContent = "Connection error. Please try again.";
            errorMsg.classList.remove('hidden');
            btn.textContent = "Verify & Unlock";
            btn.disabled = false;
        }
    }

    // --- 3. IN-GAME UI HANDLERS ---
    
    const btnChat = document.getElementById('btnChat');
    const chatModal = document.getElementById('chatModal');
    const closeChatModal = document.getElementById('closeChatModal');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');

    if (btnChat) btnChat.addEventListener('click', () => chatModal.classList.remove('hidden'));
    if (closeChatModal) closeChatModal.addEventListener('click', () => chatModal.classList.add('hidden'));

    async function handleChatSend(query, isSilent = false) {
        // ... (This function is correct and unchanged)
    }
    function addChatMessage(message, sender) {
        // ... (This function is correct and unchanged)
    }

    if (chatSendBtn) chatSendBtn.addEventListener('click', () => handleChatSend());
    if (chatInput) chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSend();
    });

    const btnPassport = document.getElementById('btnPassport');
    const passportModal = document.getElementById('passportModal');
    const closePassportModal = document.getElementById('closePassportModal');

    async function updatePassport() {
        // ... (This function is correct and unchanged)
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

    function openQuizModal(site, marker, btnCollect) {
        // ... (This function is correct and unchanged)
    }
    if (closeQuizModal) closeQuizModal.addEventListener('click', () => quizModal.classList.add('hidden'));
    function checkQuizAnswer(site, marker, btnCollect) {
        // ... (This function is correct and unchanged)
    }

    function collectStamp(siteId, marker, btn, siteName) {
        // ... (This function is correct and unchanged)
    }
    function updateGameProgress() {
        // ... (This function is correct and unchanged)
    }

    const btnRecenter = document.getElementById('btnRecenter');
    if(btnRecenter) btnRecenter.addEventListener('click', () => {
        if(map) map.setView([3.1483, 101.6938], 16);
    });

    const btnShare = document.getElementById('btnShare');
    if(btnShare) {
        btnShare.addEventListener('click', () => {
            const text = "I just became an Official Explorer by visiting all 13 Heritage Sites in Kuala Lumpur! 🇲Y✨ Try the Jejak Warisan challenge here: #ThisKulCity #BadanWarisanMalaysia";
            const url = "https://jejak-warisan.vercel.app";
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
            window.open(whatsappUrl, '_blank');
        });
    }

    const closeModal = document.getElementById('closeModal');
    const closeReward = document.getElementById('closeReward');
    if(closeModal) closeModal.addEventListener('click', () => document.getElementById('siteModal').classList.add('hidden'));
    if(closeReward) closeReward.addEventListener('click', () => document.getElementById('rewardModal').classList.add('hidden'));

    // --- START THE APP ---
    initApp(); 
});
