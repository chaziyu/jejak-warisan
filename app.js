// Wait for the HTML document to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Get references to the modal elements
    const siteModal = document.getElementById('siteModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBuilt = document.getElementById('modalBuilt');
    const modalArchitects = document.getElementById('modalArchitects');
    const modalInfo = document.getElementById('modalInfo');
    const closeModal = document.getElementById('closeModal');

    // 1. Initialize the Leaflet map
    // Centered on Dataran Merdeka [3.1483, 101.6938]
    const map = L.map('map').setView([3.1483, 101.6938], 16);

    // 2. Add the free OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 3. Fetch your local data and add markers
    fetch('data.json')
        .then(response => response.json())
        .then(sites => {
            sites.forEach(site => {
                const marker = L.marker(site.coordinates).addTo(map);
                
                // When a marker is clicked, run the showSiteInfo function
                marker.on('click', () => {
                    showSiteInfo(site);
                });
            });
        })
        .catch(error => console.error('Error loading heritage data:', error));

    // This function populates and shows the modal
    function showSiteInfo(site) {
        modalTitle.textContent = site.name;
        modalBuilt.textContent = site.built || "N/A";
        modalArchitects.textContent = site.architects || "N/A";
        modalInfo.textContent = site.info;
        siteModal.classList.remove('hidden');
    }

    // This function hides the modal
    function hideSiteInfo() {
        siteModal.classList.add('hidden');
    }

    // Add click event to the "close" button
    closeModal.addEventListener('click', hideSiteInfo);

    // 4. Add the user's live GPS location
    if (navigator.geolocation) {
        // 'watchPosition' updates the location as the user moves
        navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Add a marker for the user's location
                L.marker([lat, lon], {
                    // You can find a custom "blue dot" icon
                    // icon: yourCustomIcon
                }).addTo(map)
                  .bindPopup("You are here.")
                  .openPopup();
                
                // Optionally, center the map on the user
                // map.setView([lat, lon], 17);
            },
            () => {
                // Handle errors (e.g., user denies permission)
                console.log("Unable to retrieve your location.");
            }
        );
    } else {
        console.log("Geolocation is not supported by this browser.");
    }
});