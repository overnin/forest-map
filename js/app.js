// Main Application Module
const ForestMapApp = (function() {
    let isInitialized = false;
    let trackingEnabled = false;
    
    // Initialize application
    function init() {
        if (isInitialized) return;
        
        console.log('Initializing Forest Map Application...');
        
        // Initialize map
        MapManager.init();
        
        // Setup event listeners
        setupEventListeners();
        
        // Check for saved preferences
        loadPreferences();
        
        // Start location tracking
        initializeLocationTracking();
        
        // Register service worker for PWA
        registerServiceWorker();
        
        isInitialized = true;
    }
    
    // Setup all event listeners
    function setupEventListeners() {
        // Locate button
        const locateBtn = document.getElementById('locate-btn');
        locateBtn.addEventListener('click', handleLocateClick);
        
        // Parcels button
        const parcelsBtn = document.getElementById('parcels-btn');
        parcelsBtn.addEventListener('click', handleParcelsClick);
        
        // Layer button
        const layerBtn = document.getElementById('layer-btn');
        layerBtn.addEventListener('click', handleLayerClick);
        
        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        fullscreenBtn.addEventListener('click', handleFullscreenClick);
        
        // Layer selector options
        const layerOptions = document.querySelectorAll('input[name="map-style"]');
        layerOptions.forEach(option => {
            option.addEventListener('change', handleLayerChange);
        });
        
        // Permission request button
        const permissionBtn = document.getElementById('request-permission');
        if (permissionBtn) {
            permissionBtn.addEventListener('click', handlePermissionRequest);
        }
        
        // Close layer selector when clicking outside
        document.addEventListener('click', (e) => {
            const layerSelector = document.getElementById('layer-selector');
            const layerBtn = document.getElementById('layer-btn');
            if (!layerSelector.contains(e.target) && e.target !== layerBtn) {
                layerSelector.classList.add('hidden');
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', handleResize);
        
        // Handle orientation change
        window.addEventListener('orientationchange', handleOrientationChange);
        
        // Handle online/offline status
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Handle visibility change (app going to background)
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // Initialize location tracking
    function initializeLocationTracking() {
        LocationTracker.startTracking(
            (position) => {
                // Success callback
                MapManager.updateUserLocation(position.lat, position.lng, position.accuracy);
                
                // Center on user location on first update
                if (!trackingEnabled) {
                    MapManager.centerOnUser(position.lat, position.lng);
                    trackingEnabled = true;
                }
            },
            (error) => {
                // Error callback
                console.error('Location error:', error);
                if (error.code === 1) { // Permission denied
                    // Show permission modal is handled in LocationTracker
                }
            }
        );
    }
    
    // Handle locate button click
    function handleLocateClick() {
        const position = LocationTracker.getCurrentPosition();
        if (position) {
            MapManager.centerOnUser(position.lat, position.lng);
            this.classList.add('active');
        } else {
            // Try to restart tracking
            initializeLocationTracking();
        }
    }
    
    // Handle parcels button click
    function handleParcelsClick() {
        const isVisible = MapManager.toggleParcels();
        
        // Update button state
        if (isVisible) {
            this.classList.add('active');
        } else {
            this.classList.remove('active');
        }
        
        // Save preference
        savePreference('parcelsVisible', isVisible);
    }
    
    // Handle layer button click
    function handleLayerClick(e) {
        e.stopPropagation();
        const layerSelector = document.getElementById('layer-selector');
        layerSelector.classList.toggle('hidden');
    }
    
    // Handle fullscreen button click
    function handleFullscreenClick() {
        MapManager.toggleFullscreen();
        
        // Update button icon based on fullscreen state
        if (document.fullscreenElement) {
            this.classList.add('active');
        } else {
            this.classList.remove('active');
        }
    }
    
    // Handle layer change
    function handleLayerChange(e) {
        const selectedStyle = e.target.value;
        MapManager.changeStyle(selectedStyle);
        savePreference('mapStyle', selectedStyle);
        
        // Hide layer selector after selection
        setTimeout(() => {
            document.getElementById('layer-selector').classList.add('hidden');
        }, 100);
    }
    
    // Handle permission request
    function handlePermissionRequest() {
        LocationTracker.requestPermission((granted) => {
            if (granted) {
                initializeLocationTracking();
            }
        });
    }
    
    // Handle window resize
    function handleResize() {
        MapManager.resize();
    }
    
    // Handle orientation change
    function handleOrientationChange() {
        setTimeout(() => {
            MapManager.resize();
        }, 200);
    }
    
    // Handle online status
    function handleOnline() {
        console.log('Application is online');
        LocationTracker.updateStatus('Online - GPS Active', 'success');
    }
    
    // Handle offline status
    function handleOffline() {
        console.log('Application is offline');
        LocationTracker.updateStatus('Offline Mode', 'warning');
    }
    
    // Handle visibility change
    function handleVisibilityChange() {
        if (document.hidden) {
            // App is in background - could pause some operations
            console.log('App moved to background');
        } else {
            // App is in foreground - resume operations
            console.log('App moved to foreground');
            MapManager.resize();
        }
    }
    
    // Save user preference
    function savePreference(key, value) {
        try {
            localStorage.setItem(`forestMap_${key}`, value);
        } catch (e) {
            console.error('Failed to save preference:', e);
        }
    }
    
    // Load user preferences
    function loadPreferences() {
        try {
            // Load map style preference
            const savedStyle = localStorage.getItem('forestMap_mapStyle');
            if (savedStyle) {
                const radioBtn = document.querySelector(`input[name="map-style"][value="${savedStyle}"]`);
                if (radioBtn) {
                    radioBtn.checked = true;
                    // Map style will be applied after map loads
                    const map = MapManager.getMap();
                    if (map) {
                        map.once('load', () => {
                            MapManager.changeStyle(savedStyle);
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load preferences:', e);
        }
    }
    
    // Register service worker for PWA functionality
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('Service Worker registered:', registration);
                    })
                    .catch(error => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }
    }
    
    // Public API
    return {
        init
    };
})();

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ForestMapApp.init);
} else {
    ForestMapApp.init();
}