// Map Module - Handles Mapbox initialization and map-related operations
const MapManager = (function() {
    let map = null;
    let userMarker = null;
    let accuracyCircle = null;
    let pointMarkers = []; // Array to store all point markers
    const MAPBOX_TOKEN = 'pk.eyJ1Ijoib2xpdmllcnZlcm5pbiIsImEiOiJjaWtzNjk5MXcwYXh6dW1tMWlubTlyc2JyIn0.aub3AlNziJHJh8TvhhOUJw';
    
    // Map style URLs
    const mapStyles = {
        streets: 'mapbox://styles/mapbox/streets-v12',
        satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
        terrain: 'mapbox://styles/mapbox/outdoors-v12',
        hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
        custom: 'mapbox://styles/oliviervernin/clzj0gc3500jw01qwhpnk7gxo'
    };
    
    // Track current base style and parcel visibility
    let currentBaseStyle = 'satellite';
    let parcelsVisible = true;
    
    // Production flag to control debug logging
    const DEBUG_MODE = false;
    
    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }
    
    debugLog('Map module initialized - parcelsVisible:', parcelsVisible);
    
    // Initialize map
    function init() {
        mapboxgl.accessToken = MAPBOX_TOKEN;
        
        // Create map instance - start with custom style if parcels should be visible
        map = new mapboxgl.Map({
            container: 'map',
            style: parcelsVisible ? mapStyles.custom : mapStyles.satellite,
            center: [2.3522, 48.8566], // Default to Paris, will update with user location
            zoom: 13,
            pitch: 0,
            bearing: 0,
            attributionControl: false
        });
        
        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl({
            showCompass: true,
            showZoom: true,
            visualizePitch: true
        }), 'bottom-right');
        
        // Add scale control
        map.addControl(new mapboxgl.ScaleControl({
            maxWidth: 200,
            unit: 'metric'
        }), 'bottom-left');
        
        // Disable map rotation on mobile
        map.touchZoomRotate.disableRotation();
        
        // Map loaded event
        map.on('load', () => {
            debugLog('Map loaded successfully');
            setupMapEvents();
            
            // Load existing points after map is ready
            setTimeout(() => {
                loadAllPoints();
            }, 1000); // Small delay to ensure all modules are initialized
        });
        
        return map;
    }
    
    // Setup map event handlers
    function setupMapEvents() {
        // Track map movements
        map.on('movestart', () => {
            // User is interacting with map
            document.getElementById('locate-btn').classList.remove('active');
        });
        
        // Handle map errors
        map.on('error', (e) => {
            // Ignore terrain-related errors as they don't affect functionality
            if (e.error && e.error.message && e.error.message.includes('terrain')) {
                debugLog('Terrain configuration notice (can be ignored):', e.error.message);
                return;
            }
            // Ignore raster-emissive-strength warnings
            if (e.error && e.error.message && e.error.message.includes('raster-emissive-strength')) {
                debugLog('Style property notice (can be ignored):', e.error.message);
                return;
            }
            debugLog('Map error:', e.error);
        });
    }
    
    // Update user location on map
    function updateUserLocation(lat, lng, accuracy) {
        const coordinates = [lng, lat];
        
        // Remove existing markers
        if (userMarker) {
            userMarker.remove();
        }
        
        // Remove existing accuracy circle if it exists
        if (accuracyCircle) {
            if (map.getLayer('accuracy-circle')) {
                map.removeLayer('accuracy-circle');
            }
            if (map.getSource('accuracy-circle')) {
                map.removeSource('accuracy-circle');
            }
            accuracyCircle = false;
        }
        
        // Create user marker
        const el = document.createElement('div');
        el.className = 'user-marker';
        
        userMarker = new mapboxgl.Marker({
            element: el,
            anchor: 'center'
        })
        .setLngLat(coordinates)
        .addTo(map);
        
        // Add accuracy circle
        const accuracyInMeters = accuracy || 10;
        const metersToPixelsAtMaxZoom = (meters, latitude) => meters / 0.075 / Math.cos(latitude * Math.PI / 180);
        
        // Wait for map to be ready
        if (!map.isStyleLoaded()) {
            map.once('idle', () => {
                addAccuracyCircle(coordinates, accuracyInMeters, lat);
            });
        } else {
            addAccuracyCircle(coordinates, accuracyInMeters, lat);
        }
    }
    
    // Add accuracy circle helper
    function addAccuracyCircle(coordinates, accuracyInMeters, lat) {
        try {
            map.addSource('accuracy-circle', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coordinates
                    }
                }
            });
            
            map.addLayer({
                id: 'accuracy-circle',
                type: 'circle',
                source: 'accuracy-circle',
                paint: {
                    'circle-radius': {
                        stops: [
                            [0, 0],
                            [20, (accuracyInMeters / 0.075 / Math.cos(lat * Math.PI / 180))]
                        ],
                        base: 2
                    },
                    'circle-color': '#4285F4',
                    'circle-opacity': 0.2,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#4285F4',
                    'circle-stroke-opacity': 0.4
                }
            });
            
            accuracyCircle = true;
        } catch (e) {
            debugLog('Could not add accuracy circle:', e);
        }
    }
    
    // Center map on user location
    function centerOnUser(lat, lng) {
        map.flyTo({
            center: [lng, lat],
            zoom: 16,
            duration: 1500,
            essential: true
        });
        
        document.getElementById('locate-btn').classList.add('active');
    }
    
    // Change map style
    function changeStyle(styleName) {
        if (!mapStyles[styleName]) return;
        
        // If selecting custom style, always show it regardless of parcel toggle
        if (styleName === 'custom') {
            currentBaseStyle = styleName;
            parcelsVisible = true;
            
            // Apply style with error handling
            try {
                map.setStyle(mapStyles.custom);
            } catch (e) {
                debugLog('Error setting custom style, using fallback:', e);
                map.setStyle(mapStyles.satellite);
            }
            
            // Update parcels button to active
            const parcelsBtn = document.getElementById('parcels-btn');
            if (parcelsBtn) {
                parcelsBtn.classList.add('active');
            }
        } else {
            // For other styles, store as base style
            currentBaseStyle = styleName;
            
            // If parcels should be visible, use custom style instead
            if (parcelsVisible) {
                try {
                    map.setStyle(mapStyles.custom);
                } catch (e) {
                    debugLog('Error setting custom style, using base style:', e);
                    map.setStyle(mapStyles[styleName]);
                }
            } else {
                map.setStyle(mapStyles[styleName]);
            }
        }
        
        // Re-add user marker after style change
        map.once('style.load', () => {
            const position = LocationTracker.getCurrentPosition();
            if (position) {
                updateUserLocation(position.lat, position.lng, position.accuracy);
            }
        });
        
        // Clear any style errors after switching
        map.once('idle', () => {
            debugLog('Style switch completed');
        });
    }
    
    // Parcel layer overlay system
    let parcelSourceAdded = false;
    let cachedStyleData = null;
    let isLoadingParcels = false;
    
    // Toggle parcel visibility using optimized overlay approach
    function toggleParcels() {
        debugLog('=== TOGGLE PARCELS START ===');
        debugLog('Previous parcelsVisible:', parcelsVisible);
        
        parcelsVisible = !parcelsVisible;
        
        debugLog('New parcelsVisible:', parcelsVisible);
        debugLog('Using optimized overlay approach');
        
        if (parcelsVisible && !isLoadingParcels) {
            debugLog('Parcels ON - Adding overlay layers');
            addParcelOverlay();
        } else if (!parcelsVisible) {
            debugLog('Parcels OFF - Removing overlay layers');
            removeParcelOverlay();
        }
        
        // Re-add user marker 
        const position = LocationTracker.getCurrentPosition();
        if (position) {
            debugLog('Re-adding user location');
            updateUserLocation(position.lat, position.lng, position.accuracy);
        }
        
        debugLog('=== TOGGLE PARCELS COMPLETE ===');
        return parcelsVisible;
    }
    
    // Add parcel overlay layers to current map (optimized with caching)
    function addParcelOverlay() {
        debugLog('Attempting to add parcel overlay...');
        
        if (isLoadingParcels) {
            debugLog('Parcel loading already in progress, skipping...');
            return;
        }
        
        isLoadingParcels = true;
        
        // Use cached data if available
        if (cachedStyleData) {
            debugLog('Using cached style data');
            processStyleData(cachedStyleData);
            isLoadingParcels = false;
            return;
        }
        
        // Fetch the custom style to extract the real source configuration
        fetch(`https://api.mapbox.com/styles/v1/oliviervernin/clzj0gc3500jw01qwhpnk7gxo?access_token=${MAPBOX_TOKEN}`)
            .then(response => {
                debugLog('Style fetch response:', response.status);
                if (!response.ok) {
                    throw new Error(`Style fetch failed: ${response.status}`);
                }
                return response.json();
            })
            .then(styleData => {
                // Cache the style data for future use
                cachedStyleData = styleData;
                debugLog('Style data received and cached, sources:', Object.keys(styleData.sources));
                processStyleData(styleData);
            })
            .catch(error => {
                debugLog('Error fetching style data:', error);
                debugLog('Trying fallback overlay method...');
                addFallbackParcelOverlay();
            })
            .finally(() => {
                isLoadingParcels = false;
            });
    }
    
    // Process the style data to add parcel layers
    function processStyleData(styleData) {
        // Find the source that contains parcel data
        const parcelSourceKey = Object.keys(styleData.sources).find(key => 
            key.toLowerCase().includes('forest') || 
            key.toLowerCase().includes('parcel') ||
            key.toLowerCase().includes('boundary')
        );
        
        if (!parcelSourceKey) {
            debugLog('No parcel source found in style, using composite');
            addParcelLayersFromComposite(styleData);
        } else {
            debugLog('Found parcel source:', parcelSourceKey);
            const sourceConfig = styleData.sources[parcelSourceKey];
            addParcelLayersFromSource(sourceConfig, styleData);
        }
    }
    
    // Add parcel layers using extracted source configuration
    function addParcelLayersFromSource(sourceConfig, styleData) {
        try {
            if (!map.getSource('forest-parcels')) {
                debugLog('Adding forest parcels source with config:', sourceConfig);
                map.addSource('forest-parcels', sourceConfig);
            }
            
            // Find parcel-related layers in the style
            const parcelLayers = styleData.layers.filter(layer => 
                layer.id.toLowerCase().includes('forest') ||
                layer.id.toLowerCase().includes('parcel') ||
                layer.id.toLowerCase().includes('boundary') ||
                layer.id.toLowerCase().includes('limite')
            );
            
            debugLog('Found parcel layers:', parcelLayers.map(l => l.id));
            
            // Add the first parcel layer found
            if (parcelLayers.length > 0) {
                const layerConfig = parcelLayers[0];
                layerConfig.source = 'forest-parcels'; // Use our source
                
                if (!map.getLayer(layerConfig.id)) {
                    debugLog('Adding parcel layer:', layerConfig.id);
                    map.addLayer(layerConfig);
                }
                debugLog('✅ Parcel overlay added successfully');
            } else {
                debugLog('No parcel layers found in style');
                addFallbackParcelOverlay();
            }
            
        } catch (error) {
            debugLog('Error adding parcel layers from source:', error);
            addFallbackParcelOverlay();
        }
    }
    
    // Try using composite source (fallback)
    function addParcelLayersFromComposite(styleData) {
        try {
            // Use the composite source from the style
            if (!map.getSource('forest-parcels') && styleData.sources.composite) {
                debugLog('Adding composite source for parcels');
                map.addSource('forest-parcels', styleData.sources.composite);
            }
            
            // Find parcel layers that use composite source
            const parcelLayers = styleData.layers.filter(layer => 
                layer.source === 'composite' && (
                    layer.id.toLowerCase().includes('forest') ||
                    layer.id.toLowerCase().includes('parcel') ||
                    layer.id.toLowerCase().includes('boundary') ||
                    layer.id.toLowerCase().includes('limite')
                )
            );
            
            if (parcelLayers.length > 0) {
                const layerConfig = parcelLayers[0];
                layerConfig.source = 'forest-parcels';
                
                if (!map.getLayer(layerConfig.id)) {
                    debugLog('Adding parcel layer from composite:', layerConfig.id);
                    map.addLayer(layerConfig);
                }
                debugLog('✅ Parcel overlay added from composite source');
            } else {
                debugLog('No parcel layers found in composite source');
                addFallbackParcelOverlay();
            }
            
        } catch (error) {
            debugLog('Error adding parcel layers from composite:', error);
            addFallbackParcelOverlay();
        }
    }
    
    // Remove parcel overlay layers
    function removeParcelOverlay() {
        try {
            // Remove all parcel-related layers
            const currentLayers = map.getStyle().layers;
            const parcelLayers = currentLayers.filter(layer => 
                layer.source === 'forest-parcels' ||
                layer.id.toLowerCase().includes('forest') ||
                layer.id.toLowerCase().includes('parcel') ||
                layer.id.toLowerCase().includes('boundary') ||
                layer.id.toLowerCase().includes('limite')
            );
            
            parcelLayers.forEach(layer => {
                if (map.getLayer(layer.id)) {
                    debugLog('Removing parcel layer:', layer.id);
                    map.removeLayer(layer.id);
                }
            });
            
            // Remove demo layers if they exist
            if (map.getLayer('demo-boundaries')) {
                debugLog('Removing demo boundary layer');
                map.removeLayer('demo-boundaries');
            }
            
            // Remove sources
            if (map.getSource('forest-parcels')) {
                debugLog('Removing forest parcels source');
                map.removeSource('forest-parcels');
                parcelSourceAdded = false;
            }
            
            if (map.getSource('demo-parcels')) {
                debugLog('Removing demo parcels source');
                map.removeSource('demo-parcels');
            }
            
            debugLog('✅ Parcel overlay removed successfully');
            
        } catch (error) {
            debugLog('Error removing parcel overlay:', error);
        }
    }
    
    // Fallback method using a sample boundary
    function addFallbackParcelOverlay() {
        try {
            // Add a simple demonstration parcel boundary
            if (!map.getSource('demo-parcels')) {
                map.addSource('demo-parcels', {
                    'type': 'geojson',
                    'data': {
                        'type': 'Feature',
                        'geometry': {
                            'type': 'Polygon',
                            'coordinates': [[
                                [2.3522, 48.8566],
                                [2.3622, 48.8566],
                                [2.3622, 48.8666],
                                [2.3522, 48.8666],
                                [2.3522, 48.8566]
                            ]]
                        },
                        'properties': {
                            'name': 'Demo Forest Parcel'
                        }
                    }
                });
            }
            
            if (!map.getLayer('demo-boundaries')) {
                map.addLayer({
                    'id': 'demo-boundaries',
                    'type': 'line',
                    'source': 'demo-parcels',
                    'paint': {
                        'line-color': '#ff6600',
                        'line-width': 3,
                        'line-opacity': 0.8
                    }
                });
            }
            
            debugLog('✅ Fallback demo parcel overlay added');
            
        } catch (error) {
            debugLog('Error adding fallback overlay:', error);
        }
    }
    
    // Get map instance
    function getMap() {
        return map;
    }
    
    // Set map bounds
    function fitBounds(bounds, padding = 50) {
        map.fitBounds(bounds, {
            padding: padding,
            duration: 1000
        });
    }
    
    // Add a marker to map
    function addMarker(lat, lng, options = {}) {
        const marker = new mapboxgl.Marker(options)
            .setLngLat([lng, lat])
            .addTo(map);
        
        if (options.popup) {
            const popup = new mapboxgl.Popup({ offset: 25 })
                .setHTML(options.popup);
            marker.setPopup(popup);
        }
        
        return marker;
    }
    
    // Toggle fullscreen
    function toggleFullscreen() {
        // Check current fullscreen state across all browser APIs
        const isCurrentlyFullscreen = !!(document.fullscreenElement || 
                                        document.webkitFullscreenElement || 
                                        document.mozFullScreenElement || 
                                        document.msFullscreenElement);
        
        debugLog('toggleFullscreen called, currently fullscreen:', isCurrentlyFullscreen);
        
        if (!isCurrentlyFullscreen) {
            // Request fullscreen with browser-specific APIs
            const docEl = document.documentElement;
            
            if (docEl.requestFullscreen) {
                docEl.requestFullscreen().catch(err => {
                    debugLog('Error with requestFullscreen:', err);
                });
            } else if (docEl.webkitRequestFullscreen) {
                docEl.webkitRequestFullscreen();
            } else if (docEl.mozRequestFullScreen) {
                docEl.mozRequestFullScreen();
            } else if (docEl.msRequestFullscreen) {
                docEl.msRequestFullscreen();
            } else {
                debugLog('No fullscreen API available');
            }
        } else {
            // Exit fullscreen with browser-specific APIs
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    }
    
    // Get current map center
    function getCenter() {
        const center = map.getCenter();
        return {
            lat: center.lat,
            lng: center.lng
        };
    }
    
    // Get current zoom level
    function getZoom() {
        return map.getZoom();
    }
    
    // Resize map (useful when container changes)
    function resize() {
        map.resize();
    }
    
    // Debug function to check current layers
    function debugLayers() {
        const style = map.getStyle();
        const layers = style.layers;
        debugLog('=== CURRENT MAP LAYERS ===');
        debugLog('Total layers:', layers.length);
        
        layers.forEach((layer, i) => {
            const visibility = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
            debugLog(`${i}: ${layer.id} (${layer.type}) - ${visibility}`);
        });
        
        const parcelLayers = layers.filter(l => 
            l.id.toLowerCase().includes('parcel') || 
            l.id.toLowerCase().includes('boundary') || 
            l.id.toLowerCase().includes('forest') ||
            l.id.toLowerCase().includes('limite')
        );
        debugLog('Parcel layers:', parcelLayers.map(l => l.id));
        
        return layers;
    }
    
    // Point marker management functions
    function addPointMarker(point) {
        if (!point || !map) return null;
        
        // Create marker element
        const el = document.createElement('div');
        el.className = `point-marker marker-${point.type}`;
        
        // Get point type configuration
        const pointTypes = PointManager.getPointTypes();
        const typeConfig = pointTypes[point.type];
        
        el.innerHTML = `
            <div class="marker-icon">${typeConfig.icon}</div>
            <div class="marker-number">${point.number}</div>
        `;
        
        // Create marker
        const marker = new mapboxgl.Marker(el)
            .setLngLat([point.lng, point.lat])
            .addTo(map);
        
        // Add popup
        const popupContent = PointManager.createPopupContent(point);
        const popup = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false,
            maxWidth: '300px',
            offset: [0, -40]
        }).setHTML(popupContent);
        
        marker.setPopup(popup);
        
        // Store reference
        marker.pointId = point.id;
        marker.pointType = point.type;
        pointMarkers.push(marker);
        
        // Register with PointManager
        PointManager.addMarker(point.type, marker);
        
        // Add animation
        el.classList.add('new');
        setTimeout(() => {
            el.classList.remove('new');
        }, 500);
        
        return marker;
    }
    
    // Load all existing points on map
    function loadAllPoints() {
        if (!PointManager) return;
        
        // Clear existing markers first to ensure fresh icons
        clearPointMarkers();
        
        ['exploitation', 'clearing', 'boundary'].forEach(type => {
            const points = PointManager.getPointsByType(type);
            points.forEach(point => {
                addPointMarker(point);
            });
        });
        
        updatePointVisibility();
    }
    
    // Update point marker visibility based on settings
    function updatePointVisibility() {
        if (!PointManager) return;
        
        const visibility = PointManager.getVisibilitySettings();
        
        pointMarkers.forEach(marker => {
            if (marker.pointType) {
                const element = marker.getElement();
                const shouldShow = visibility[marker.pointType];
                element.style.display = shouldShow ? 'block' : 'none';
            }
        });
    }
    
    // Remove point marker by ID
    function removePointMarker(pointId) {
        const markerIndex = pointMarkers.findIndex(m => m.pointId === pointId);
        if (markerIndex !== -1) {
            const marker = pointMarkers[markerIndex];
            
            // Close popup if it exists and is open
            if (marker.getPopup && marker.getPopup()) {
                const popup = marker.getPopup();
                if (popup.isOpen()) {
                    popup.remove();
                }
            }
            
            // Remove marker from map
            marker.remove();
            
            // Remove from pointMarkers array
            pointMarkers.splice(markerIndex, 1);
            
            // Also remove from PointManager's marker arrays for consistency
            if (typeof PointManager !== 'undefined' && marker.pointType) {
                const pointManagerMarkers = PointManager.getMarkersByType ? PointManager.getMarkersByType(marker.pointType) : null;
                if (pointManagerMarkers) {
                    const pmIndex = pointManagerMarkers.findIndex(m => m.pointId === pointId);
                    if (pmIndex !== -1) {
                        pointManagerMarkers.splice(pmIndex, 1);
                    }
                }
            }
            
            return true;
        }
        return false;
    }
    
    // Clear all point markers of a specific type
    function clearPointMarkers(type) {
        pointMarkers = pointMarkers.filter(marker => {
            if (!type || marker.pointType === type) {
                marker.remove();
                return false;
            }
            return true;
        });
    }
    
    // Get all point markers
    function getPointMarkers() {
        return pointMarkers;
    }
    
    // Center map on a specific point
    function centerOnPoint(point) {
        if (point && map) {
            map.flyTo({
                center: [point.lng, point.lat],
                zoom: Math.max(map.getZoom(), 16),
                duration: 1000
            });
        }
    }
    
    // Refresh all point markers (useful when point type config changes)
    function refreshPointMarkers() {
        // Simply reload all points which will clear and recreate with fresh config
        loadAllPoints();
    }
    
    return {
        init,
        updateUserLocation,
        centerOnUser,
        changeStyle,
        getMap,
        fitBounds,
        addMarker,
        toggleFullscreen,
        getCenter,
        getZoom,
        resize,
        toggleParcels,
        debugLayers,
        // Point marker functions
        addPointMarker,
        loadAllPoints,
        updatePointVisibility,
        removePointMarker,
        clearPointMarkers,
        getPointMarkers,
        centerOnPoint,
        refreshPointMarkers
    };
})();