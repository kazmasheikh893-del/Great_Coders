// ============================================
// SafeRoute Frontend
// ============================================

const API_URL = 'http://localhost:5000/api';

// map
const map = L.map('map');

navigator.geolocation.getCurrentPosition(
    function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        map.setView([lat, lon], 15);

        L.marker([lat, lon])
            .addTo(map)
            .bindPopup("📍 You are here")
            .openPopup();
    },
    function() {
        map.setView([20.5937, 78.9629], 5);
    }
);


L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '©OpenStreetMap'
}).addTo(map);

// State
let hazardMarkers = [];
let reportMode = false;

// ============================================
// Load Hazards from Backend
// ============================================

async function loadHazards() {
    try {
        const response = await fetch(`${API_URL}/hazards?hours=48`);
        const data = await response.json();
        
        if (data.success) {
            displayHazards(data.hazards);
            updateStats();
        }
    } catch (error) {
        console.error('Error loading hazards:', error);
    }
}

// ============================================
// Display Hazards on Map
// ============================================

function displayHazards(hazards) {
    // Clear old markers
    hazardMarkers.forEach(m => map.removeLayer(m));
    hazardMarkers = [];
    
    hazards.forEach(h => {
        const icon = getHazardIcon(h.type);
        const marker = L.marker([h.lat, h.lng], {
            icon: L.divIcon({
                className: 'hazard-marker',
                html: `<div style="background: ${icon.color}; color: white; padding: 8px; border-radius: 50%;">${icon.emoji}</div>`,
                iconSize: [40, 40]
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <div class="p-3">
                <h3 class="font-bold">${h.type}</h3>
                <p>${h.description || 'Hazard reported'}</p>
                <p class="text-sm text-gray-500">${h.time_ago}</p>
                <button onclick="verifyHazard(${h.id})" 
                        class="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm">
                    ✓ Verify (${h.verification_count})
                </button>
            </div>
        `);
        
        hazardMarkers.push(marker);
    });
}

function getHazardIcon(type) {
    const icons = {
        'lights': { emoji: '💡', color: '#f59e0b' },
        'unsafe': { emoji: '⚠️', color: '#ef4444' },
        'animals': { emoji: '🐕', color: '#8b5cf6' }
    };
    return icons[type] || { emoji: '📌', color: '#6b7280' };
}

// ============================================
// Report Hazard
// ============================================

async function reportHazard(lat, lng, type, description) {
    try {
        const response = await fetch(`${API_URL}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat, lng, type, description,
                user_id: localStorage.getItem('userId') || 'anonymous'
            })
        });
        
        const data = await response.json();
        if (data.success) {
            loadHazards(); // Reload to show new hazard
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error reporting:', error);
        return false;
    }
}

// ============================================
// Verify Hazard
// ============================================

window.verifyHazard = async function(hazardId) {
    try {
        const response = await fetch(`${API_URL}/verify/${hazardId}`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            loadHazards(); // Reload to show updated verification
        }
    } catch (error) {
        console.error('Error verifying:', error);
    }
};

// ============================================
// Update Stats
// ============================================

async function updateStats() {
    try {
        const response = await fetch(`${API_URL}/stats`);
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('activeUsers').textContent = 
                Math.floor(800 + Math.random() * 100);
            document.getElementById('totalReports').textContent = 
                data.stats.total_reports || '1.2k';
        }
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// ============================================
// Search Locations
// ============================================

async function searchLocations(query) {
    try {
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        return [];
    }
}

// ============================================
// Event Listeners
// ============================================

document.getElementById('reportMode').addEventListener('click', function() {
    reportMode = !reportMode;
    const status = document.getElementById('reportStatus');
    
    if (reportMode) {
        status.classList.remove('hidden');
        this.innerHTML = '<i class="fas fa-times mr-2"></i>Cancel';
    } else {
        status.classList.add('hidden');
        this.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>Report';
    }
});

map.on('click', async function(e) {
    if (!reportMode) return;
    
    const type = prompt('Hazard type:\n1 = No Lights\n2 = Unsafe\n3 = Animals');
    const typeMap = { '1': 'lights', '2': 'unsafe', '3': 'animals' };
    const selected = typeMap[type];
    
    if (!selected) return;
    
    const desc = prompt('Description (optional):');
    const success = await reportHazard(e.latlng.lat, e.latlng.lng, selected, desc);
    
    if (success) {
        alert('✅ Hazard reported! Thanks for keeping everyone safe!');
    }
    
    reportMode = false;
    document.getElementById('reportMode').click();
});

document.getElementById('findRoutes').addEventListener('click', function() {
    // Mock routes for demo
    document.getElementById('routeResults').innerHTML = `
        <div class="route-card bg-red-50 p-4 rounded-xl border-l-8 border-red-500">
            <div class="flex justify-between">
                <span class="font-bold">FAST ROUTE</span>
                <span class="text-red-600 font-bold">85% Risk</span>
            </div>
            <div class="text-sm">8 min • 2.1 km • 3 hazards</div>
        </div>
        <div class="route-card bg-green-50 p-4 rounded-xl border-l-8 border-green-500 relative">
            <div class="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-sm rounded-bl-lg">
                RECOMMENDED
            </div>
            <div class="flex justify-between">
                <span class="font-bold">SAFE ROUTE</span>
                <span class="text-green-600 font-bold">15% Risk</span>
            </div>
            <div class="text-sm">12 min • 3.2 km • 0 hazards</div>
        </div>
    `;
});

// Search autocomplete
let searchTimeout;
document.getElementById('start').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    if (query.length < 3) return;
    
    searchTimeout = setTimeout(async () => {
        const results = await searchLocations(query);
        console.log('Results:', results);
    }, 500);
});

// Initialize
loadHazards();
setInterval(loadHazards, 30000); // Refresh every 30 seconds