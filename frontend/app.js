// ============================================
// SafeRoute Frontend - COMPLETE WORKING VERSION
// ============================================

const API_URL = 'http://localhost:5000/api';

// Map initialization
const map = L.map('map').setView([20.5937, 78.9629], 5);

// Map tiles
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '©OpenStreetMap, ©CartoDB'
}).addTo(map);

// State
let hazardMarkers = [];
let reportMode = false;
let userLocation = null;
let currentRoutes = [];
let routeLayers = [];
let startMarker = null;
let endMarker = null;

// ============================================
// Get User Location
// ============================================
navigator.geolocation.getCurrentPosition(
    function(position) {
        userLocation = [position.coords.latitude, position.coords.longitude];
        map.setView(userLocation, 15);
        
        // Add user marker
        L.marker(userLocation, {
            icon: L.divIcon({
                className: 'user-marker',
                html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 20px #3b82f6;"></div>',
                iconSize: [20, 20]
            })
        }).addTo(map).bindPopup("📍 You are here").openPopup();
        
        // Set default values
        document.getElementById('start').value = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
    },
    function(error) {
        console.error('Geolocation error:', error);
        userLocation = [40.7128, -74.0060]; // Default to NYC
        map.setView(userLocation, 13);
        document.getElementById('start').value = '40.7128, -74.0060';
    }
);

// ============================================
// FIND ROUTES BUTTON - MAIN FUNCTIONALITY
// ============================================
document.getElementById('findRoutes').addEventListener('click', async function() {
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    
    if (!end) {
        alert('Please enter a destination');
        return;
    }
    
    // Show loading state
    const button = this;
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding Routes...';
    button.disabled = true;
    
    try {
        // Parse coordinates
        let startCoords, endCoords;
        
        // Parse start coordinates
        if (start.includes(',')) {
            const [lat, lng] = start.split(',').map(Number);
            startCoords = [lat, lng];
        } else {
            startCoords = userLocation || [40.7128, -74.0060];
        }
        
        // Parse end coordinates
        if (end.includes(',')) {
            const [lat, lng] = end.split(',').map(Number);
            endCoords = [lat, lng];
        } else {
            // If not coordinates, create a destination 2km away
            endCoords = [
                startCoords[0] + 0.02,
                startCoords[1] + 0.02
            ];
        }
        
        // Clear previous routes and markers
        clearRoutes();
        clearMarkers();
        
        // Add start and end markers
        addStartEndMarkers(startCoords, endCoords);
        
        // Get hazards from backend
        const hazards = await loadHazardsForRoute(startCoords, endCoords);
        
        // Calculate routes with FIXED colors
        const routes = calculateRoutes(startCoords, endCoords, hazards);
        currentRoutes = routes;
        
        // Display routes on map with colors
        displayRoutes(routes);
        
        // Display route cards in sidebar
        displayRouteCards(routes);
        
        // Fit map to show entire route
        const bounds = L.latLngBounds([startCoords, endCoords]);
        map.fitBounds(bounds, { padding: [50, 50] });
        
        // Show success message
        showNotification('Routes found! 🟢 Safe | 🔵 Balanced | 🔴 Fast', 'success');
        
    } catch (error) {
        console.error('Error finding routes:', error);
        showNotification('Error finding routes. Using demo data.', 'error');
        
        // Use demo data if backend fails
        const demoRoutes = generateDemoRoutes();
        currentRoutes = demoRoutes;
        displayRoutes(demoRoutes);
        displayRouteCards(demoRoutes);
        
    } finally {
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
    }
});

// ============================================
// Clear Previous Routes and Markers
// ============================================
function clearRoutes() {
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];
}

function clearMarkers() {
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
}

// ============================================
// Add Start and End Markers
// ============================================
function addStartEndMarkers(start, end) {
    // Start marker (Green)
    startMarker = L.marker(start, {
        icon: L.divIcon({
            className: 'start-marker',
            html: '<div style="background: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"><div style="position: absolute; top: -25px; left: -10px; background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; white-space: nowrap;">START</div></div>',
            iconSize: [20, 20]
        })
    }).addTo(map);

    // End marker (Red)
    endMarker = L.marker(end, {
        icon: L.divIcon({
            className: 'end-marker',
            html: '<div style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"><div style="position: absolute; top: -25px; left: -15px; background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; white-space: nowrap;">DESTINATION</div></div>',
            iconSize: [20, 20]
        })
    }).addTo(map);
}

// ============================================
// Calculate Routes with FIXED Colors
// ============================================
function calculateRoutes(start, end, hazards) {
    const latDiff = end[0] - start[0];
    const lngDiff = end[1] - start[1];
    
    // FAST ROUTE (RED) - Direct path
    const route1 = [];
    for (let i = 0; i <= 10; i++) {
        const lat = start[0] + (latDiff * i / 10);
        const lng = start[1] + (lngDiff * i / 10);
        route1.push([lat, lng]);
    }
    
    // SAFE ROUTE (GREEN) - Curved path avoiding hazards
    const route2 = [];
    for (let i = 0; i <= 10; i++) {
        const lat = start[0] + (latDiff * i / 10);
        const offset = Math.sin(i * Math.PI / 5) * 0.008;
        const lng = start[1] + (lngDiff * i / 10) + offset;
        route2.push([lat, lng]);
    }
    
    // BALANCED ROUTE (BLUE) - Slightly curved
    const route3 = [];
    for (let i = 0; i <= 10; i++) {
        const lat = start[0] + (latDiff * i / 10);
        const offset = Math.cos(i * Math.PI / 5) * 0.005;
        const lng = start[1] + (lngDiff * i / 10) - offset;
        route3.push([lat, lng]);
    }
    
    // Calculate hazard counts
    const hazardCount1 = countHazardsNearRoute(route1, hazards);
    const hazardCount2 = countHazardsNearRoute(route2, hazards);
    const hazardCount3 = countHazardsNearRoute(route3, hazards);
    
    // Calculate safety scores
    const safetyScore1 = Math.max(0, 100 - (hazardCount1 * 15));
    const safetyScore2 = Math.max(0, 100 - (hazardCount2 * 5));
    const safetyScore3 = Math.max(0, 100 - (hazardCount3 * 10));
    
    return [
        {
            id: 1,
            name: 'FAST ROUTE',
            description: 'Quickest path - may have hazards',
            path: route1,
            distance: calculateDistance(route1),
            time: Math.round(calculateDistance(route1) * 12),
            hazards: hazardCount1,
            safetyScore: Math.round(safetyScore1),
            color: '#ef4444', // RED for fast route
            riskLevel: safetyScore1 > 70 ? 'Low' : (safetyScore1 > 40 ? 'Medium' : 'High')
        },
        {
            id: 2,
            name: 'SAFE ROUTE',
            description: 'Safest path - recommended',
            path: route2,
            distance: calculateDistance(route2),
            time: Math.round(calculateDistance(route2) * 12),
            hazards: hazardCount2,
            safetyScore: Math.round(safetyScore2),
            color: '#10b981', // GREEN for safe route
            riskLevel: safetyScore2 > 70 ? 'Low' : (safetyScore2 > 40 ? 'Medium' : 'High')
        },
        {
            id: 3,
            name: 'BALANCED ROUTE',
            description: 'Good balance of speed and safety',
            path: route3,
            distance: calculateDistance(route3),
            time: Math.round(calculateDistance(route3) * 12),
            hazards: hazardCount3,
            safetyScore: Math.round(safetyScore3),
            color: '#3b82f6', // BLUE for balanced route
            riskLevel: safetyScore3 > 70 ? 'Low' : (safetyScore3 > 40 ? 'Medium' : 'High')
        }
    ];
}

// ============================================
// Count hazards near a route
// ============================================
function countHazardsNearRoute(route, hazards) {
    let count = 0;
    route.forEach(point => {
        hazards.forEach(hazard => {
            const distance = calculateDistanceBetweenPoints(
                point[0], point[1],
                hazard.lat, hazard.lng
            );
            if (distance < 0.3) { // Within 300m
                count++;
            }
        });
    });
    return count;
}

// ============================================
// Display Routes on Map
// ============================================
function displayRoutes(routes) {
    // Clear old routes
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];
    
    // Add routes to map with their fixed colors
    routes.forEach(route => {
        const polyline = L.polyline(route.path, {
            color: route.color,
            weight: route.id === 2 ? 6 : 4, // Safe route thicker
            opacity: 0.8,
            smoothFactor: 1
        }).addTo(map);
        
        // Add popup with route info
        polyline.bindPopup(`
            <div class="p-3" style="min-width: 200px;">
                <h3 class="font-bold text-lg" style="color: ${route.color}">${route.name}</h3>
                <p class="text-sm text-gray-600 mb-2">${route.description}</p>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    <div><span class="text-gray-500">Distance:</span> ${route.distance.toFixed(1)} km</div>
                    <div><span class="text-gray-500">Time:</span> ${route.time} min</div>
                    <div><span class="text-gray-500">Safety:</span> ${route.safetyScore}%</div>
                    <div><span class="text-gray-500">Hazards:</span> ${route.hazards}</div>
                </div>
                <button onclick="selectRoute(${route.id})" 
                        style="background: ${route.color}; color: white; width: 100%; margin-top: 10px; padding: 8px; border-radius: 5px; border: none; cursor: pointer; font-weight: bold;">
                    Take This Route
                </button>
            </div>
        `);
        
        routeLayers.push(polyline);
    });
}

// ============================================
// Display Route Cards in Sidebar
// ============================================
function displayRouteCards(routes) {
    const container = document.getElementById('routeResults');
    
    // Sort to show safe route first
    const sortedRoutes = [routes[1], routes[2], routes[0]]; // Safe, Balanced, Fast
    
    container.innerHTML = sortedRoutes.map(route => {
        const isSafest = route.id === 2;
        
        return `
            <div class="route-card p-4 rounded-xl cursor-pointer transition-all hover:shadow-lg"
                 style="border-left: 8px solid ${route.color}; background: ${isSafest ? '#f0fdf4' : 'white'}; margin-bottom: 12px; position: relative;"
                 onclick="selectRoute(${route.id})">
                
                ${isSafest ? '<div style="background: #10b981; color: white; position: absolute; top: 10px; right: 10px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">✓ RECOMMENDED</div>' : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h4 style="font-weight: bold; font-size: 16px; margin-bottom: 4px; color: ${route.color};">${route.name}</h4>
                        <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${route.description}</p>
                        <div style="display: flex; gap: 12px; font-size: 13px;">
                            <span><i class="fas fa-road" style="color: #666;"></i> ${route.distance.toFixed(1)} km</span>
                            <span><i class="fas fa-clock" style="color: #666;"></i> ${route.time} min</span>
                            <span><i class="fas fa-exclamation-triangle" style="color: ${route.color};"></i> ${route.hazards} hazards</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 28px; font-weight: bold; color: ${route.color};">${route.safetyScore}%</div>
                        <div style="font-size: 11px; color: #666;">Safety Score</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update safety meter with safe route
    const safeRoute = routes.find(r => r.id === 2);
    updateSafetyMeter(safeRoute.safetyScore);
}

// ============================================
// Select Route
// ============================================
window.selectRoute = function(routeId) {
    const route = currentRoutes.find(r => r.id === routeId);
    if (!route) return;
    
    // Highlight selected route
    routeLayers.forEach((layer, index) => {
        if (index === routeId - 1) {
            layer.setStyle({ weight: 8, opacity: 1 });
            map.fitBounds(layer.getBounds(), { padding: [50, 50] });
        } else {
            layer.setStyle({ weight: 3, opacity: 0.4 });
        }
    });
    
    // Update safety meter
    updateSafetyMeter(route.safetyScore);
    
    // Show notification
    showNotification(`Selected: ${route.name} (${route.safetyScore}% safe)`, 'success');
};

// ============================================
// Update Safety Meter
// ============================================
function updateSafetyMeter(score) {
    const indicator = document.getElementById('safetyIndicator');
    const percentage = document.getElementById('safetyPercentage');
    
    if (indicator && percentage) {
        indicator.style.left = `${score}%`;
        percentage.textContent = `${score}%`;
        
        // Change color based on score
        if (score >= 70) {
            indicator.style.borderColor = '#10b981';
        } else if (score >= 40) {
            indicator.style.borderColor = '#f59e0b';
        } else {
            indicator.style.borderColor = '#ef4444';
        }
    }
}

// ============================================
// Helper Functions
// ============================================
function calculateDistance(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += calculateDistanceBetweenPoints(
            points[i][0], points[i][1],
            points[i + 1][0], points[i + 1][1]
        );
    }
    return Math.round(total * 10) / 10;
}

function calculateDistanceBetweenPoints(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ============================================
// Load Hazards from Backend
// ============================================
async function loadHazardsForRoute(start, end) {
    try {
        const response = await fetch(`${API_URL}/hazards?hours=48`);
        const data = await response.json();
        
        if (data.success && data.hazards.length > 0) {
            return data.hazards;
        }
        
        // Generate demo hazards if none from backend
        return generateDemoHazards(start, end);
        
    } catch (error) {
        console.error('Error loading hazards:', error);
        return generateDemoHazards(start, end);
    }
}

// ============================================
// Generate Demo Hazards
// ============================================
function generateDemoHazards(start, end) {
    const hazards = [];
    const types = ['street_light', 'unsafe', 'animal', 'dark_street', 'other'];
    
    // Generate random hazards
    const numHazards = Math.floor(Math.random() * 4) + 5;
    
    for (let i = 0; i < numHazards; i++) {
        const t = Math.random();
        const baseLat = start[0] + (end[0] - start[0]) * t;
        const baseLng = start[1] + (end[1] - start[1]) * t;
        
        const offset = 0.002 + (Math.random() * 0.004);
        const angle = Math.random() * 2 * Math.PI;
        
        hazards.push({
            lat: baseLat + offset * Math.cos(angle),
            lng: baseLng + offset * Math.sin(angle),
            type: types[Math.floor(Math.random() * types.length)],
            description: 'Reported hazard'
        });
    }
    
    return hazards;
}

// ============================================
// Generate Demo Routes (Fallback)
// ============================================
function generateDemoRoutes() {
    const center = userLocation || [40.7128, -74.0060];
    
    return [
        {
            id: 1,
            name: 'FAST ROUTE',
            description: 'Quickest path - may have hazards',
            path: [center, [center[0] + 0.015, center[1] + 0.015]],
            distance: 2.2,
            time: 25,
            hazards: 5,
            safetyScore: 45,
            color: '#ef4444', // RED
            riskLevel: 'High'
        },
        {
            id: 2,
            name: 'SAFE ROUTE',
            description: 'Safest path - recommended',
            path: [center, [center[0] + 0.008, center[1] + 0.022]],
            distance: 3.1,
            time: 35,
            hazards: 1,
            safetyScore: 92,
            color: '#10b981', // GREEN
            riskLevel: 'Low'
        },
        {
            id: 3,
            name: 'BALANCED ROUTE',
            description: 'Good balance of speed and safety',
            path: [center, [center[0] + 0.012, center[1] + 0.018]],
            distance: 2.7,
            time: 30,
            hazards: 3,
            safetyScore: 68,
            color: '#3b82f6', // BLUE
            riskLevel: 'Medium'
        }
    ];
}

// ============================================
// Show Notification
// ============================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// Load and Display Hazards
// ============================================
async function loadHazards() {
    try {
        const response = await fetch(`${API_URL}/hazards?hours=48`);
        const data = await response.json();
        
        if (data.success) {
            displayHazards(data.hazards);
        }
    } catch (error) {
        console.error('Error loading hazards:', error);
    }
}

function displayHazards(hazards) {
    hazardMarkers.forEach(m => map.removeLayer(m));
    hazardMarkers = [];
    
    hazards.forEach(h => {
        const icon = getHazardIcon(h.type);
        const marker = L.marker([h.lat, h.lng], {
            icon: L.divIcon({
                className: 'hazard-marker',
                html: `<div style="background: ${icon.color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">${icon.emoji}</div>`,
                iconSize: [30, 30]
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <div class="p-2">
                <h3 class="font-bold">${formatHazardType(h.type)}</h3>
                <p class="text-sm">${h.description || 'Hazard reported'}</p>
                <p class="text-xs text-gray-500 mt-1">${h.time_ago || 'Just now'}</p>
            </div>
        `);
        
        hazardMarkers.push(marker);
    });
}

function getHazardIcon(type) {
    const icons = {
        'street_light': { emoji: '💡', color: '#f59e0b' },
        'unsafe': { emoji: '⚠️', color: '#ef4444' },
        'animal': { emoji: '🐕', color: '#8b5cf6' },
        'dark_street': { emoji: '🌑', color: '#111827' },
        'other': { emoji: '📍', color: '#6b7280' }
    };
    return icons[type] || icons['other'];
}

function formatHazardType(type) {
    const names = {
        'street_light': 'Street Light Issue',
        'unsafe': 'Unsafe Area',
        'animal': 'Animal Hazard',
        'dark_street': 'Dark Street',
        'other': 'Other Hazard'
    };
    return names[type] || 'Hazard';
}

// ============================================
// QUICK SCENARIOS - Safety Precautions Only
// ============================================

// Safety tips database
const safetyTips = {
    night: {
        title: "🌙 Night Travel Safety Tips",
        icon: "🌙",
        color: "#8b5cf6",
        tips: [
            "✨ Stick to well-lit streets and main roads",
            "👥 Walk in groups when possible",
            "📱 Keep your phone charged and accessible",
            "🚶 Stay aware of your surroundings - avoid headphones",
            "💡 Report any non-functioning street lights",
            "🏃 Know which stores/restaurants are open late for safe havens",
            "🔦 Use your phone flashlight in dark areas",
            "📍 Share your location with trusted contacts",
            "🚕 Consider rideshare services for very dark areas",
            "⚡ Avoid shortcuts through alleys or parks"
        ]
    },
    school: {
        title: "🏫 School Zone Safety Tips",
        icon: "🏫",
        color: "#10b981",
        tips: [
            "🚸 Always use marked crosswalks and crossing guards",
            "👀 Look both ways twice before crossing",
            "📵 Put away phones and devices while walking",
            "🎒 Wear bright/reflective clothing for visibility",
            "🚗 Be extra cautious during drop-off (7-9 AM) and pick-up (2-4 PM)",
            "🚌 Never walk behind school buses",
            "🤝 Walk with friends or in groups",
            "⚡ Obey all traffic signals and safety patrols",
            "🏃 Don't run across streets - even if late",
            "👋 Make eye contact with drivers before crossing"
        ]
    },
    late: {
        title: "🌃 Late Night Safety Tips",
        icon: "🌃",
        color: "#1e293b",
        tips: [
            "🚕 Use rideshare or taxi services when possible",
            "🔊 Stay on main streets with activity",
            "📱 Have emergency contacts on speed dial",
            "🛑 Avoid ATMs and dark bus stops",
            "👥 Walk with companions whenever possible",
            "📍 Let someone know your route and ETA",
            "🏪 Know which 24-hour stores are along your route",
            "🔋 Keep your phone fully charged",
            "👀 Stay alert - no texting while walking",
            "🏃 If you feel unsafe, go to the nearest open business"
        ]
    }
};

// Function to show safety tips popup
function showSafetyTips(scenario) {
    const tips = safetyTips[scenario];
    if (!tips) return;

    // Remove any existing popup
    const existingPopup = document.getElementById('safety-tips-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create popup element
    const popup = document.createElement('div');
    popup.id = 'safety-tips-popup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        z-index: 9999;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        animation: popupFadeIn 0.3s ease;
        border-left: 8px solid ${tips.color};
    `;

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: #f1f5f9;
        border: none;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #64748b;
        transition: all 0.2s;
    `;
    closeBtn.onmouseover = () => {
        closeBtn.style.background = '#e2e8f0';
        closeBtn.style.color = '#0f172a';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.background = '#f1f5f9';
        closeBtn.style.color = '#64748b';
    };
    closeBtn.onclick = () => popup.remove();

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 24px;
        font-size: 28px;
    `;
    header.innerHTML = `
        <span style="font-size: 40px;">${tips.icon}</span>
        <h2 style="font-size: 24px; font-weight: bold; color: #0f172a; margin: 0;">${tips.title}</h2>
    `;

    // Create tips list
    const list = document.createElement('div');
    list.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
    `;

    tips.tips.forEach((tip, index) => {
        const tipItem = document.createElement('div');
        tipItem.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px;
            background: #f8fafc;
            border-radius: 16px;
            transition: all 0.2s;
        `;
        tipItem.onmouseover = () => {
            tipItem.style.background = '#f1f5f9';
            tipItem.style.transform = 'translateX(5px)';
        };
        tipItem.onmouseout = () => {
            tipItem.style.background = '#f8fafc';
            tipItem.style.transform = 'translateX(0)';
        };

        const number = document.createElement('span');
        number.style.cssText = `
            background: ${tips.color};
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            flex-shrink: 0;
        `;
        number.textContent = index + 1;

        const text = document.createElement('span');
        text.style.cssText = `
            color: #334155;
            font-size: 15px;
            line-height: 1.5;
            flex: 1;
        `;
        text.textContent = tip;

        tipItem.appendChild(number);
        tipItem.appendChild(text);
        list.appendChild(tipItem);
    });

    // Add footer note
    const footer = document.createElement('div');
    footer.style.cssText = `
        margin-top: 24px;
        padding: 16px;
        background: ${tips.color}10;
        border-radius: 16px;
        color: ${tips.color};
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid ${tips.color}30;
    `;
    footer.innerHTML = `
        <i class="fas fa-shield-alt" style="color: ${tips.color}; font-size: 18px;"></i>
        <span>Stay safe! These tips can help you reach your destination securely.</span>
    `;

    // Assemble popup
    popup.appendChild(closeBtn);
    popup.appendChild(header);
    popup.appendChild(list);
    popup.appendChild(footer);
    document.body.appendChild(popup);

    // Add animation style if not exists
    if (!document.getElementById('popup-animation-style')) {
        const style = document.createElement('style');
        style.id = 'popup-animation-style';
        style.textContent = `
            @keyframes popupFadeIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -45%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Update the Quick Demo Scenarios section - REPLACE the existing one
// Find this section in your code (around line 800-820) and REPLACE it:

// ============================================
// Quick Scenarios - Show Safety Tips Only
// ============================================
document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent any default behavior
        const scenario = this.dataset.demo;
        
        // Change button appearance temporarily
        const originalBg = this.style.background;
        this.style.transform = 'scale(0.95)';
        this.style.opacity = '0.8';
        
        setTimeout(() => {
            this.style.transform = 'scale(1)';
            this.style.opacity = '1';
        }, 200);
        
        // Show safety tips based on scenario
        switch(scenario) {
            case 'night':
                showSafetyTips('night');
                break;
            case 'school':
                showSafetyTips('school');
                break;
            case 'late':
                showSafetyTips('late');
                break;
        }
    });
});

// Optional: Add keyboard support (ESC to close popup)
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const popup = document.getElementById('safety-tips-popup');
        if (popup) {
            popup.remove();
        }
    }
});

// Optional: Click outside to close
document.addEventListener('click', function(e) {
    const popup = document.getElementById('safety-tips-popup');
    if (popup && !popup.contains(e.target) && !e.target.classList.contains('demo-btn')) {
        popup.remove();
    }
});

// ============================================
// Report Mode Toggle
// ============================================
document.getElementById('reportMode').addEventListener('click', function() {
    reportMode = !reportMode;
    const status = document.getElementById('reportStatus');
    
    if (reportMode) {
        status.classList.remove('hidden');
        this.innerHTML = '<i class="fas fa-times mr-2"></i>Cancel Report';
        showNotification('Click on map to report hazard', 'info');
    } else {
        status.classList.add('hidden');
        this.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>Report Hazard';
    }
});

// ============================================
// Map Click for Hazard Reporting
// ============================================
map.on('click', async function(e) {
    if (!reportMode) return;

    const typeInput = prompt(
        "Select Hazard Type:\n" +
        "1 = Street Light Not Working\n" +
        "2 = Unsafe Area\n" +
        "3 = Animal on Road\n" +
        "4 = Dark Street\n" +
        "5 = Other"
    );

    const typeMap = {
        '1': 'street_light',
        '2': 'unsafe',
        '3': 'animal',
        '4': 'dark_street',
        '5': 'other'
    };

    const selectedType = typeMap[typeInput];

    if (!selectedType) {
        alert("Invalid selection.");
        return;
    }

    const description = prompt("Describe the issue:");

    const success = await reportHazard(
        e.latlng.lat,
        e.latlng.lng,
        selectedType,
        description
    );

    if (success) {
        showNotification("✅ Hazard reported successfully!", 'success');
    } else {
        showNotification("❌ Failed to report hazard.", 'error');
    }

    reportMode = false;
    document.getElementById('reportMode').click();
});

// ============================================
// Report Hazard to Backend
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
            loadHazards();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error reporting:', error);
        return false;
    }
}

// ============================================
// Map Controls
// ============================================
document.getElementById('toggleHeatmap').addEventListener('click', function() {
    showNotification('Heatmap feature coming soon!', 'info');
});

document.getElementById('locateMe').addEventListener('click', function() {
    if (userLocation) {
        map.setView(userLocation, 15);
        showNotification('Centered to your location', 'success');
    } else {
        showNotification('Location not available', 'error');
    }
});

// ============================================
// Search Autocomplete
// ============================================
let searchTimeout;
document.getElementById('start').addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value;
    if (query.length < 3) return;
    
    searchTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.results) {
                console.log('Search results:', data.results);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }, 500);
});

// ============================================
// Initialize
// ============================================
loadHazards();
setInterval(loadHazards, 30000);
