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
    
    // Production flag to control debug logging - ENABLED for parcel debugging
    const DEBUG_MODE = true;
    
    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log('[MAP]', ...args);
        }
    }
    
    debugLog('Map module initialized - parcelsVisible:', parcelsVisible);
    
    // Enhanced logging function for parcel debugging
    function debugParcelState(context) {
        debugLog(`=== PARCEL STATE DEBUG (${context}) ===`);
        debugLog('parcelsVisible variable:', parcelsVisible);
        debugLog('currentBaseStyle:', currentBaseStyle);
        debugLog('isLoadingParcels:', isLoadingParcels);
        debugLog('parcelSourceAdded:', parcelSourceAdded);
        debugLog('cachedStyleData exists:', !!cachedStyleData);
        
        if (map && map.isStyleLoaded()) {
            const style = map.getStyle();
            debugLog('Current map style name:', style.name);
            debugLog('Map style loaded:', map.isStyleLoaded());
            
            // List all layers
            const layers = style.layers;
            debugLog('Total layers:', layers.length);
            
            // Find parcel-related layers
            const parcelLayers = layers.filter(layer => 
                layer.source === 'forest-parcels' ||
                layer.id.toLowerCase().includes('forest') ||
                layer.id.toLowerCase().includes('parcel') ||
                layer.id.toLowerCase().includes('boundary') ||
                layer.id.toLowerCase().includes('limite')
            );
            
            debugLog('Parcel layers found:', parcelLayers.length);
            parcelLayers.forEach(layer => {
                const visibility = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
                debugLog(`  - ${layer.id} (${layer.type}, source: ${layer.source}): ${visibility}`);
            });
            
            // Check sources
            const sources = Object.keys(style.sources);
            const parcelSources = sources.filter(s => 
                s.includes('forest') || s.includes('parcel') || s.includes('demo')
            );
            debugLog('Parcel sources:', parcelSources);
        } else {
            debugLog('Map not loaded or style not ready');
        }
        
        // Check button state
        const parcelsBtn = document.getElementById('parcels-btn');
        if (parcelsBtn) {
            debugLog('Button classes:', parcelsBtn.classList.toString());
            debugLog('Button has active:', parcelsBtn.classList.contains('active'));
        } else {
            debugLog('Parcels button not found');
        }
        
        debugLog('=== END PARCEL STATE DEBUG ===');
    }
    
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
            debugParcelState('MAP_LOADED');
            setupMapEvents();
            
            // Add custom point icons first
            addPointIcons();
            
            // Initialize point layers after a small delay to ensure icons are loaded
            setTimeout(() => {
                initializePointLayers();
            }, 500);
            
            // Initialize parcel button state to match map
            initializeParcelsButton();
            
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
    
    // Initialize parcel button state to match map state
    function initializeParcelsButton() {
        debugLog('=== INITIALIZING PARCELS BUTTON ===');
        const parcelsBtn = document.getElementById('parcels-btn');
        if (!parcelsBtn) {
            debugLog('❌ Parcels button not found during initialization');
            return;
        }
        
        debugParcelState('BUTTON_INIT_BEFORE');
        
        // Determine if parcels should be visible based on current map style
        const currentStyle = map.getStyle();
        const isCustomStyle = currentStyle.name && currentStyle.name.includes('oliviervernin');
        
        debugLog('Current style name:', currentStyle.name);
        debugLog('Is custom style (has parcels):', isCustomStyle);
        debugLog('parcelsVisible variable:', parcelsVisible);
        
        // Sync button state with actual parcel visibility
        if (parcelsVisible || isCustomStyle) {
            debugLog('Setting button to ACTIVE (parcels should be visible)');
            parcelsBtn.classList.add('active');
            parcelsVisible = true; // Ensure variable matches
        } else {
            debugLog('Setting button to INACTIVE (parcels should be hidden)');
            parcelsBtn.classList.remove('active');
            parcelsVisible = false; // Ensure variable matches
        }
        
        debugParcelState('BUTTON_INIT_AFTER');
        debugLog('=== PARCELS BUTTON INITIALIZED ===');
    }
    
    // Toggle parcel visibility using optimized overlay approach
    function toggleParcels() {
        debugLog('=== TOGGLE PARCELS START ===');
        debugParcelState('TOGGLE_START');
        
        const previousVisible = parcelsVisible;
        parcelsVisible = !parcelsVisible;
        
        debugLog('Previous parcelsVisible:', previousVisible);
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
        
        debugParcelState('TOGGLE_END');
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
            debugLog('=== DEDICATED SOURCE LAYER DETECTION ===');
            
            // Add source if it doesn't exist
            if (!map.getSource('forest-parcels')) {
                debugLog('Adding forest parcels source with config:', sourceConfig);
                map.addSource('forest-parcels', sourceConfig);
                parcelSourceAdded = true;
            }
            
            // Use CURRENT map layers instead of cached styleData.layers
            const currentLayers = map.getStyle().layers;
            debugLog('Using current map layers for dedicated source detection, total layers:', currentLayers.length);
            
            // Find parcel-related layers in the current style
            const parcelLayers = currentLayers.filter(layer => 
                layer.id.toLowerCase().includes('forest') ||
                layer.id.toLowerCase().includes('parcel') ||
                layer.id.toLowerCase().includes('boundary') ||
                layer.id.toLowerCase().includes('limite')
            );
            
            debugLog('Found dedicated source parcel layers:', parcelLayers.length);
            parcelLayers.forEach(layer => {
                const visibility = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
                debugLog(`  - ${layer.id} (${layer.type}, source: ${layer.source}): ${visibility}`);
            });
            
            // Show ALL parcel layers that match our criteria
            if (parcelLayers.length > 0) {
                let successCount = 0;
                
                parcelLayers.forEach(layer => {
                    try {
                        if (map.getLayer(layer.id)) {
                            // For layers with 'forest-parcels' source, just show them
                            if (layer.source === 'forest-parcels') {
                                debugLog('Showing existing forest-parcels layer:', layer.id);
                                if (safeSetLayerVisibility(layer.id, 'visible')) {
                                    successCount++;
                                }
                            }
                            // For other sources (like composite), try to change source and show
                            else {
                                debugLog('Updating source and showing layer:', layer.id);
                                // Note: We can't change source of existing layer, so just show it
                                if (safeSetLayerVisibility(layer.id, 'visible')) {
                                    successCount++;
                                }
                            }
                        }
                    } catch (error) {
                        debugLog('❌ Error processing layer:', layer.id, error);
                    }
                });
                
                debugLog(`✅ Successfully showed ${successCount}/${parcelLayers.length} dedicated source layers`);
                
                if (successCount > 0) {
                    debugLog('✅ Parcel overlay shown from dedicated source');
                } else {
                    debugLog('❌ Failed to show any dedicated source layers, trying composite');
                    addParcelLayersFromComposite(styleData);
                }
            } else {
                debugLog('No parcel layers found in dedicated source, trying composite');
                addParcelLayersFromComposite(styleData);
            }
            
        } catch (error) {
            debugLog('❌ Error in addParcelLayersFromSource:', error);
            addParcelLayersFromComposite(styleData);
        }
    }
    
    // Try using composite source (fallback)
    function addParcelLayersFromComposite(styleData) {
        try {
            debugLog('=== COMPOSITE LAYER DETECTION ===');
            
            // Use the composite source from the style
            if (!map.getSource('forest-parcels') && styleData.sources.composite) {
                debugLog('Adding composite source for parcels');
                map.addSource('forest-parcels', styleData.sources.composite);
                parcelSourceAdded = true;
            }
            
            // Use CURRENT map layers instead of cached styleData.layers
            const currentLayers = map.getStyle().layers;
            debugLog('Using current map layers for detection, total layers:', currentLayers.length);
            
            // Find parcel layers that use composite source from CURRENT state
            const parcelLayers = currentLayers.filter(layer => 
                layer.source === 'composite' && (
                    layer.id.toLowerCase().includes('forest') ||
                    layer.id.toLowerCase().includes('parcel') ||
                    layer.id.toLowerCase().includes('boundary') ||
                    layer.id.toLowerCase().includes('limite')
                )
            );
            
            debugLog('Found composite parcel layers:', parcelLayers.length);
            parcelLayers.forEach(layer => {
                const visibility = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
                debugLog(`  - ${layer.id} (${layer.type}, source: ${layer.source}): ${visibility}`);
            });
            
            if (parcelLayers.length > 0) {
                // Show ALL parcel layers, not just the first one
                let successCount = 0;
                parcelLayers.forEach(layer => {
                    try {
                        // For existing layers, just show them
                        if (map.getLayer(layer.id)) {
                            debugLog('Showing existing composite parcel layer:', layer.id);
                            if (safeSetLayerVisibility(layer.id, 'visible')) {
                                successCount++;
                            }
                        } else {
                            // This shouldn't happen since we got the layer from current state
                            debugLog('⚠️ Layer exists in style but not in map:', layer.id);
                        }
                    } catch (error) {
                        debugLog('❌ Error showing layer:', layer.id, error);
                    }
                });
                
                debugLog(`✅ Successfully showed ${successCount}/${parcelLayers.length} composite parcel layers`);
                
                if (successCount > 0) {
                    debugLog('✅ Parcel overlay shown from composite source');
                } else {
                    debugLog('❌ Failed to show any composite layers, using fallback');
                    addFallbackParcelOverlay();
                }
            } else {
                debugLog('No parcel layers found in composite source, using fallback');
                addFallbackParcelOverlay();
            }
            
        } catch (error) {
            debugLog('❌ Error in addParcelLayersFromComposite:', error);
            addFallbackParcelOverlay();
        }
    }
    
    // Safe layer visibility setter with error handling
    function safeSetLayerVisibility(layerId, visibility) {
        try {
            if (map.getLayer(layerId)) {
                debugLog(`Setting layer ${layerId} visibility to ${visibility}`);
                map.setLayoutProperty(layerId, 'visibility', visibility);
                
                // Verify the change was applied
                const actualVisibility = map.getLayoutProperty(layerId, 'visibility') || 'visible';
                debugLog(`✅ Layer ${layerId} visibility is now: ${actualVisibility}`);
                return true;
            } else {
                debugLog(`❌ Layer ${layerId} does not exist - cannot set visibility`);
                return false;
            }
        } catch (error) {
            debugLog(`❌ Error setting ${layerId} visibility to ${visibility}:`, error);
            return false;
        }
    }
    
    // Hide parcel overlay layers (improved approach - don't remove sources)
    function removeParcelOverlay() {
        try {
            debugLog('=== HIDING PARCEL LAYERS ===');
            debugParcelState('BEFORE_HIDE');
            
            // Hide all parcel-related layers instead of removing them
            const currentLayers = map.getStyle().layers;
            const parcelLayers = currentLayers.filter(layer => 
                layer.source === 'forest-parcels' ||
                layer.id.toLowerCase().includes('forest') ||
                layer.id.toLowerCase().includes('parcel') ||
                layer.id.toLowerCase().includes('boundary') ||
                layer.id.toLowerCase().includes('limite')
            );
            
            debugLog(`Found ${parcelLayers.length} parcel layers to hide:`, parcelLayers.map(l => l.id));
            
            let successCount = 0;
            parcelLayers.forEach(layer => {
                if (safeSetLayerVisibility(layer.id, 'none')) {
                    successCount++;
                }
            });
            
            // Hide demo layers if they exist
            if (map.getLayer('demo-boundaries')) {
                debugLog('Hiding demo boundary layer');
                safeSetLayerVisibility('demo-boundaries', 'none');
            }
            
            debugLog(`✅ Successfully hid ${successCount}/${parcelLayers.length} parcel layers`);
            debugParcelState('AFTER_HIDE');
            
        } catch (error) {
            debugLog('❌ Error hiding parcel overlay:', error);
            debugParcelState('ERROR_HIDE');
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
            } else {
                // Show existing demo layer
                debugLog('Showing existing demo boundary layer');
                safeSetLayerVisibility('demo-boundaries', 'visible');
            }
            
            debugLog('✅ Fallback demo parcel overlay added/shown');
            
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
    
    // Convert points to GeoJSON format for symbol layers
    function pointsToGeoJSON(points, type) {
        const pointTypes = PointManager.getPointTypes();
        const typeConfig = pointTypes[type];
        
        return {
            type: 'FeatureCollection',
            features: points.map(point => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [point.lng, point.lat]
                },
                properties: {
                    id: point.id,
                    type: type,
                    number: point.number,
                    icon: typeConfig.icon,
                    color: typeConfig.color,
                    notes: point.notes || '',
                    timestamp: point.timestamp,
                    accuracy: point.accuracy,
                    formattedCoords: point.formattedCoords,
                    recordedBy: point.recordedBy || 'Unknown'
                }
            }))
        };
    }
    
    // Generate custom canvas-based icons for each point type
    function generatePointIcon(type, config, number) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 32;
            canvas.width = canvas.height = size;
            
            // Clear canvas
            ctx.clearRect(0, 0, size, size);
            
            // Draw circle background
            ctx.fillStyle = config.color;
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2 - 2, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw white border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Set text properties
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw symbol based on type
            let symbol;
            switch(type) {
                case 'exploitation':
                    symbol = '$';
                    ctx.font = 'bold 18px Arial';
                    break;
                case 'clearing':
                    symbol = '✗';
                    ctx.font = 'bold 16px Arial';
                    break;
                case 'boundary':
                    symbol = '●';
                    ctx.font = 'bold 14px Arial';
                    break;
                default:
                    symbol = config.icon;
                    ctx.font = 'bold 14px Arial';
            }
            
            // Draw symbol in upper part
            ctx.fillText(symbol, size/2, size/2 - 4);
            
            // Draw number in lower part if provided
            if (number) {
                ctx.font = 'bold 10px Arial';
                ctx.fillText(number.toString(), size/2, size/2 + 8);
            }
            
            return canvas.toDataURL('image/png');
            
        } catch (error) {
            debugLog('Error generating icon for', type, ':', error);
            return null;
        }
    }
    
    // Track which icons have been successfully loaded
    let iconsLoaded = {
        exploitation: false,
        clearing: false,
        boundary: false
    };
    
    // Add generated icons to map
    function addPointIcons() {
        if (!PointManager) return;
        
        const pointTypes = PointManager.getPointTypes();
        const types = ['exploitation', 'clearing', 'boundary'];
        
        types.forEach(type => {
            try {
                const config = pointTypes[type];
                const iconData = generatePointIcon(type, config);
                
                if (iconData) {
                    const img = new Image();
                    img.onload = () => {
                        try {
                            // Add base icon without number
                            map.addImage(`point-${type}`, img);
                            iconsLoaded[type] = true;
                            debugLog(`✅ Added icon for ${type}`);
                        } catch (error) {
                            debugLog(`❌ Failed to add icon for ${type}:`, error);
                            iconsLoaded[type] = false;
                        }
                    };
                    img.onerror = () => {
                        debugLog(`❌ Failed to load generated icon for ${type}`);
                        iconsLoaded[type] = false;
                    };
                    img.src = iconData;
                } else {
                    debugLog(`❌ Failed to generate icon data for ${type}`);
                    iconsLoaded[type] = false;
                }
            } catch (error) {
                debugLog(`❌ Error processing icon for ${type}:`, error);
                iconsLoaded[type] = false;
            }
        });
    }
    
    // Check if icon is available, fallback to text if not
    function getIconImageOrFallback(type) {
        if (iconsLoaded[type] && map.hasImage(`point-${type}`)) {
            return `point-${type}`;
        }
        return null; // Will use text fallback
    }
    
    // Initialize point layers (replaces individual marker creation)
    function initializePointLayers() {
        const types = ['exploitation', 'clearing', 'boundary'];
        const pointTypes = PointManager.getPointTypes();
        
        types.forEach(type => {
            const sourceId = `points-${type}`;
            const layerId = `points-layer-${type}`;
            
            // Remove existing source and layers if they exist
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getSource(sourceId)) map.removeSource(sourceId);
            
            // Add source
            map.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: []
                }
            });
            
            const typeConfig = pointTypes[type];
            
            // Add symbol layer with custom icons and fallback
            const layerConfig = {
                id: layerId,
                type: 'symbol',
                source: sourceId,
                layout: {
                    'text-allow-overlap': true,
                    'text-ignore-placement': true,
                    'visibility': 'visible'
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': 'rgba(0, 0, 0, 0.8)',
                    'text-halo-width': 2
                }
            };
            
            // Try to use custom icon, fallback to text
            const iconImage = getIconImageOrFallback(type);
            if (iconImage) {
                // Use custom icon with number below
                layerConfig.layout['icon-image'] = iconImage;
                layerConfig.layout['icon-size'] = 1.0;
                layerConfig.layout['icon-allow-overlap'] = true;
                layerConfig.layout['icon-ignore-placement'] = true;
                layerConfig.layout['icon-anchor'] = 'center';
                layerConfig.layout['text-field'] = '{number}';
                layerConfig.layout['text-size'] = 10;
                layerConfig.layout['text-anchor'] = 'center';
                layerConfig.layout['text-offset'] = [0, 1.8];
                debugLog(`Using custom icon for ${type}`);
            } else {
                // Fallback to text-based rendering (letters + numbers)
                layerConfig.layout['text-field'] = '{icon}\n{number}';
                layerConfig.layout['text-size'] = 14;
                layerConfig.layout['text-anchor'] = 'center';
                layerConfig.layout['text-offset'] = [0, 0];
                debugLog(`Using text fallback for ${type}`);
            }
            
            map.addLayer(layerConfig);
        });
        
        // Add click handlers for popups
        setupPointClickHandlers();
    }
    
    // Setup click handlers for point layers
    function setupPointClickHandlers() {
        const types = ['exploitation', 'clearing', 'boundary'];
        
        types.forEach(type => {
            const layerId = `points-layer-${type}`;
            
            // Change cursor on hover
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
            
            // Show popup on click
            map.on('click', layerId, (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const properties = e.features[0].properties;
                
                // Find the actual point object
                const points = PointManager.getPointsByType(type);
                const point = points.find(p => p.id === properties.id);
                
                if (point) {
                    const popupContent = PointManager.createPopupContent(point);
                    
                    // Ensure that if the map is zoomed out such that multiple
                    // copies of the feature are visible, the popup appears
                    // over the copy being pointed to.
                    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                    }
                    
                    new mapboxgl.Popup({
                        closeButton: true,
                        closeOnClick: false,
                        maxWidth: '300px',
                        offset: [0, -15]
                    })
                    .setLngLat(coordinates)
                    .setHTML(popupContent)
                    .addTo(map);
                }
            });
        });
    }
    
    // Update points on map (replaces addPointMarker)
    function updatePointsLayer(type) {
        const sourceId = `points-${type}`;
        const source = map.getSource(sourceId);
        
        if (source) {
            const points = PointManager.getPointsByType(type);
            const geoJSON = pointsToGeoJSON(points, type);
            source.setData(geoJSON);
        }
    }
    
    // Point marker management functions (kept for compatibility but modified)
    function addPointMarker(point) {
        if (!point || !map) return null;
        
        // Instead of creating individual markers, update the layer
        updatePointsLayer(point.type);
        
        // Return a mock marker object for compatibility
        return {
            pointId: point.id,
            pointType: point.type,
            remove: () => removePointMarker(point.id)
        };
    }
    
    // Load all existing points on map
    function loadAllPoints() {
        if (!PointManager) return;
        
        // Initialize point layers if not already done
        if (!map.getSource('points-exploitation')) {
            initializePointLayers();
        }
        
        // Update all point layers
        ['exploitation', 'clearing', 'boundary'].forEach(type => {
            updatePointsLayer(type);
        });
        
        updatePointVisibility();
    }
    
    // Update point marker visibility based on settings
    function updatePointVisibility() {
        if (!PointManager) return;
        
        const visibility = PointManager.getVisibilitySettings();
        
        ['exploitation', 'clearing', 'boundary'].forEach(type => {
            const layerId = `points-layer-${type}`;
            const shouldShow = visibility[type];
            
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', shouldShow ? 'visible' : 'none');
            }
        });
    }
    
    // Remove point marker by ID
    function removePointMarker(pointId) {
        // Find which type this point belongs to
        let pointType = null;
        let pointFound = false;
        
        ['exploitation', 'clearing', 'boundary'].forEach(type => {
            if (!pointFound) {
                const points = PointManager.getPointsByType(type);
                const point = points.find(p => p.id === pointId);
                if (point) {
                    pointType = type;
                    pointFound = true;
                }
            }
        });
        
        // Update the layer for that type
        if (pointType) {
            updatePointsLayer(pointType);
            return true;
        }
        
        return false;
    }
    
    // Clear all point markers of a specific type
    function clearPointMarkers(type) {
        if (type) {
            // Clear specific type
            updatePointsLayer(type);
        } else {
            // Clear all types
            ['exploitation', 'clearing', 'boundary'].forEach(t => {
                updatePointsLayer(t);
            });
        }
    }
    
    // Get all point markers (returns empty array for compatibility)
    function getPointMarkers() {
        // This function is kept for compatibility but returns empty array
        // as we no longer use individual marker objects
        return [];
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
        // Reinitialize layers and reload all points
        initializePointLayers();
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
        refreshPointMarkers,
        // Debug functions
        debugParcelState,
        initializeParcelsButton
    };
})();