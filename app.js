// --- CONFIGURATION ---
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOtyJ200uEv2yu24C-DesB5g57iBX9CpO_qp8mAQCKX1LYrS_S8BnZGtfVDq_9LqnJ7HO6nbXpu8J4/pub?gid=0&single=true&output=csv"; 
const ADMIN_PASSWORD = "BWM"; 

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
            landingPage.remove();
            gatekeeper.remove();
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

    btnVisitor.addEventListener('click', () => {
        landingPage.classList.add('hidden');
        gatekeeper.classList.remove('hidden');
    });

    btnStaff.addEventListener('click', async () => {
        const pass = prompt("👮 BWM STAFF LOGIN\nPlease enter your password:");
        if (pass === ADMIN_PASSWORD) {
            await showAdminCode();
        } else if (pass !== null) {
            alert("❌ Wrong password");
        }
    });

    backToHome.addEventListener('click', () => {
        gatekeeper.classList.add('hidden');
        landingPage.classList.remove('hidden');
    });

    closeStaffScreen.addEventListener('click', () => {
        staffScreen.classList.add('hidden');
        landingPage.classList.remove('hidden');
    });

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
    btn.addEventListener('click', () => { if(input.value) verifyCode(input.value); });
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter' && input.value) verifyCode(input.value); });
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
            landingPage.style.opacity = '0';
            
            setTimeout(() => {
                gatekeeper.remove();
                landingPage.remove();
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

    const map = L.map('map').setView([3.1483, 101.6938], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // --- HERITAGE ZONE POLYGON ---
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
        [3.150238, 101.694712], [3.149922, 101.694510]
    ];

    L.polygon(heritageZoneCoords, {
        color: '#666',          
        fillColor: '#333',      
        fillOpacity: 0.1,       
        weight: 2,
        dashArray: '5, 5'       
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
        img: document.getElementById('modalImage'),              // IMAGE SELECTOR
        imgContainer: document.getElementById('modalImageContainer') // CONTAINER SELECTOR
    };

    fetch('data.json')
        .then(res => res.json())
        .then(sites => {
            sites.forEach(site => {
                const marker = L.marker(site.coordinates).addTo(map);

                if (visitedSites.includes(site.id)) {
                    marker._icon.classList.add('marker-visited');
                }

                marker.on('click', () => {
                    elements.title.textContent = `${site.id}. ${site.name}`;
                    elements.built.textContent = site.built || "N/A";
                    elements.architects.textContent = site.architects || "N/A";
                    elements.info.textContent = site.info;
                    
                    // --- IMAGE LOGIC (NEW) ---
                    if (site.image) {
                        elements.img.src = site.image;
                        elements.imgContainer.classList.remove('hidden');
                    } else {
                        elements.imgContainer.classList.add('hidden');
                    }

                    btnDirections.href = `https://www.google.com/maps/dir/?api=1&destination=${site.coordinates[0]},${site.coordinates[1]}&travelmode=walking`;

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
        const count = visitedSites.filter(id => !isNaN(id)).length;
        const percent = (count / TOTAL_SITES) * 100;
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${count}/${TOTAL_SITES} Sites`;
    }

    // --- NEW BUTTON LOGIC ---
    
    // Recenter Button: Resets view to Dataran Merdeka (Centre of Zone)
    btnRecenter.addEventListener('click', () => {
        map.setView([3.1483, 101.6938], 16);
    });

    // Share Button: Opens WhatsApp with victory message
    btnShare.addEventListener('click', () => {
        const text = "I just became an Official Explorer by visiting all 13 Heritage Sites in Kuala Lumpur! 🇲🇾✨ Try the Jejak Warisan challenge here: #ThisKulCity #BadanWarisanMalaysia";
        const url = "https://jejak-warisan.vercel.app";
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
        window.open(whatsappUrl, '_blank');
    });

    const userMarker = L.marker([0, 0]).addTo(map);
    const userCircle = L.circle([0, 0], { radius: 10 }).addTo(map);
    map.on('locationfound', (e) => {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(e.accuracy / 2);
    });
    map.locate({ watch: true, enableHighAccuracy: true });

    const hideModal = () => siteModal.classList.add('hidden');
    closeModal.addEventListener('click', hideModal);
    closeReward.addEventListener('click', () => rewardModal.classList.add('hidden'));
});
