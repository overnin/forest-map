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
        
        // Debug button handled inline in HTML
        
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
        // Check if HTTPS (required for geolocation on iOS)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            console.warn('Geolocation requires HTTPS. Current protocol:', location.protocol);
            
            // Show warning for non-HTTPS
            const warningDiv = document.createElement('div');
            warningDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                right: 20px;
                background: #ff9800;
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 3000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            warningDiv.innerHTML = `
                <strong>HTTPS Required</strong><br>
                <small>Location services require HTTPS. Please use: ${location.href.replace('http:', 'https:')}</small>
            `;
            document.body.appendChild(warningDiv);
            
            setTimeout(() => warningDiv.remove(), 8000);
        }
        
        // Check if geolocation is available
        if (!('geolocation' in navigator)) {
            console.error('Geolocation is not supported by this browser');
            LocationTracker.updateStatus('Geolocation not supported', 'error');
            
            // Show permission modal with error
            const modal = document.getElementById('permission-modal');
            if (modal) {
                modal.classList.remove('hidden');
                const debugInfo = document.getElementById('debug-info');
                if (debugInfo) {
                    debugInfo.style.display = 'block';
                    LocationTracker.showDebugInfo();
                }
            }
            return;
        }
        
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
        console.log('=== PARCEL BUTTON CLICKED ===');
        console.log('Button current classes:', this.classList.toString());
        
        const isVisible = MapManager.toggleParcels();
        
        console.log('Toggle returned isVisible:', isVisible);
        
        // Update button state
        if (isVisible) {
            console.log('Setting button to active (parcels ON)');
            this.classList.add('active');
        } else {
            console.log('Setting button to inactive (parcels OFF)');
            this.classList.remove('active');
        }
        
        console.log('Button classes after update:', this.classList.toString());
        
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
        
        // Save the base style preference (not custom if parcels are on)
        if (selectedStyle !== 'custom') {
            savePreference('mapStyle', selectedStyle);
        }
        
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
            // Load parcel visibility preference
            const savedParcels = localStorage.getItem('forestMap_parcelsVisible');
            if (savedParcels !== null) {
                const parcelsVisible = savedParcels === 'true';
                const parcelsBtn = document.getElementById('parcels-btn');
                if (parcelsBtn) {
                    if (parcelsVisible) {
                        parcelsBtn.classList.add('active');
                    } else {
                        parcelsBtn.classList.remove('active');
                    }
                }
            }
            
            // Load map style preference
            const savedStyle = localStorage.getItem('forestMap_mapStyle');
            if (savedStyle) {
                const radioBtn = document.querySelector(`input[name="map-style"][value="${savedStyle}"]`);
                if (radioBtn) {
                    radioBtn.checked = true;
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