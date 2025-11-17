// --- CONFIGURATION ---
// (No Proximity or Audio)

// --- GAME STATE ---
let visitedSites = JSON.parse(localStorage.getItem('jejak_visited')) || [];
let discoveredSites = JSON.parse(localStorage.getItem('jejak_discovered')) || [];
const TOTAL_SITES = 13; 
let allSiteData = []; // --- NEW: Stores all site data after fetching

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

    // --- Button Bug Fix: Call these first! ---
    initApp();
    updateGameProgress(); 
    // --- End Button Bug Fix ---


    // --- START: CHATBOT LOGIC (Updated for Idea 3) ---
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

    // --- NEW: handleChatSend is modified for "silent" messages ---
    async function handleChatSend(query, isSilent = false) {
        // If the query is passed in, use it. Otherwise, get it from the input.
        const userQuery = query || chatInput.value.trim();
        if (!userQuery) return;

        // Only add the user's message to chat if it's NOT silent
        if (!isSilent) {
            addChatMessage(userQuery, 'user');
        }
        
        chatInput.value = '';
        chatSendBtn.disabled = true;
        chatSendBtn.textContent = '...';

        try {
            const response = await fetch('/api/chat', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userQuery: userQuery // Use the query from the variable
                })
            });

            const data = await response.json();
            
            // We always add the bot's response
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

    if (chatSendBtn) chatSendBtn.addEventListener('click', () => handleChatSend()); // Updated to call with no args
    if (chatInput) chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatSend(); // Updated to call with no args
    });
    // --- END: CHATBOT LOGIC ---

    // --- PASSPORT LOGIC (Updated for Idea 1) ---
    const btnPassport = document.getElementById('btnPassport');
    const passportModal = document.getElementById('passportModal');
    const closePassportModal = document.getElementById('closePassportModal');
    const passportGrid = document.getElementById('passportGrid');
    const passportCount = document.getElementById('passportCount');

    // --- NEW: This function is now async to fetch data ---
    async function updatePassport() {
        if (!passportGrid || !passportCount) return;

        passportGrid.innerHTML = 'Loading stamps...'; // Clear the grid
        let collectedCount = 0;

        // If allSiteData is empty, fetch it. Otherwise, use the cached version.
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
        passportGrid.innerHTML = ''; // Clear "Loading"

        mainSites.forEach(site => {
            const stampEl = document.createElement('div');
            stampEl.classList.add('relative', 'w-full', 'aspect-square', 'border', 'rounded-lg', 'shadow-sm', 'transition-all', 'overflow-hidden');

            const isCollected = visitedSites.includes(site.id);
            
            if (isCollected) {
                // Collected stamp (Full color)
                stampEl.classList.add('bg-green-100', 'border-green-300');
                stampEl.innerHTML = `
                    <img src="${site.image}" alt="${site.name}" class="w-full h-full object-cover">
                    <div class="absolute bottom-0 left-0 w-full bg-black/50 text-white p-1 text-center">
                        <p class="text-xs font-bold">${site.id}. ${site.name}</p>
                    </div>
                    <div class="absolute top-1 right-1 text-2xl">✅</div>
                `;
                collectedCount++;
            } else {
                // Locked stamp (Grayscale)
                stampEl.classList.add('bg-gray-100', 'border-gray-200');
                stampEl.innerHTML = `
                    <img src="${site.image}" alt="${site.name}" class="w-full h-full object-cover filter grayscale opacity-60">
                    <div class="absolute bottom-0 left-0 w-full bg-black/50 text-white p-1 text-center">
                        <p class="text-xs font-bold opacity-70">${site.id}. ???</p>
                    </div>
                `;
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
    if (closePassportModal) {
        closePassportModal.addEventListener('click', () => {
            passportModal.classList.add('hidden');
        });
    }
    // --- END PASSPORT LOGIC ---

    // --- NEW QUIZ LOGIC (for Idea 2) ---
    const quizModal = document.getElementById('quizModal');
    const closeQuizModal = document.getElementById('closeQuizModal');
    const quizTitle = document.getElementById('quizTitle');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizInput = document.getElementById('quizInput');
    const quizSubmitBtn = document.getElementById('quizSubmitBtn');
    const quizError = document.getElementById('quizError');

    function openQuizModal(site, marker, btnCollect) {
        siteModal.classList.add('hidden'); // Close site modal
        quizTitle.textContent = `Quiz for: ${site.name}`;
        quizQuestion.textContent = site.quiz.q;
        quizInput.value = '';
        quizError.classList.add('hidden'); // Hide old errors
        quizModal.classList.remove('hidden');

        // We set onclick here to pass the site data
        quizSubmitBtn.onclick = () => {
            checkQuizAnswer(site, marker, btnCollect);
        };
    }
    
    if (closeQuizModal) {
        closeQuizModal.addEventListener('click', () => {
            quizModal.classList.add('hidden');
        });
    }

    function checkQuizAnswer(site, marker, btnCollect) {
        const userAnswer = quizInput.value.trim();
        const correctAnswer = site.quiz.a;

        if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
            // Correct!
            quizModal.classList.add('hidden');
            collectStamp(site.id, marker, btnCollect, site.name); // Pass name for AI
        } else {
            // Wrong
            quizError.textContent = "Not quite! Try reading the info again.";
            quizError.classList.remove('hidden');
        }
    }
    // --- END NEW QUIZ LOGIC ---


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
        [3.150380, 101.697576], [3.150439, 101.697668], [3.150733, 101.697576],
        [3.151065, 101.697694], [3.151467, 101.697791], [3.151810, 101.698011],
        [3.152051, 101.698306], [3.152158, 101.698413], [3.152485, 101.698435],
        [3.152586, 101.698413], [3.151802, 101.697252], [3.151796, 101.697171],
        [3.152102, 101.696968], [3.151684, 101.696683], [3.151914, 101.696270],
        [3.151298, 101.695889], [3.151581, 101.695549], [3.150951, 101.695173],
        [3.150238, 101.694712], [3.149922, 101.694510], [3.148934, 101.694228]
    ];

    L.polygon(heritageZoneCoords, {
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
        .then(res => {
            // --- NEW: Store data in our global var ---
            allSiteData = res.clone().json(); // Store for passport
            return res.json();
            // --- END NEW ---
        })
        .then(sites => {
            allSiteData = sites; // Store data
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

                    // --- Logic for Idea 3 (Smart AI Button) ---
                    const btnAskAI = document.getElementById('btnAskAI');
                    btnAskAI.onclick = (e) => {
                        e.preventDefault();
                        const siteName = site.name;
                        siteModal.classList.add('hidden');
                        chatModal.classList.remove('hidden');
                        chatInput.value = `Tell me more about the ${siteName}.`;
                    };
                    // --- End Logic for Idea 3 ---


                    // --- UPDATED LOGIC (Ideas 2) ---
                    const isNumberedSite = !isNaN(site.id);
                    btnCollect.style.display = 'flex'; // Always show the button

                    if (isNumberedSite) {
                        // It's a "Stamp" (1-13)
                        if (visitedSites.includes(site.id)) {
                            btnCollect.innerHTML = "✅ Stamp Collected";
                            btnCollect.classList.add('opacity-50', 'cursor-not-allowed');
                            btnCollect.disabled = true;
                        } else {
                            // --- NEW: Open quiz instead ---
                            btnCollect.innerHTML = "🏆 Earn Stamp (Quiz!)";
                            btnCollect.classList.remove('opacity-50', 'cursor-not-allowed');
                            btnCollect.disabled = false;
                            btnCollect.onclick = () => {
                                openQuizModal(site, marker, btnCollect);
                            };
                            // --- END NEW ---
                        }
                    } else {
                        // It's a "Discovery" (A-M)
                        if (discoveredSites.includes(site.id)) {
                            btnCollect.innerHTML = "✅ Discovered!";
                            btnCollect.classList.add('opacity-50', 'cursor-not-allowed');
                            btnCollect.disabled = true;
                        } else {
                            btnCollect.innerHTML = "💡 Discover this Point";
                            btnCollect.classList.remove('opacity-50', 'cursor-not-allowed');
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
                    // --- END UPDATED LOGIC ---

                    siteModal.classList.remove('hidden');
                });
            });
        })
        .catch(err => {
            console.error("Error loading Map Data:", err);
            alert("Fatal Error: Could not load heritage site data. Please check your internet connection and refresh the page.");
        });

    // --- UPDATED collectStamp (for Idea 3) ---
    function collectStamp(siteId, marker, btn, siteName) { // siteName is new
        if (!visitedSites.includes(siteId)) {
            
            visitedSites.push(siteId);
            localStorage.setItem('jejak_visited', JSON.stringify(visitedSites));
            
            marker._icon.classList.add('marker-visited');
            btn.innerHTML = "✅ Stamp Collected";
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.disabled = true;

            updateGameProgress();

            // --- NEW: Silently tell the AI what happened ---
            handleChatSend(`I have just collected the stamp for ${siteName}.`, true);
            // --- END NEW ---

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
    
    // Recenter Button
    if(btnRecenter) {
        btnRecenter.addEventListener('click', () => {
            map.setView([3.1483, 101.6938], 16);
        });
    }

    // Share Button
    if(btnShare) {
        btnShare.addEventListener('click', () => {
            const text = "I just became an Official Explorer by visiting all 13 Heritage Sites in Kuala Lumpur! 🇲Y✨ Try the Jejak Warisan challenge here: #ThisKulCity #BadanWarisanMalaysia";
            const url = "https://jejak-warisan.vercel.app";
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
            window.open(whatsappUrl, '_blank');
        });
    }

    // User Location Logic
    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });

    // Modal Closers
    const hideModal = () => siteModal.classList.add('hidden');
    if(closeModal) closeModal.addEventListener('click', hideModal);
    if(closeReward) closeReward.addEventListener('click', () => rewardModal.classList.add('hidden'));
});
