// --- CONFIGURATION ---
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOtyJ200uEv2yu24C-DesB5g57iBX9CpO_qp8mAQCKX1LYrS_S8BnZGtfVDq_9LqnJ7HO6nbXpu8J4/pub?gid=0&single=true&output=csv"; 
const ADMIN_PASSWORD = "BWM"; 

// YOUR API KEY (Integrated)
const GEMINI_API_KEY = "AIzaSyDJdiq3SRAl4low1-VW-msp4A1ZD_5bymw";

// --- KNOWLEDGE BASE (Extracted from BWM Document PDF) ---
const PDF_KNOWLEDGE_BASE = `
SOURCE MATERIAL: "This Kul City: Discover Kwala Lumpur" by Badan Warisan Malaysia.

SITE 1: Bangunan Sultan Abdul Samad. Built 1894-1897. Architects: AC Norman, RAJ Bidwell, CE Spooner, AB Hubback. Originally Govt Offices. 480ft long in "Mahometan" style. Clock tower is 140ft high. Contains 4 million bricks, 5000lbs copper. The clock was first heard on Queen Victoria's birthday in 1897.
SITE 2: Old Post Office. Built 1904-1907 by Architect AB Hubback. Cost $100,000. Features horse-shoe arches. Used to be Ministry of Tourism.
SITE 3: Wisma Straits Trading & Loke Yew Building. Loke Yew Building is Art Deco (designed by B.M. Iversen). Chow Kit & Co building (1904) is Neo-Renaissance, designed by AK Moosden.
SITE 4: Masjid Jamek. Built 1908-1909 by AB Hubback. Cost $33,500. Sited on an old Malay cemetery. Moghul style with onion domes and red/white brick bands.
SITE 5: Medan Pasar (Old Market Square). Site of Yap Ah Loy's market. The Clock tower was erected in 1937 for King George VI's coronation and features an Art Deco sunburst motif.
SITE 6: Sze Ya Temple. Built 1882. Oldest traditional Chinese temple in KL. Dedicated to deities Sin Sze Ya and Si Sze Ya who guided Yap Ah Loy. Built at an angle for Feng Shui.
SITE 7: The Triangle / Old Federal Stores. Federal Stores (1905) has "garlic shaped finials" and no five-foot way.
SITE 8: Kedai Ubat Kwong Ban Heng. Traditional herb shop established over 30 years ago at No 62.
SITE 9: Oriental Building. Built 1932 by A.O. Coltman. Was the tallest in KL (85ft) at the time. Features a curved facade.
SITE 10: Flower Garland Stall. Located near the Teochew Association.
SITE 11: Masjid India. Originally timber (1893), rebuilt 1966. Southern Indian style with chatris. Prayers conducted in Arabic and Tamil.
SITE 12: P.H. Hendry Royal Jewellers. Oldest jewellers in Malaysia. Founded by P.H. Dineshamy from Ceylon. Appointed royal jewellers to Sultans.
SITE 13: Old City Hall. Built 1904 by AB Hubback. Cost $107,000. Now venue for "MUD: Our Story of KL".

ADDITIONAL FACTS:
- Dataran Merdeka (The Padang) has a 100m flagpole. Union Jack lowered Aug 31, 1957.
- Textile Museum (1905) was originally FMS Railway Offices.
- OCBC Building (1936) by AO Coltman had bicycle parking in the basement.
- Central Market (1936) used "Calorex" glass to reduce heat.
`;

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
        passkeyDisplay.textContent = "ERROR";
        alert("Connection Error.");
        staffScreen.classList.add('hidden');
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
    initApp();
    updateGameProgress(); 

    // Initialize Map
    const map = L.map('map').setView([3.1483, 101.6938], 16);

    // Clean Map Style (Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // --- KML HERITAGE ZONE ROUTE (CORRECTED) ---
    const heritageZoneCoords = [
        [3.148934, 101.694228], [3.148012, 101.694051], [3.147936, 101.694399],
        [3.147164, 101.694292], [3.147067, 101.695104], [3.146902, 101.695994],
        [3.146215, 101.695884], [3.146004, 101.69586], [3.145961, 101.695897],
        [3.145896, 101.69616], [3.145642, 101.696179], [3.145672, 101.696616],
        [3.145883, 101.696592], [3.145982, 101.696922], [3.146416, 101.69667],
        [3.146694, 101.696546], [3.146828, 101.696584], [3.146903, 101.69689],
        [3.147075, 101.697169], [3.147541, 101.697517], [3.147889, 101.697807],
        [3.147969, 101.697872], [3.148366, 101.697491], [3.149041, 101.696868],
        [3.14933, 101.696632], [3.149549, 101.696718], [3.150106, 101.697303],
        [3.15038, 101.697576], [3.150439, 101.697668], [3.150733, 101.697576],
        [3.151065, 101.697694], [3.151467, 101.697791], [3.15181, 101.698011],
        [3.152051, 101.698306], [3.152158, 101.698413], [3.152485, 101.698435],
        [3.152586, 101.698413], [3.151802, 101.697252], [3.151796, 101.697171],
        [3.152102, 101.696968], [3.151684, 101.696683], [3.151914, 101.69627],
        [3.151298, 101.695889], [3.151581, 101.695549], [3.150951, 101.695173],
        [3.150238, 101.694712], [3.149922, 101.69451], [3.148934, 101.694228]
    ];

    L.polyline(heritageZoneCoords, {
        color: '#ff6b6b',       
        weight: 4,              
        opacity: 0.7,
        dashArray: '10, 10',    
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

    // AI UI Elements
    const aiText = document.getElementById('aiResponse');
    const aiBtn = document.getElementById('btnAskAI');

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
                    // 1. Update UI
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

                    // 2. Stamp Logic
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
                            btnCollect.onclick = () => { collectStamp(site.id, marker, btnCollect); };
                        }
                    }

                    // 3. AI Logic
                    aiText.textContent = "";
                    aiText.classList.add('hidden');
                    aiBtn.disabled = false;
                    aiBtn.innerHTML = "Tell me a secret fact!";
                    aiBtn.classList.remove('opacity-50', 'cursor-not-allowed');

                    const newAiBtn = aiBtn.cloneNode(true);
                    aiBtn.parentNode.replaceChild(newAiBtn, aiBtn);

                    newAiBtn.addEventListener('click', async () => {
                        newAiBtn.innerHTML = "Consulting Archives... 📜"; 
                        newAiBtn.disabled = true;
                        newAiBtn.classList.add('opacity-50', 'cursor-not-allowed');
                        aiText.textContent = "Reading the historical records...";
                        aiText.classList.remove('hidden');

                        // Expanded Prompt to handle "Not Found" cases
                        const prompt = `
                        CONTEXT: You are a fun, expert historian guide for Kuala Lumpur.
                        SOURCE MATERIAL: ${PDF_KNOWLEDGE_BASE}
                        
                        CURRENT SITE: ${site.name}
                        OFFICIAL INFO: ${site.info}
                        
                        TASK: Tell me a "Hidden Secret" or interesting fact about the CURRENT SITE based on the SOURCE MATERIAL.
                        
                        IMPORTANT FALLBACK: If this specific site is not mentioned in the SOURCE MATERIAL, ignore the source material and use your own general historical knowledge to provide a fun, accurate fact about "${site.name}" in Kuala Lumpur. Do NOT say "I couldn't find it". Just give the fact.
                        
                        STYLE: Short (max 2 sentences). Exciting.
                        `;

                        try {
                            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
                            const response = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: prompt }] }],
                                    // SAFETY SETTINGS: Prevent blocking valid historical facts
                                    safetySettings: [
                                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                                    ]
                                })
                            });
                            const data = await response.json();
                            
                            if(data.candidates && data.candidates.length > 0) {
                                const aiResult = data.candidates[0].content.parts[0].text;
                                aiText.textContent = aiResult;
                            } else {
                                aiText.textContent = "The historian is speechless! (No data found)";
                            }
                        } catch (error) {
                            console.error(error);
                            aiText.textContent = "The historian is on a coffee break. (Connection Error)";
                        } finally {
                            newAiBtn.innerHTML = "✨ Ask Another";
                            newAiBtn.disabled = false;
                            newAiBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                        }
                    });

                    siteModal.classList.remove('hidden');
                });
            });
        })
        .catch(err => console.error("Error loading Map Data:", err));

    function collectStamp(siteId, marker, btn) {
        if (!visitedSites.includes(siteId)) {
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
        const progressText = document.getElementById('progressText');
        if(!progressBar || !progressText) return;
        
        const count = visitedSites.filter(id => !isNaN(id)).length;
        const percent = (count / TOTAL_SITES) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${count}/${TOTAL_SITES} Sites`;
    }
    
    if(btnRecenter) {
        btnRecenter.addEventListener('click', () => {
            map.setView([3.1483, 101.6938], 16);
        });
    }

    if(btnShare) {
        btnShare.addEventListener('click', () => {
            const text = "I just became an Official Explorer by visiting all 13 Heritage Sites in Kuala Lumpur! 🇲🇾✨ Try the Jejak Warisan challenge here: #ThisKulCity #BadanWarisanMalaysia";
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

    const hideModal = () => siteModal.classList.add('hidden');
    if(closeModal) closeModal.addEventListener('click', hideModal);
    if(closeReward) closeReward.addEventListener('click', () => rewardModal.classList.add('hidden'));
});
