document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL-ISH VARIABLES ---
    let allSitesData = [];
    let allMarkersLayer = L.layerGroup();
    let userLocation = null;

    // --- 2. GET ALL HTML ELEMENTS ---
    const map = L.map('map').setView([3.1483, 101.6938], 16); // Default view
    
    // Site Modal (for info)
    const siteModal = document.getElementById('siteModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalImage = document.getElementById('modalImage');
    const modalBuilt = document.getElementById('modalBuilt');
    const modalArchitects = document.getElementById('modalArchitects');
    const modalInfo = document.getElementById('modalInfo');
    const getDirectionsButton = document.getElementById('getDirectionsButton');
    const closeSiteModal = document.getElementById('closeSiteModal');

    // Search Bar
    const searchBox = document.getElementById('searchBox');
    const searchResults = document.getElementById('searchResults');

    // --- 3. INITIALIZE THE MAP ---
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    allMarkersLayer.addTo(map);

    // --- 4. HELPER FUNCTIONS ---

    // Function to show the Site Info Modal
    function showSiteInfo(site) {
        modalTitle.textContent = `${site.id}. ${site.name}`;
        
        if (site.imageUrl) {
            modalImage.src = site.imageUrl;
            modalImage.alt = site.name;
            modalImage.classList.remove('hidden');
            modalImage.onerror = () => {
                modalImage.src = "https://via.placeholder.com/400x250?text=Image+Not+Found";
            };
        } else {
            modalImage.classList.add('hidden');
        }

        modalBuilt.textContent = site.built || "N/A";
        modalArchitects.textContent = site.architects || "N/A";
        modalInfo.textContent = site.info;
        
        // Set "Get Directions" button link
        const lat = site.coordinates[0];
        const lng = site.coordinates[1];
        getDirectionsButton.href = `http://googleusercontent.com/maps/google.com/4{lat},${lng}`;

        siteModal.classList.remove('hidden');
    }
    const hideSiteInfo = () => siteModal.classList.add('hidden');

    // --- 5. LOAD ALL DATA AND SET UP FEATURES ---
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok. Check data.json for errors.');
            }
            return response.json();
        })
        .then(sites => {
            allSitesData = sites;

            sites.forEach(site => {
                // Create marker and add to layer group
                const marker = L.marker(site.coordinates);
                marker.siteData = site; // Attach site data to marker
                
                marker.on('click', () => {
                    showSiteInfo(site);
                });
                
                allMarkersLayer.addLayer(marker);
            });

            // Focus map on all markers
            map.fitBounds(allMarkersLayer.getBounds(), { padding: [50, 50] });

            // --- 6. SET UP SEARCH BAR ---
            searchBox.addEventListener('keyup', (e) => {
                const query = e.target.value.toLowerCase();
                searchResults.innerHTML = '';
                searchResults.classList.add('hidden');

                if (query.length < 2) return;

                const results = allSitesData.filter(site => site.name.toLowerCase().includes(query));
                
                if (results.length > 0) {
                    searchResults.classList.remove('hidden');
                    results.forEach(site => {
                        const li = document.createElement('li');
                        li.className = 'p-2 hover:bg-gray-100 cursor-pointer';
                        li.textContent = `${site.id}. ${site.name}`;
                        li.onclick = () => {
                            map.setView(site.coordinates, 18);
                            showSiteInfo(site);
                            searchBox.value = '';
                            searchResults.classList.add('hidden');
                        };
                        searchResults.appendChild(li);
                    });
                }
            });
        })
        .catch(error => {
            console.error('CRITICAL ERROR: Could not load data.json.', error);
            // This alert is what you saw in your screenshot.
            alert('Error: Could not load heritage site data. Please check data.json for syntax errors.');
        });

    // --- 7. MODAL & BUTTON LISTENERS ---
    
    // Site Modal
    closeSiteModal.addEventListener('click', hideSiteInfo);
    siteModal.addEventListener('click', (e) => {
        if (e.target === siteModal) hideSiteInfo();
    });

    // --- 8. SETUP GEOLOCATION ---
    map.on('locationfound', (e) => {
        userLocation = e.latlng; // Store user's location
        const radius = e.accuracy / 2;
        
        // Create or update the user's marker
        if (map.hasLayer(L.marker.userMarker)) {
            L.marker.userMarker.setLatLng(e.latlng);
            L.circle.userCircle.setLatLng(e.latlng).setRadius(radius);
        } else {
            L.marker.userMarker = L.marker(e.latlng).addTo(map).bindPopup("You are here!");
            L.circle.userCircle = L.circle(e.latlng, {
                radius: radius,
                color: '#007bff',
                fillColor: '#007bff',
                fillOpacity: 0.1
            }).addTo(map);
        }
    });

    map.on('locationerror', (e) => {
        console.error(e.message);
        alert("Geolocation failed. 'Find Closest' will not work.");
    });

    map.locate({ watch: true, enableHighAccuracy: true });
});
