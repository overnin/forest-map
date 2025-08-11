// Map Module - Handles Mapbox initialization and map-related operations
const MapManager = (function() {
    let map = null;
    let userMarker = null;
    let accuracyCircle = null;
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
    
    console.log('Map module initialized - parcelsVisible:', parcelsVisible);
    
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
            console.log('Map loaded successfully');
            setupMapEvents();
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
                console.log('Terrain configuration notice (can be ignored):', e.error.message);
                return;
            }
            // Ignore raster-emissive-strength warnings
            if (e.error && e.error.message && e.error.message.includes('raster-emissive-strength')) {
                console.log('Style property notice (can be ignored):', e.error.message);
                return;
            }
            console.error('Map error:', e.error);
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
            console.warn('Could not add accuracy circle:', e);
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
                console.warn('Error setting custom style, using fallback:', e);
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
                    console.warn('Error setting custom style, using base style:', e);
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
            console.log('Style switch completed');
        });
    }
    
    // Parcel layer overlay approach (fallback for broken custom style)
    let parcelSourceAdded = false;
    
    // Toggle parcel visibility using overlay approach
    function toggleParcels() {
        console.log('=== TOGGLE PARCELS START ===');
        console.log('Previous parcelsVisible:', parcelsVisible);
        
        parcelsVisible = !parcelsVisible;
        
        console.log('New parcelsVisible:', parcelsVisible);
        console.log('Using overlay approach instead of style switching');
        
        if (parcelsVisible) {
            console.log('Parcels ON - Adding overlay layers');
            addParcelOverlay();
        } else {
            console.log('Parcels OFF - Removing overlay layers');
            removeParcelOverlay();
        }
        
        // Re-add user marker 
        const position = LocationTracker.getCurrentPosition();
        if (position) {
            console.log('Re-adding user location');
            updateUserLocation(position.lat, position.lng, position.accuracy);
        }
        
        console.log('=== TOGGLE PARCELS COMPLETE ===');
        return parcelsVisible;
    }
    
    // Add parcel overlay layers to current map
    function addParcelOverlay() {
        console.log('Attempting to add parcel overlay...');
        
        // Fetch the custom style to extract the real source configuration
        fetch(`https://api.mapbox.com/styles/v1/oliviervernin/clzj0gc3500jw01qwhpnk7gxo?access_token=${MAPBOX_TOKEN}`)
            .then(response => {
                console.log('Style fetch response:', response.status);
                if (!response.ok) {
                    throw new Error(`Style fetch failed: ${response.status}`);
                }
                return response.json();
            })
            .then(styleData => {
                console.log('Style data received, sources:', Object.keys(styleData.sources));
                
                // Find the source that contains parcel data
                const parcelSourceKey = Object.keys(styleData.sources).find(key => 
                    key.toLowerCase().includes('forest') || 
                    key.toLowerCase().includes('parcel') ||
                    key.toLowerCase().includes('boundary')
                );
                
                if (!parcelSourceKey) {
                    console.warn('No parcel source found in style, using composite');
                    // Try using composite source
                    addParcelLayersFromComposite(styleData);
                } else {
                    console.log('Found parcel source:', parcelSourceKey);
                    const sourceConfig = styleData.sources[parcelSourceKey];
                    addParcelLayersFromSource(sourceConfig, styleData);
                }
            })
            .catch(error => {
                console.error('Error fetching style data:', error);
                console.log('Trying fallback overlay method...');
                addFallbackParcelOverlay();
            });
    }
    
    // Add parcel layers using extracted source configuration
    function addParcelLayersFromSource(sourceConfig, styleData) {
        try {
            if (!map.getSource('forest-parcels')) {
                console.log('Adding forest parcels source with config:', sourceConfig);
                map.addSource('forest-parcels', sourceConfig);
            }
            
            // Find parcel-related layers in the style
            const parcelLayers = styleData.layers.filter(layer => 
                layer.id.toLowerCase().includes('forest') ||
                layer.id.toLowerCase().includes('parcel') ||
                layer.id.toLowerCase().includes('boundary') ||
                layer.id.toLowerCase().includes('limite')
            );
            
            console.log('Found parcel layers:', parcelLayers.map(l => l.id));
            
            // Add the first parcel layer found
            if (parcelLayers.length > 0) {
                const layerConfig = parcelLayers[0];
                layerConfig.source = 'forest-parcels'; // Use our source
                
                if (!map.getLayer(layerConfig.id)) {
                    console.log('Adding parcel layer:', layerConfig.id);
                    map.addLayer(layerConfig);
                }
                console.log('✅ Parcel overlay added successfully');
            } else {
                console.warn('No parcel layers found in style');
                addFallbackParcelOverlay();
            }
            
        } catch (error) {
            console.error('Error adding parcel layers from source:', error);
            addFallbackParcelOverlay();
        }
    }
    
    // Try using composite source (fallback)
    function addParcelLayersFromComposite(styleData) {
        try {
            // Use the composite source from the style
            if (!map.getSource('forest-parcels') && styleData.sources.composite) {
                console.log('Adding composite source for parcels');
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
                    console.log('Adding parcel layer from composite:', layerConfig.id);
                    map.addLayer(layerConfig);
                }
                console.log('✅ Parcel overlay added from composite source');
            } else {
                console.warn('No parcel layers found in composite source');
                addFallbackParcelOverlay();
            }
            
        } catch (error) {
            console.error('Error adding parcel layers from composite:', error);
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
                    console.log('Removing parcel layer:', layer.id);
                    map.removeLayer(layer.id);
                }
            });
            
            // Remove demo layers if they exist
            if (map.getLayer('demo-boundaries')) {
                console.log('Removing demo boundary layer');
                map.removeLayer('demo-boundaries');
            }
            
            // Remove sources
            if (map.getSource('forest-parcels')) {
                console.log('Removing forest parcels source');
                map.removeSource('forest-parcels');
                parcelSourceAdded = false;
            }
            
            if (map.getSource('demo-parcels')) {
                console.log('Removing demo parcels source');
                map.removeSource('demo-parcels');
            }
            
            console.log('✅ Parcel overlay removed successfully');
            
        } catch (error) {
            console.error('Error removing parcel overlay:', error);
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
            
            console.log('✅ Fallback demo parcel overlay added');
            
        } catch (error) {
            console.error('Error adding fallback overlay:', error);
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
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
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
        console.log('=== CURRENT MAP LAYERS ===');
        console.log('Total layers:', layers.length);
        
        layers.forEach((layer, i) => {
            const visibility = map.getLayoutProperty(layer.id, 'visibility') || 'visible';
            console.log(`${i}: ${layer.id} (${layer.type}) - ${visibility}`);
        });
        
        const parcelLayers = layers.filter(l => 
            l.id.toLowerCase().includes('parcel') || 
            l.id.toLowerCase().includes('boundary') || 
            l.id.toLowerCase().includes('forest') ||
            l.id.toLowerCase().includes('limite')
        );
        console.log('Parcel layers:', parcelLayers.map(l => l.id));
        
        return layers;
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
        debugLayers
    };
})();