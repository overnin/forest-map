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
        
        currentBaseStyle = styleName;
        
        // Determine which style to actually use
        let styleToUse;
        if (parcelsVisible && styleName !== 'custom') {
            // If parcels should be visible and user selected a base style,
            // use the custom style (which includes parcels)
            styleToUse = mapStyles.custom;
        } else {
            // Otherwise use the selected style
            styleToUse = mapStyles[styleName];
        }
        
        map.setStyle(styleToUse);
        
        // Re-add user marker after style change
        map.once('style.load', () => {
            const position = LocationTracker.getCurrentPosition();
            if (position) {
                updateUserLocation(position.lat, position.lng, position.accuracy);
            }
        });
    }
    
    // Toggle parcel visibility
    function toggleParcels() {
        parcelsVisible = !parcelsVisible;
        
        if (parcelsVisible) {
            // Switch to custom style to show parcels
            map.setStyle(mapStyles.custom);
        } else {
            // Switch to the current base style without parcels
            map.setStyle(mapStyles[currentBaseStyle]);
        }
        
        // Re-add user marker after style change
        map.once('style.load', () => {
            const position = LocationTracker.getCurrentPosition();
            if (position) {
                updateUserLocation(position.lat, position.lng, position.accuracy);
            }
        });
        
        return parcelsVisible;
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
        toggleParcels
    };
})();