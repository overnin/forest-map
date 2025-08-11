// Location Module - Handles GPS tracking and geolocation
const LocationTracker = (function() {
    let watchId = null;
    let currentPosition = null;
    let isTracking = false;
    let lastUpdate = null;
    
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
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied';
                showPermissionModal();
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out';
                break;
            default:
                message = 'An unknown error occurred';
                break;
        }
        
        updateStatus(message, 'error');
        
        if (callback) {
            callback({ code: error.code, message: message });
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
    
    // Request permission explicitly
    function requestPermission(callback) {
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then(function(result) {
                if (result.state === 'granted') {
                    hidePermissionModal();
                    if (callback) callback(true);
                } else if (result.state === 'prompt') {
                    // Will prompt user
                    hidePermissionModal();
                    startTracking(
                        () => { if (callback) callback(true); },
                        () => { if (callback) callback(false); }
                    );
                } else if (result.state === 'denied') {
                    alert('Location permission denied. Please enable it in your browser settings.');
                    if (callback) callback(false);
                }
                
                // Listen for permission changes
                result.onchange = function() {
                    if (result.state === 'granted') {
                        hidePermissionModal();
                        startTracking();
                    }
                };
            });
        } else {
            // Fallback for browsers that don't support permissions API
            hidePermissionModal();
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
    
    return {
        startTracking,
        stopTracking,
        requestPermission,
        getCurrentPosition,
        isCurrentlyTracking,
        calculateDistance,
        formatCoordinates,
        updateStatus,
        hidePermissionModal
    };
})();