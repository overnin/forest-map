// Main Application Module
const ForestMapApp = (function() {
    let isInitialized = false;
    let trackingEnabled = false;
    
    // Production flag to control debug logging
    const DEBUG_MODE = true; // Temporarily enabled for mobile debugging
    
    function debugLog(...args) {
        if (DEBUG_MODE) {
            console.log(...args);
        }
    }
    
    // Initialize application
    function init() {
        if (isInitialized) return;
        
        debugLog('Initializing Forest Map Application...');
        
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
        
        // Handle fullscreen change events to keep button state in sync
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari
        document.addEventListener('mozfullscreenchange', handleFullscreenChange); // Firefox
        document.addEventListener('msfullscreenchange', handleFullscreenChange); // IE/Edge
        
        // Mobile-specific events
        if (isMobileDevice()) {
            // Listen for orientation change which often happens during fullscreen
            window.addEventListener('orientationchange', () => {
                setTimeout(updateFullscreenButtonState, 300);
            });
            
            // Listen for resize events which can indicate fullscreen changes on mobile
            window.addEventListener('resize', () => {
                setTimeout(updateFullscreenButtonState, 100);
            });
            
            // Periodic check for mobile devices (fallback)
            setInterval(() => {
                if (document.getElementById('fullscreen-btn')) {
                    updateFullscreenButtonState();
                }
            }, 2000);
        }
    }
    
    // Initialize location tracking
    function initializeLocationTracking() {
        // Check if HTTPS (required for geolocation on iOS)
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            debugLog('Geolocation requires HTTPS. Current protocol:', location.protocol);
            
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
            debugLog('Geolocation is not supported by this browser');
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
                debugLog('Location error:', error);
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
        debugLog('=== PARCEL BUTTON CLICKED ===');
        debugLog('Button current classes:', this.classList.toString());
        
        const isVisible = MapManager.toggleParcels();
        
        debugLog('Toggle returned isVisible:', isVisible);
        
        // Update button state
        if (isVisible) {
            debugLog('Setting button to active (parcels ON)');
            this.classList.add('active');
        } else {
            debugLog('Setting button to inactive (parcels OFF)');
            this.classList.remove('active');
        }
        
        debugLog('Button classes after update:', this.classList.toString());
        
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
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const wasActive = fullscreenBtn.classList.contains('active');
        
        debugLog('=== FULLSCREEN BUTTON CLICKED ===');
        debugLog('Button was active before click:', wasActive);
        debugLog('Is mobile device:', isMobileDevice());
        
        // Toggle the button state immediately (optimistic update)
        if (wasActive) {
            fullscreenBtn.classList.remove('active');
            debugLog('Immediately removed active class (optimistic)');
        } else {
            fullscreenBtn.classList.add('active');
            debugLog('Immediately added active class (optimistic)');
        }
        
        // Then call the fullscreen API
        MapManager.toggleFullscreen();
        
        // On mobile, add verification checks
        if (isMobileDevice()) {
            setTimeout(() => {
                debugLog('=== 200ms VERIFICATION ===');
                updateFullscreenButtonState();
            }, 200);
            
            setTimeout(() => {
                debugLog('=== 1000ms VERIFICATION ===');
                updateFullscreenButtonState();
            }, 1000);
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
        debugLog('Application is online');
        LocationTracker.updateStatus('Online - GPS Active', 'success');
    }
    
    // Handle offline status
    function handleOffline() {
        debugLog('Application is offline');
        LocationTracker.updateStatus('Offline Mode', 'warning');
    }
    
    // Handle visibility change
    function handleVisibilityChange() {
        if (document.hidden) {
            // App is in background - could pause some operations
            debugLog('App moved to background');
        } else {
            // App is in foreground - resume operations
            debugLog('App moved to foreground');
            MapManager.resize();
        }
    }
    
    // Detect mobile devices
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (window.innerWidth <= 768);
    }
    
    // Update fullscreen button state
    function updateFullscreenButtonState() {
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (!fullscreenBtn) return;
        
        // Check if we're in fullscreen mode (with broader detection for mobile)
        const isFullscreen = !!(document.fullscreenElement || 
                               document.webkitFullscreenElement || 
                               document.mozFullScreenElement || 
                               document.msFullscreenElement ||
                               // Mobile Safari specific check
                               (window.navigator.standalone) ||
                               // Screen dimension check for mobile fullscreen
                               (isMobileDevice() && window.innerHeight === screen.height));
        
        debugLog('Fullscreen state check:', {
            fullscreenElement: !!document.fullscreenElement,
            webkitFullscreenElement: !!document.webkitFullscreenElement,
            standalone: !!window.navigator.standalone,
            innerHeight: window.innerHeight,
            screenHeight: screen.height,
            isMobile: isMobileDevice(),
            isFullscreen: isFullscreen
        });
        
        if (isFullscreen) {
            fullscreenBtn.classList.add('active');
            debugLog('Entered fullscreen mode');
        } else {
            fullscreenBtn.classList.remove('active');
            debugLog('Exited fullscreen mode');
        }
    }
    
    // Handle fullscreen change events
    function handleFullscreenChange() {
        updateFullscreenButtonState();
    }
    
    // Save user preference
    function savePreference(key, value) {
        try {
            localStorage.setItem(`forestMap_${key}`, value);
        } catch (e) {
            debugLog('Failed to save preference:', e);
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
            debugLog('Failed to load preferences:', e);
        }
    }
    
    // Register service worker for PWA functionality
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        debugLog('Service Worker registered:', registration);
                    })
                    .catch(error => {
                        debugLog('Service Worker registration failed:', error);
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