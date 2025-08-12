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
            
            // Initialize point layers
            initializePointLayers();
            
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
            // Add source if it doesn't exist
            if (!map.getSource('forest-parcels')) {
                debugLog('Adding forest parcels source with config:', sourceConfig);
                map.addSource('forest-parcels', sourceConfig);
                parcelSourceAdded = true;
            }
            
            // Find parcel-related layers in the style
            const parcelLayers = styleData.layers.filter(layer => 
                layer.id.toLowerCase().includes('forest') ||
                layer.id.toLowerCase().includes('parcel') ||
                layer.id.toLowerCase().includes('boundary') ||
                layer.id.toLowerCase().includes('limite')
            );
            
            debugLog('Found parcel layers:', parcelLayers.map(l => l.id));
            
            // Add or show the first parcel layer found
            if (parcelLayers.length > 0) {
                const layerConfig = parcelLayers[0];
                layerConfig.source = 'forest-parcels'; // Use our source
                
                if (!map.getLayer(layerConfig.id)) {
                    debugLog('Adding parcel layer:', layerConfig.id);
                    map.addLayer(layerConfig);
                } else {
                    debugLog('Showing existing parcel layer:', layerConfig.id);
                    map.setLayoutProperty(layerConfig.id, 'visibility', 'visible');
                }
                debugLog('✅ Parcel overlay added/shown successfully');
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
                parcelSourceAdded = true;
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
                } else {
                    debugLog('Showing existing parcel layer from composite:', layerConfig.id);
                    map.setLayoutProperty(layerConfig.id, 'visibility', 'visible');
                }
                debugLog('✅ Parcel overlay added/shown from composite source');
            } else {
                debugLog('No parcel layers found in composite source');
                addFallbackParcelOverlay();
            }
            
        } catch (error) {
            debugLog('Error adding parcel layers from composite:', error);
            addFallbackParcelOverlay();
        }
    }
    
    // Hide parcel overlay layers (improved approach - don't remove sources)
    function removeParcelOverlay() {
        try {
            debugLog('Hiding parcel layers...');
            
            // Hide all parcel-related layers instead of removing them
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
                    debugLog('Hiding parcel layer:', layer.id);
                    map.setLayoutProperty(layer.id, 'visibility', 'none');
                }
            });
            
            // Hide demo layers if they exist
            if (map.getLayer('demo-boundaries')) {
                debugLog('Hiding demo boundary layer');
                map.setLayoutProperty('demo-boundaries', 'visibility', 'none');
            }
            
            debugLog('✅ Parcel overlay hidden successfully');
            
        } catch (error) {
            debugLog('Error hiding parcel overlay:', error);
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
                map.setLayoutProperty('demo-boundaries', 'visibility', 'visible');
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
    
    // Initialize point layers (replaces individual marker creation)
    function initializePointLayers() {
        const types = ['exploitation', 'clearing', 'boundary'];
        const pointTypes = PointManager.getPointTypes();
        
        types.forEach(type => {
            const sourceId = `points-${type}`;
            const layerId = `points-layer-${type}`;
            const layerTextId = `points-text-${type}`;
            
            // Remove existing source and layers if they exist
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getLayer(layerTextId)) map.removeLayer(layerTextId);
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
            
            // Add circle layer for points
            map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceId,
                paint: {
                    'circle-radius': 15,
                    'circle-color': typeConfig.color,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                    'circle-opacity': 0.9
                },
                layout: {
                    'visibility': 'visible'
                }
            });
            
            // Add text layer for icons and numbers
            map.addLayer({
                id: layerTextId,
                type: 'symbol',
                source: sourceId,
                layout: {
                    'text-field': '{icon}\n{number}',
                    'text-size': 14,
                    'text-anchor': 'center',
                    'text-allow-overlap': true,
                    'text-ignore-placement': true,
                    'text-offset': [0, 0],
                    'visibility': 'visible'
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': 'rgba(0, 0, 0, 0.5)',
                    'text-halo-width': 1
                }
            });
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
            const layerTextId = `points-text-${type}`;
            const shouldShow = visibility[type];
            
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', shouldShow ? 'visible' : 'none');
            }
            if (map.getLayer(layerTextId)) {
                map.setLayoutProperty(layerTextId, 'visibility', shouldShow ? 'visible' : 'none');
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
        refreshPointMarkers
    };
})();