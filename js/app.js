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
        
        // Initialize internationalization
        i18n.init();
        
        // Initialize map
        MapManager.init();
        
        // Initialize user management (cleanup old names)
        UserManager.init();
        
        // Initialize point management
        PointManager.init();
        
        // Refresh map markers to ensure updated icons (like skull for clearing)
        setTimeout(() => {
            if (typeof MapManager !== 'undefined' && MapManager.refreshPointMarkers) {
                MapManager.refreshPointMarkers();
            }
        }, 2000);
        
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
        
        // Point marking functionality
        initializePointMarkingEvents();
        
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
        console.log('[APP] === PARCEL BUTTON CLICKED ===');
        console.log('[APP] Button current classes:', this.classList.toString());
        
        // Debug state before toggle
        if (typeof MapManager.debugParcelState === 'function') {
            MapManager.debugParcelState('BUTTON_CLICK_BEFORE');
        }
        
        const isVisible = MapManager.toggleParcels();
        
        console.log('[APP] Toggle returned isVisible:', isVisible);
        
        // Update button state
        if (isVisible) {
            console.log('[APP] Setting button to active (parcels ON)');
            this.classList.add('active');
        } else {
            console.log('[APP] Setting button to inactive (parcels OFF)');
            this.classList.remove('active');
        }
        
        console.log('[APP] Button classes after update:', this.classList.toString());
        
        // Debug state after toggle
        if (typeof MapManager.debugParcelState === 'function') {
            setTimeout(() => {
                MapManager.debugParcelState('BUTTON_CLICK_AFTER');
            }, 100);
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
    
    // Handle filter button click
    function handleFilterClick(e) {
        e.stopPropagation();
        const pointFilterSelector = document.getElementById('point-filter-selector');
        if (pointFilterSelector) {
            pointFilterSelector.classList.toggle('hidden');
        } else {
            console.error('Point filter selector not found');
        }
    }
    
    // Handle share button click
    function handleShareClick(e) {
        e.stopPropagation();
        
        const types = ['exploitation', 'clearing', 'boundary'];
        const totalPoints = types.reduce((sum, type) => 
            sum + PointManager.getCountByType(type), 0);
        
        if (totalPoints === 0) {
            showNotification(i18n.t('noPointsToShare'), 'error');
            return;
        }
        
        // Add sharing animation
        const shareBtn = document.getElementById('share-btn');
        shareBtn.classList.add('sharing');
        
        // Generate and share GeoJSON
        const points = PointManager.getAllPoints();
        try {
            ExportManager.exportToGeoJSON(points, types, { share: true });
        } catch (error) {
            console.error('Share failed:', error);
            showNotification(i18n.t('shareFailed'), 'error');
        } finally {
            // Remove sharing animation
            setTimeout(() => {
                shareBtn.classList.remove('sharing');
            }, 2000);
        }
    }
    
    // Handle clear all button click
    function handleClearAllClick(e) {
        e.stopPropagation();
        
        const totalPoints = ['exploitation', 'clearing', 'boundary'].reduce((sum, type) => 
            sum + PointManager.getCountByType(type), 0);
        
        if (totalPoints === 0) {
            showNotification(i18n.t('nothingToClear'), 'info');
            return;
        }
        
        // Call PointManager's clearAllPoints which handles confirmation dialog
        PointManager.clearAllPoints();
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
    
    // Point marking functionality
    function initializePointMarkingEvents() {
        const markBtn = document.getElementById('mark-btn');
        const typeSelector = document.getElementById('type-selector');
        const pointFilterSelector = document.getElementById('point-filter-selector');
        
        if (!markBtn) return;
        
        // Flag to prevent immediate popup closure on mobile
        let isTypeSelecting = false;
        
        // Flag to prevent both click and touch events from firing
        let actionExecuted = false;
        
        // Main mark button - simple click behavior
        markBtn.addEventListener('click', function(e) {
            console.log('[APP] Mark button click event triggered');
            
            // GLOBAL LOCK: Block if point creation is locked
            if (globalPointCreationLock) {
                console.log('[APP] 🔒 Mark button click BLOCKED - Global lock active');
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // Prevent duplicate execution if touchend already handled this
            if (actionExecuted) {
                console.log('[APP] Action already executed by touch handler, ignoring click');
                actionExecuted = false; // Reset for next interaction
                return;
            }
            
            if (e.shiftKey || !PointManager.hasSelectedType()) {
                // Show type selector
                isTypeSelecting = true;
                toggleTypeSelector();
            } else {
                // Mark point with current type
                markPointAtCurrentLocation();
            }
        });
        
        // Long press for type selector (always shows selector regardless of current state)
        let pressTimer;
        let longPressTriggered = false;
        let touchStartTime = 0;
        
        markBtn.addEventListener('touchstart', function(e) {
            // GLOBAL LOCK: Block if point creation is locked
            if (globalPointCreationLock) {
                console.log('[APP] 🔒 Mark button touchstart BLOCKED - Global lock active');
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            touchStartTime = Date.now();
            longPressTriggered = false;
            markBtn.classList.add('long-press-active');
            pressTimer = setTimeout(() => {
                // Double-check global lock hasn't been activated during timeout
                if (globalPointCreationLock) {
                    console.log('[APP] 🔒 Long press action BLOCKED - Global lock activated during timeout');
                    markBtn.classList.remove('long-press-active');
                    return;
                }
                
                longPressTriggered = true;
                markBtn.classList.remove('long-press-active');
                isTypeSelecting = true;
                toggleTypeSelector();
                // Add haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, 400);
        }, { passive: false }); // Changed to false to allow preventDefault
        
        markBtn.addEventListener('touchend', function(e) {
            const touchDuration = Date.now() - touchStartTime;
            clearTimeout(pressTimer);
            markBtn.classList.remove('long-press-active');
            
            // GLOBAL LOCK: Block if point creation is locked
            if (globalPointCreationLock) {
                console.log('[APP] 🔒 Mark button touchend BLOCKED - Global lock active');
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // If it was a long press, prevent the click
            if (longPressTriggered) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // If it was a short press (under 400ms), trigger the normal action
            if (touchDuration < 400) {
                console.log('[APP] Touch end event - executing action');
                actionExecuted = true; // Prevent click handler from also executing
                
                // Prevent click handler from closing type selector immediately
                if (!PointManager.hasSelectedType()) {
                    isTypeSelecting = true;
                }
                
                // Execute action immediately (no setTimeout delay to reduce chance of conflicts)
                if (!PointManager.hasSelectedType()) {
                    toggleTypeSelector();
                } else {
                    markPointAtCurrentLocation();
                }
                
                // Reset actionExecuted flag after a short delay
                setTimeout(() => {
                    actionExecuted = false;
                }, 100);
            }
        });
        
        markBtn.addEventListener('touchcancel', function() {
            clearTimeout(pressTimer);
            markBtn.classList.remove('long-press-active');
            longPressTriggered = false;
        });
        
        // Type selection buttons
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                console.log('[APP] Type button clicked:', this.dataset.type);
                
                const type = this.dataset.type;
                PointManager.setCurrentType(type);
                updateTypeIndicator(type);
                updateTypeButtonStates(type);
                hideTypeSelector();
                
                // Add small delay on mobile to ensure type selector is fully hidden before creating point
                if (isMobileDevice()) {
                    setTimeout(() => {
                        console.log('[APP] Creating point after mobile type selection');
                        markPointAtCurrentLocation();
                    }, 100);
                } else {
                    console.log('[APP] Creating point after desktop type selection');
                    markPointAtCurrentLocation();
                }
            });
        });
        
        // Filter checkboxes and type switching
        ['exploitation', 'clearing', 'boundary'].forEach(type => {
            const checkbox = document.getElementById(`show-${type}`);
            const filterItem = checkbox ? checkbox.closest('.filter-item') : null;
            
            if (checkbox) {
                // Checkbox functionality
                checkbox.addEventListener('change', function() {
                    PointManager.toggleTypeVisibility(type);
                    updateMarkerVisibility();
                });
                
                // Long press on filter item to select as current type
                if (filterItem) {
                    let filterPressTimer;
                    let filterLongPressTriggered = false;
                    
                    filterItem.addEventListener('touchstart', function(e) {
                        filterLongPressTriggered = false;
                        filterItem.classList.add('long-press-active');
                        filterPressTimer = setTimeout(() => {
                            filterLongPressTriggered = true;
                            filterItem.classList.remove('long-press-active');
                            PointManager.setCurrentType(type);
                            updateTypeIndicator(type);
                            updateTypeButtonStates(type);
                            showNotification(`Selected ${PointManager.getPointTypes()[type].getLabel()} as current type`, 'success');
                            // Add haptic feedback
                            if (navigator.vibrate) {
                                navigator.vibrate(50);
                            }
                        }, 400);
                    }, { passive: true });
                    
                    filterItem.addEventListener('touchend', function(e) {
                        clearTimeout(filterPressTimer);
                        filterItem.classList.remove('long-press-active');
                        if (filterLongPressTriggered) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    });
                    
                    filterItem.addEventListener('touchcancel', function() {
                        clearTimeout(filterPressTimer);
                        filterItem.classList.remove('long-press-active');
                        filterLongPressTriggered = false;
                    });
                    
                    // Keep right-click for desktop
                    filterItem.addEventListener('contextmenu', function(e) {
                        e.preventDefault();
                        PointManager.setCurrentType(type);
                        updateTypeIndicator(type);
                        updateTypeButtonStates(type);
                        showNotification(`Selected ${PointManager.getPointTypes()[type].getLabel()} as current type`, 'success');
                    });
                }
            }
        });
        
        // Filter button
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            filterBtn.addEventListener('click', handleFilterClick);
        } else {
            console.warn('Filter button not found during initialization');
        }
        
        // Share button
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', handleShareClick);
        } else {
            console.warn('Share button not found during initialization');
        }
        
        // Clear all button
        const clearAllBtn = document.getElementById('clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', handleClearAllClick);
        } else {
            console.warn('Clear all button not found during initialization');
        }
        
        // Close panels when clicking outside        
        document.addEventListener('click', function(e) {
            // Prevent immediate closing when type selector was just opened on mobile
            if (isTypeSelecting) {
                isTypeSelecting = false;
                return;
            }
            
            if (!typeSelector.contains(e.target) && !markBtn.contains(e.target)) {
                hideTypeSelector();
            }
            
            const filterBtn = document.getElementById('filter-btn');
            if (pointFilterSelector && filterBtn && 
                !pointFilterSelector.contains(e.target) && 
                !filterBtn.contains(e.target)) {
                pointFilterSelector.classList.add('hidden');
            }
        });
        
        // Export functionality - long press on status
        const pointsSummary = document.getElementById('points-summary');
        if (pointsSummary) {
            let exportPressTimer;
            pointsSummary.addEventListener('touchstart', function() {
                exportPressTimer = setTimeout(() => {
                    ExportManager.showExportDialog();
                }, 1000);
            });
            pointsSummary.addEventListener('touchend', function() {
                clearTimeout(exportPressTimer);
            });
        }
        
        // Long press and click on type indicator to change type
        let indicatorPressTimer;
        let indicatorLongPressTriggered = false;
        
        document.addEventListener('touchstart', function(e) {
            if (e.target.classList.contains('type-indicator')) {
                indicatorLongPressTriggered = false;
                indicatorPressTimer = setTimeout(() => {
                    indicatorLongPressTriggered = true;
                    isTypeSelecting = true;
                    toggleTypeSelector();
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, 400);
            }
        }, { passive: true });
        
        document.addEventListener('touchend', function(e) {
            if (e.target.classList.contains('type-indicator')) {
                clearTimeout(indicatorPressTimer);
                if (indicatorLongPressTriggered) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        });
        
        document.addEventListener('touchcancel', function(e) {
            if (e.target.classList.contains('type-indicator')) {
                clearTimeout(indicatorPressTimer);
                indicatorLongPressTriggered = false;
            }
        });
        
        // Click on type indicator for desktop
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('type-indicator')) {
                isTypeSelecting = true;
                toggleTypeSelector();
            }
        });
    }
    
    // Toggle type selector visibility
    function toggleTypeSelector() {
        const typeSelector = document.getElementById('type-selector');
        if (typeSelector) {
            typeSelector.classList.toggle('hidden');
        }
    }
    
    // Hide type selector
    function hideTypeSelector() {
        const typeSelector = document.getElementById('type-selector');
        if (typeSelector) {
            typeSelector.classList.add('hidden');
        }
    }
    
    // Update type indicator on mark button
    function updateTypeIndicator(type) {
        const indicator = document.querySelector('#mark-btn .type-indicator');
        if (indicator && type) {
            const pointTypes = PointManager.getPointTypes();
            indicator.textContent = pointTypes[type].icon;
            indicator.style.display = 'inline-block';
            indicator.style.backgroundColor = pointTypes[type].color;
        }
        
        // Update filter panel current type indicator
        document.querySelectorAll('.filter-item').forEach(item => {
            item.classList.remove('current-type');
        });
        
        if (type) {
            const currentFilterItem = document.querySelector(`#show-${type}`)?.closest('.filter-item');
            if (currentFilterItem) {
                currentFilterItem.classList.add('current-type');
            }
        }
    }
    
    // Update type button active states
    function updateTypeButtonStates(activeType) {
        document.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === activeType) {
                btn.classList.add('active');
            }
        });
    }
    
    // GLOBAL Point creation protection - prevents ALL creation during cooldown
    let globalPointCreationLock = false;
    let globalLastPointCreationTime = 0;
    let pointCreationCallCount = 0;
    const GLOBAL_POINT_CREATION_COOLDOWN = isMobileDevice() ? 3000 : 1500; // Very long cooldown for mobile
    
    // Block ALL touch events during point creation
    function blockAllTouchEvents(event) {
        if (globalPointCreationLock) {
            console.log(`[APP] 🚫 GLOBAL LOCK: Blocking ${event.type} event during point creation cooldown`);
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            return false;
        }
    }
    
    // Add global touch event blockers for mobile
    if (isMobileDevice()) {
        ['touchstart', 'touchend', 'touchmove', 'click'].forEach(eventType => {
            document.addEventListener(eventType, blockAllTouchEvents, { capture: true, passive: false });
        });
    }
    
    // Mark point at current location
    function markPointAtCurrentLocation() {
        pointCreationCallCount++;
        const callId = pointCreationCallCount;
        console.log(`[APP] markPointAtCurrentLocation called (#${callId})`);
        
        // GLOBAL LOCK: Check if creation is completely blocked
        if (globalPointCreationLock) {
            console.log(`[APP] 🔒 Call #${callId} BLOCKED - Global point creation lock active`);
            return;
        }
        
        // GLOBAL COOLDOWN: Check global cooldown timer
        const now = Date.now();
        const timeSinceLastCreation = now - globalLastPointCreationTime;
        if (timeSinceLastCreation < GLOBAL_POINT_CREATION_COOLDOWN) {
            console.log(`[APP] ⏱️ Call #${callId} BLOCKED - Global cooldown active (${GLOBAL_POINT_CREATION_COOLDOWN - timeSinceLastCreation}ms remaining)`);
            return;
        }
        
        if (!PointManager.isGPSAvailable()) {
            showNotification(i18n.t('gpsRequired'), 'error');
            return;
        }
        
        const type = PointManager.getCurrentType();
        if (!type) {
            toggleTypeSelector();
            return;
        }
        
        // ACTIVATE GLOBAL LOCK - blocks ALL events on mobile
        globalPointCreationLock = true;
        globalLastPointCreationTime = now;
        console.log('[APP] 🔒 GLOBAL LOCK ACTIVATED - Blocking all touch events for mobile');
        
        // Set timeout to release global lock
        const lockDuration = isMobileDevice() ? 3000 : 1500;
        setTimeout(() => {
            globalPointCreationLock = false;
            console.log('[APP] 🔓 GLOBAL LOCK RELEASED after', lockDuration, 'ms');
        }, lockDuration);
        
        console.log('[APP] 🔄 Starting point creation process');
        
        // Update button state to show creation in progress
        updateMarkButtonState('creating');
        
        const result = PointManager.markPoint(type);
        
        // Handle both synchronous and asynchronous results
        if (result instanceof Promise) {
            result.then(point => {
                if (point) {
                    handlePointCreated(point, type);
                    updateMarkButtonState('success');
                } else {
                    updateMarkButtonState('error');
                }
                console.log('[APP] ✅ Point creation process completed (async)');
            }).catch(error => {
                console.error('[APP] ❌ Point creation failed:', error);
                updateMarkButtonState('error');
                // Release global lock early on error
                globalPointCreationLock = false;
                console.log('[APP] 🔓 GLOBAL LOCK RELEASED early due to error');
            });
        } else if (result) {
            handlePointCreated(result, type);
            updateMarkButtonState('success');
            console.log('[APP] ✅ Point creation process completed (sync)');
        } else {
            updateMarkButtonState('error');
            console.log('[APP] ❌ Point creation failed (sync)');
            // Release global lock early on error
            globalPointCreationLock = false;
            console.log('[APP] 🔓 GLOBAL LOCK RELEASED early due to error');
        }
    }
    
    // Update mark button visual state
    function updateMarkButtonState(state) {
        const markBtn = document.getElementById('mark-btn');
        if (!markBtn) return;
        
        // Reset classes
        markBtn.classList.remove('creating', 'success', 'error');
        markBtn.disabled = false;
        
        switch (state) {
            case 'creating':
                markBtn.classList.add('creating');
                markBtn.disabled = true;
                markBtn.style.opacity = '0.7';
                console.log('[APP] 🔄 Mark button set to creating state');
                break;
                
            case 'success':
                markBtn.classList.add('success');
                markBtn.style.opacity = '1';
                // Brief success indication
                setTimeout(() => {
                    markBtn.classList.remove('success');
                }, 1500);
                console.log('[APP] ✅ Mark button set to success state');
                break;
                
            case 'error':
                markBtn.classList.add('error');
                markBtn.style.opacity = '1';
                // Brief error indication
                setTimeout(() => {
                    markBtn.classList.remove('error');
                }, 2000);
                console.log('[APP] ❌ Mark button set to error state');
                break;
                
            default:
                markBtn.style.opacity = '1';
                console.log('[APP] 🔄 Mark button reset to default state');
        }
    }
    
    // Handle successful point creation
    function handlePointCreated(point, type) {
        // Add point to map
        addPointToMap(point);
        
        // Update UI
        PointManager.updateUI();
        
        // Show success notification
        const pointTypes = PointManager.getPointTypes();
        const message = i18n.t('pointMarked', {
            type: pointTypes[type].getLabel(),
            number: point.number
        });
        showNotification(message, 'success');
    }
    
    // Add point to map
    function addPointToMap(point) {
        if (typeof MapManager !== 'undefined' && MapManager.addPointMarker) {
            MapManager.addPointMarker(point);
        }
    }
    
    // Update marker visibility on map
    function updateMarkerVisibility() {
        if (typeof MapManager !== 'undefined' && MapManager.updatePointVisibility) {
            MapManager.updatePointVisibility();
        }
    }
    
    // Show notification
    function showNotification(message, type = 'info') {
        // Use existing LocationTracker status system if available
        if (typeof LocationTracker !== 'undefined' && LocationTracker.updateStatus) {
            LocationTracker.updateStatus(message, type);
        } else {
            // Fallback notification
            console.log(`[${type.toUpperCase()}] ${message}`);
            
            // Create temporary visual notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
                color: white;
                padding: 10px 20px;
                border-radius: 4px;
                z-index: 3000;
                font-size: 14px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
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