// Location Module - Handles GPS tracking and geolocation
const LocationTracker = (function() {
    let watchId = null;
    let currentPosition = null;
    let isTracking = false;
    let lastUpdate = null;
    let lastError = null;
    
    // Configuration
    const config = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        minUpdateInterval: 1000 // Minimum time between updates (ms)
    };
    
    // Start tracking user location
    function startTracking(onSuccess, onError) {
        if (!navigator.geolocation) {
            onError({ code: 0, message: 'Geolocation is not supported by this browser.' });
            return;
        }
        
        // Clear any existing watch
        if (watchId !== null) {
            stopTracking();
        }
        
        isTracking = true;
        updateStatus('Acquiring GPS signal...');
        
        // Watch position
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                handlePositionUpdate(position, onSuccess);
            },
            (error) => {
                handlePositionError(error, onError);
            },
            config
        );
        
        // Also get current position immediately
        navigator.geolocation.getCurrentPosition(
            (position) => {
                handlePositionUpdate(position, onSuccess);
            },
            (error) => {
                handlePositionError(error, onError);
            },
            config
        );
    }
    
    // Stop tracking
    function stopTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        isTracking = false;
        updateStatus('GPS tracking stopped');
    }
    
    // Handle position update
    function handlePositionUpdate(position, callback) {
        const now = Date.now();
        
        // Throttle updates
        if (lastUpdate && (now - lastUpdate) < config.minUpdateInterval) {
            return;
        }
        
        lastUpdate = now;
        
        currentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
        };
        
        // Update UI
        updateStatus('GPS Active', 'success');
        updateAccuracy(position.coords.accuracy);
        updateCoordinates(position.coords.latitude, position.coords.longitude);
        
        // Callback
        if (callback) {
            callback(currentPosition);
        }
    }
    
    // Handle position error
    function handlePositionError(error, callback) {
        let message = '';
        let detailedMessage = '';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied';
                detailedMessage = 'Please enable location services in Settings > Privacy > Location Services';
                showPermissionModal();
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                detailedMessage = 'GPS signal not available. Try moving to an open area.';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out';
                detailedMessage = 'GPS is taking too long. Please try again.';
                break;
            default:
                message = 'An unknown error occurred';
                detailedMessage = `Error code: ${error.code}, Message: ${error.message}`;
                break;
        }
        
        updateStatus(message, 'error');
        
        // Track error for debug
        lastError = `Code ${error.code}: ${message}`;
        
        // Show detailed error in modal for iOS
        if (isIOS()) {
            showErrorModal(message, detailedMessage);
        }
        
        // Log to console for debugging
        console.error('Geolocation Error:', error.code, error.message);
        
        if (callback) {
            callback({ code: error.code, message: message, detailed: detailedMessage });
        }
    }
    
    // Update GPS status in UI
    function updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('gps-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = 'status-value';
            
            if (type === 'success') {
                statusElement.style.color = '#4CAF50';
            } else if (type === 'error') {
                statusElement.style.color = '#f44336';
            } else {
                statusElement.style.color = '#2196F3';
            }
        }
    }
    
    // Update accuracy display
    function updateAccuracy(accuracy) {
        const accuracyElement = document.getElementById('accuracy-status');
        if (accuracyElement) {
            if (accuracy) {
                const accuracyText = accuracy < 10 ? 'High' : accuracy < 30 ? 'Medium' : 'Low';
                accuracyElement.textContent = `±${Math.round(accuracy)}m (${accuracyText})`;
            } else {
                accuracyElement.textContent = '--';
            }
        }
    }
    
    // Update coordinates display
    function updateCoordinates(lat, lng) {
        const coordsElement = document.getElementById('coords-status');
        if (coordsElement) {
            coordsElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    }
    
    // Show permission modal
    function showPermissionModal() {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    // Hide permission modal
    function hidePermissionModal() {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    // Detect if iOS
    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }
    
    // Show error modal with detailed message
    function showErrorModal(title, message) {
        // Create or update error display
        let errorDiv = document.getElementById('error-display');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-display';
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 20px;
                right: 20px;
                background: #ff5252;
                color: white;
                padding: 15px;
                border-radius: 8px;
                z-index: 3000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(errorDiv);
        }
        
        errorDiv.innerHTML = `
            <strong>${title}</strong><br>
            <small>${message}</small><br>
            <small style="opacity: 0.8;">Device: ${navigator.userAgent}</small>
        `;
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.remove();
            }
        }, 10000);
    }
    
    // Request permission explicitly
    function requestPermission(callback) {
        console.log('Requesting location permission...');
        console.log('User Agent:', navigator.userAgent);
        console.log('Geolocation available:', 'geolocation' in navigator);
        
        hidePermissionModal();
        
        // For iOS Safari, we need to request permission directly through getCurrentPosition
        if (isIOS()) {
            console.log('iOS detected, using direct getCurrentPosition for permission');
            
            // Show loading message
            updateStatus('Requesting location access...', 'info');
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('iOS: Location permission granted');
                    updateStatus('Location permission granted', 'success');
                    handlePositionUpdate(position);
                    if (callback) callback(true);
                    
                    // Now start continuous tracking
                    startTracking();
                },
                (error) => {
                    console.error('iOS: Location permission error:', error);
                    
                    if (error.code === 1) {
                        showErrorModal(
                            'Location Access Required',
                            'Please enable location for Safari: Settings > Privacy & Security > Location Services > Safari Websites > While Using App'
                        );
                    } else {
                        handlePositionError(error);
                    }
                    
                    if (callback) callback(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else if (navigator.permissions && navigator.permissions.query) {
            // For other browsers that support Permissions API
            navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
                console.log('Permission state:', result.state);
                
                if (result.state === 'granted') {
                    hidePermissionModal();
                    if (callback) callback(true);
                    startTracking();
                } else if (result.state === 'prompt') {
                    // Will prompt user
                    startTracking(
                        () => { if (callback) callback(true); },
                        () => { if (callback) callback(false); }
                    );
                } else if (result.state === 'denied') {
                    showErrorModal(
                        'Location Permission Denied',
                        'Please enable location in your browser settings and reload the page.'
                    );
                    if (callback) callback(false);
                }
                
                // Listen for permission changes
                result.onchange = function() {
                    if (result.state === 'granted') {
                        hidePermissionModal();
                        startTracking();
                    }
                };
            }).catch(err => {
                console.error('Permissions API error:', err);
                // Fallback to direct request
                startTracking(
                    () => { if (callback) callback(true); },
                    () => { if (callback) callback(false); }
                );
            });
        } else {
            // Fallback for browsers that don't support permissions API
            console.log('Permissions API not supported, using fallback');
            startTracking(
                () => { if (callback) callback(true); },
                () => { if (callback) callback(false); }
            );
        }
    }
    
    // Get current position
    function getCurrentPosition() {
        return currentPosition;
    }
    
    // Check if currently tracking
    function isCurrentlyTracking() {
        return isTracking;
    }
    
    // Calculate distance between two points (Haversine formula)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c; // Distance in meters
    }
    
    // Format coordinates for display
    function formatCoordinates(lat, lng, format = 'decimal') {
        if (format === 'dms') {
            // Degrees Minutes Seconds format
            const latDMS = convertToDMS(lat, lat >= 0 ? 'N' : 'S');
            const lngDMS = convertToDMS(lng, lng >= 0 ? 'E' : 'W');
            return `${latDMS} ${lngDMS}`;
        } else {
            // Decimal format
            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    }
    
    // Convert decimal degrees to DMS
    function convertToDMS(coord, direction) {
        const absolute = Math.abs(coord);
        const degrees = Math.floor(absolute);
        const minutesNotTruncated = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesNotTruncated);
        const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
        
        return `${degrees}°${minutes}'${seconds}"${direction}`;
    }
    
    // Show debug information
    function showDebugInfo() {
        const debugContent = document.getElementById('debug-content');
        if (!debugContent) {
            console.error('Debug content element not found');
            return;
        }
        
        // Get user agent details
        const ua = navigator.userAgent;
        const isIOSSafari = isIOS() && ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1;
        const iOSVersion = isIOS() ? (ua.match(/OS (\d+)_(\d+)/) || ['', '?', '?'])[1] + '.' + (ua.match(/OS (\d+)_(\d+)/) || ['', '?', '?'])[2] : 'N/A';
        
        const info = {
            'Protocol': location.protocol,
            'HTTPS': location.protocol === 'https:' ? '✅ Yes' : '❌ No (Required for iOS)',
            'Hostname': location.hostname,
            'iOS Device': isIOS() ? '✅ Yes' : '❌ No',
            'iOS Version': iOSVersion,
            'Safari': isIOSSafari ? '✅ Yes' : '❌ No',
            'Geolocation API': 'geolocation' in navigator ? '✅ Available' : '❌ Not Available',
            'Permissions API': 'permissions' in navigator ? '✅ Available' : '⚠️ Not Available (Normal for iOS)',
            'Current Position': currentPosition ? `📍 ${currentPosition.lat.toFixed(4)}, ${currentPosition.lng.toFixed(4)}` : '❌ Not available',
            'Accuracy': currentPosition ? `±${Math.round(currentPosition.accuracy)}m` : 'N/A',
            'Tracking Active': isTracking ? '✅ Yes' : '❌ No',
            'Last Error': lastError || 'None',
            'User Agent': ua.substring(0, 100) + '...'
        };
        
        let html = '<table style="width: 100%; font-size: 11px; line-height: 1.4;">';
        for (const [key, value] of Object.entries(info)) {
            const bgColor = value.includes('❌') ? '#ffebee' : value.includes('✅') ? '#e8f5e9' : 'transparent';
            html += `<tr style="background: ${bgColor};"><td style="padding: 3px; font-weight: bold; vertical-align: top;">${key}:</td><td style="padding: 3px; word-break: break-word;">${value}</td></tr>`;
        }
        html += '</table>';
        
        // Add instructions based on detected issues
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            html += '<div style="margin-top: 10px; padding: 8px; background: #fff3e0; border-radius: 4px; font-size: 11px;"><strong>⚠️ HTTPS Required:</strong> iOS requires HTTPS for location services. Please use the HTTPS version of this page.</div>';
        }
        
        if (isIOS() && !currentPosition) {
            html += '<div style="margin-top: 10px; padding: 8px; background: #e3f2fd; border-radius: 4px; font-size: 11px;"><strong>📱 iOS Instructions:</strong><br>1. Settings → Privacy & Security → Location Services<br>2. Enable Location Services<br>3. Find Safari Websites → Set to "While Using App"<br>4. Return here and tap "Enable Location"</div>';
        }
        
        debugContent.innerHTML = html;
        console.log('Debug info updated:', info);
    }
    
    return {
        startTracking,
        stopTracking,
        requestPermission,
        getCurrentPosition,
        isCurrentlyTracking,
        calculateDistance,
        formatCoordinates,
        updateStatus,
        hidePermissionModal,
        showDebugInfo
    };
})();