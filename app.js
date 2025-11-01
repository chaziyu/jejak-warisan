// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GET MODAL ELEMENTS ---
    // These are the parts of the "attractive" modal we need to update
    const siteModal = document.getElementById('siteModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBuilt = document.getElementById('modalBuilt');
    const modalArchitects = document.getElementById('modalArchitects');
    const modalInfo = document.getElementById('modalInfo');
    const closeModal = document.getElementById('closeModal');

    // Function to close the modal
    const hideSiteInfo = () => siteModal.classList.add('hidden');
    
    // Add click event to the "close" button
    closeModal.addEventListener('click', hideSiteInfo);
    
    // Also close the modal if the user clicks the dark background
    siteModal.addEventListener('click', (e) => {
        if (e.target === siteModal) {
            hideSiteInfo();
        }
    });

    // --- 2. INITIALIZE THE MAP ---
    // Centered on Dataran Merdeka [3.1483, 101.6938]
    const map = L.map('map').setView([3.1483, 101.6938], 16);

    // Add the free OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // --- 3. MAKE IT "INTERACTIVE" (LOAD MARKERS) ---
    // Fetch your "database" file
    fetch('data.json')
        .then(response => response.json())
        .then(sites => {
            sites.forEach(site => {
                // Create a marker for each site
                const marker = L.marker(site.coordinates).addTo(map);
                
                // **THIS IS THE INTERACTIVE PART**
                // Add a click event to each marker
                marker.on('click', () => {
                    // 1. Populate the modal with data from the JSON
                    modalTitle.textContent = `${site.id}. ${site.name}`;
                    modalBuilt.textContent = site.built || "N/A";
                    modalArchitects.textContent = site.architects || "N/A";
                    modalInfo.textContent = site.info;
                    
                    // 2. Show the modal
                    siteModal.classList.remove('hidden');
                });
            });
        })
        .catch(error => console.error('Error loading heritage data:', error));

    // --- 4. ADD USER'S LIVE GPS LOCATION ---
    // This adds the "blue dot" to the map
    
    // Add a marker for the user's location
    const userMarker = L.marker([0, 0]).addTo(map);
    // Add a circle to show accuracy
    const userCircle = L.circle([0, 0], {
        radius: 10,
        color: '#007bff',
        fillColor: '#007bff',
        fillOpacity: 0.1
    }).addTo(map);

    function onLocationFound(e) {
        const radius = e.accuracy / 2;
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(radius);
        
        // Optionally, uncomment the line below to auto-follow the user
        // map.setView(e.latlng, 17);
    }

    function onLocationError(e) {
        alert("Geolocation failed. Please enable location services.");
        console.error(e.message);
    }

    // Start watching the user's position
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
    
    map.locate({
        watch: true,        // Continuously update location
        setView: true,      // Center the map on the user's location on first load
        maxZoom: 18,
        enableHighAccuracy: true
    });
});
