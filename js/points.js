// Point Management module for Forest Map
const PointManager = (function() {
    // Private state
    let points = {
        exploitation: [],
        clearing: [],
        boundary: []
    };
    
    let counters = {
        exploitation: 0,
        clearing: 0,
        boundary: 0
    };
    
    let settings = {
        currentType: null,
        visibility: {
            exploitation: true,
            clearing: true,
            boundary: true
        }
    };
    
    let markers = {
        exploitation: [],
        clearing: [],
        boundary: []
    };
    
    // Point type configuration - uses i18n for labels
    const POINT_TYPES = {
        exploitation: {
            getLabel: () => i18n.t('exploitation'),
            icon: 'E',
            color: '#FF6B35',
            getDescription: () => i18n.t('exploitationDesc')
        },
        clearing: {
            getLabel: () => i18n.t('clearing'),
            icon: 'C',
            color: '#DC143C',
            getDescription: () => i18n.t('clearingDesc')
        },
        boundary: {
            getLabel: () => i18n.t('boundary'),
            icon: 'B',
            color: '#4169E1',
            getDescription: () => i18n.t('boundaryDesc')
        }
    };
    
    // Private methods
    function generateId() {
        return 'point_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    function formatCoordinates(lat, lng) {
        return lat.toFixed(6) + ', ' + lng.toFixed(6);
    }
    
    function saveToLocalStorage(type) {
        try {
            localStorage.setItem(`forestMap_points_${type}`, JSON.stringify(points[type]));
            localStorage.setItem(`forestMap_points_counters`, JSON.stringify(counters));
        } catch (e) {
            console.error('Failed to save points to localStorage:', e);
        }
    }
    
    function loadFromLocalStorage() {
        try {
            // Load points for each type
            ['exploitation', 'clearing', 'boundary'].forEach(type => {
                const stored = localStorage.getItem(`forestMap_points_${type}`);
                if (stored) {
                    points[type] = JSON.parse(stored);
                }
            });
            
            // Load counters
            const storedCounters = localStorage.getItem(`forestMap_points_counters`);
            if (storedCounters) {
                counters = JSON.parse(storedCounters);
            } else {
                // Recalculate counters from points
                ['exploitation', 'clearing', 'boundary'].forEach(type => {
                    if (points[type].length > 0) {
                        counters[type] = Math.max(...points[type].map(p => p.number));
                    }
                });
            }
            
            // Load settings
            const storedSettings = localStorage.getItem(`forestMap_points_settings`);
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                settings.currentType = parsed.currentType || null;
                settings.visibility = parsed.visibility || settings.visibility;
            }
        } catch (e) {
            console.error('Failed to load points from localStorage:', e);
        }
    }
    
    function saveSettings() {
        try {
            localStorage.setItem(`forestMap_points_settings`, JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }
    
    // Public API
    return {
        // Initialize the module
        init: function() {
            loadFromLocalStorage();
            this.updateUI();
        },
        
        // Get point type configuration
        getPointTypes: function() {
            return POINT_TYPES;
        },
        
        // Check if GPS is available
        isGPSAvailable: function() {
            if (typeof LocationTracker !== 'undefined' && LocationTracker.getCurrentPosition) {
                const pos = LocationTracker.getCurrentPosition();
                return pos && pos.lat && pos.lng;
            }
            return false;
        },
        
        // Mark a new point at current location
        markPoint: function(type) {
            if (!type || !points[type]) {
                console.error('Invalid point type:', type);
                return null;
            }
            
            if (!this.isGPSAvailable()) {
                console.error('GPS not available');
                return null;
            }
            
            // Get or prompt for user name
            const userName = UserManager.getCurrentUserName();
            
            // If getUserName returns a promise (first time today), handle it
            if (userName instanceof Promise) {
                return userName.then(name => {
                    if (!name) {
                        console.log('User cancelled name prompt');
                        return null;
                    }
                    return this.createPointWithUserName(type, name);
                });
            }
            
            // Check if user name is available
            if (!userName) {
                console.log('No user name available');
                return null;
            }
            
            // User name already available
            return this.createPointWithUserName(type, userName);
        },
        
        // Create point with user name (helper method)
        createPointWithUserName: function(type, userName) {
            const position = LocationTracker.getCurrentPosition();
            counters[type]++;
            
            const point = {
                id: generateId(),
                type: type,
                number: counters[type],
                lat: position.lat,
                lng: position.lng,
                accuracy: position.accuracy || 0,
                timestamp: Date.now(),
                formattedCoords: formatCoordinates(position.lat, position.lng),
                notes: '',
                // NEW TRACEABILITY FIELDS
                recordedBy: userName,
                recordedDate: new Date().toISOString().split('T')[0],
                sessionId: new Date().toISOString().split('T')[0]
            };
            
            points[type].push(point);
            saveToLocalStorage(type);
            
            // Update session point count
            UserManager.updateSessionPointCount();
            
            return point;
        },
        
        // Delete a point
        deletePoint: function(pointId, type) {
            if (!type || !points[type]) {
                console.error('Invalid point type:', type);
                return false;
            }
            
            const index = points[type].findIndex(p => p.id === pointId);
            if (index !== -1) {
                // First close any open popup for this point
                this.closePopupForPoint(pointId);
                
                // Remove marker from map BEFORE removing from data (so point can still be found)
                if (typeof MapManager !== 'undefined' && MapManager.removePointMarker) {
                    MapManager.removePointMarker(pointId, type);
                }
                
                // Now remove point from data
                points[type].splice(index, 1);
                saveToLocalStorage(type);
                
                // Also clean up local marker reference as fallback
                const markerIndex = markers[type].findIndex(m => m.pointId === pointId);
                if (markerIndex !== -1) {
                    // Close popup if it exists
                    const marker = markers[type][markerIndex];
                    if (marker.getPopup && marker.getPopup()) {
                        marker.getPopup().remove();
                    }
                    marker.remove();
                    markers[type].splice(markerIndex, 1);
                }
                
                this.updateUI();
                return true;
            }
            return false;
        },
        
        // Delete point with immediate popup close for better UX
        deletePointWithPopupClose: function(pointId, type, buttonElement) {
            // Immediately close the popup for instant feedback
            if (buttonElement) {
                // Find the popup container and close it
                const popup = buttonElement.closest('.point-popup');
                if (popup && popup.parentElement) {
                    // Find the mapbox popup wrapper and close it
                    let popupWrapper = popup.parentElement;
                    while (popupWrapper && !popupWrapper.classList.contains('mapboxgl-popup')) {
                        popupWrapper = popupWrapper.parentElement;
                    }
                    if (popupWrapper) {
                        popupWrapper.remove();
                    }
                }
            }
            
            // Then proceed with the actual deletion
            return this.deletePoint(pointId, type);
        },
        
        // Close popup for a specific point
        closePopupForPoint: function(pointId) {
            // Find and close any open popups for this point
            ['exploitation', 'clearing', 'boundary'].forEach(type => {
                if (markers[type]) {
                    const marker = markers[type].find(m => m.pointId === pointId);
                    if (marker && marker.getPopup && marker.getPopup()) {
                        const popup = marker.getPopup();
                        if (popup.isOpen()) {
                            popup.remove();
                        }
                    }
                }
            });
        },
        
        // Set current point type
        setCurrentType: function(type) {
            if (type && points[type]) {
                settings.currentType = type;
                saveSettings();
                return true;
            }
            return false;
        },
        
        // Get current point type
        getCurrentType: function() {
            return settings.currentType;
        },
        
        // Check if a type is selected
        hasSelectedType: function() {
            return settings.currentType !== null;
        },
        
        // Toggle visibility of a point type
        toggleTypeVisibility: function(type) {
            if (type && settings.visibility.hasOwnProperty(type)) {
                settings.visibility[type] = !settings.visibility[type];
                saveSettings();
                
                // Update marker visibility on map
                markers[type].forEach(marker => {
                    const element = marker.getElement();
                    if (element) {
                        element.style.display = settings.visibility[type] ? 'block' : 'none';
                    }
                });
                
                return settings.visibility[type];
            }
            return null;
        },
        
        // Get visibility settings
        getVisibilitySettings: function() {
            return settings.visibility;
        },
        
        // Get points by type
        getPointsByType: function(type) {
            return points[type] || [];
        },
        
        // Get all points
        getAllPoints: function() {
            return {
                exploitation: [...points.exploitation],
                clearing: [...points.clearing],
                boundary: [...points.boundary]
            };
        },
        
        // Get count by type
        getCountByType: function(type) {
            return points[type] ? points[type].length : 0;
        },
        
        // Update notes for a point
        updateNotes: function(pointId, type, notes) {
            if (!type || !points[type]) {
                return false;
            }
            
            const point = points[type].find(p => p.id === pointId);
            if (point) {
                point.notes = notes;
                saveToLocalStorage(type);
                return true;
            }
            return false;
        },
        
        // Show notes dialog
        showNotesDialog: function(pointId, type) {
            const point = points[type].find(p => p.id === pointId);
            if (point) {
                const notes = prompt(i18n.t('notes') + ':', point.notes || '');
                if (notes !== null) {
                    this.updateNotes(pointId, type, notes);
                    // Refresh popup if it's open
                    const marker = markers[type].find(m => m.pointId === pointId);
                    if (marker && marker.getPopup().isOpen()) {
                        marker.getPopup().setHTML(this.createPopupContent(point));
                    }
                }
            }
        },
        
        // Create popup content for a point
        createPopupContent: function(point) {
            const typeConfig = POINT_TYPES[point.type];
            return `
                <div class="point-popup ${point.type}">
                    <div class="popup-header">
                        <span class="type-badge" style="background: ${typeConfig.color}">
                            ${typeConfig.icon}
                        </span>
                        <h3>${typeConfig.getLabel()} #${point.number}</h3>
                    </div>
                    <div class="popup-body">
                        <p><strong>${i18n.t('type')}:</strong> ${typeConfig.getDescription()}</p>
                        <p><strong>${i18n.t('coordinates')}:</strong><br>${point.formattedCoords}</p>
                        <p><strong>${i18n.t('accuracy')}:</strong> ±${point.accuracy}m</p>
                        ${point.recordedBy ? `
                            <p><strong>${i18n.t('recordedBy')}:</strong> ${point.recordedBy}</p>
                        ` : ''}
                        <p><strong>${i18n.t('marked')}:</strong> ${new Date(point.timestamp).toLocaleString()}</p>
                        ${point.notes ? `
                            <p><strong>${i18n.t('notes')}:</strong><br>
                            <span id="notes-${point.id}">${point.notes}</span></p>
                        ` : ''}
                    </div>
                    <div class="popup-buttons">
                        <button onclick="PointManager.showNotesDialog('${point.id}', '${point.type}')" 
                                class="btn-edit">
                            ${point.notes ? i18n.t('editNotes') : i18n.t('addNotes')}
                        </button>
                        <button onclick="PointManager.deletePointWithPopupClose('${point.id}', '${point.type}', this)" 
                                class="btn-delete">
                            ${i18n.t('delete')}
                        </button>
                    </div>
                </div>
            `;
        },
        
        // Add marker reference
        addMarker: function(type, marker) {
            if (markers[type]) {
                markers[type].push(marker);
            }
        },
        
        // Clear all markers for a type
        clearMarkers: function(type) {
            if (markers[type]) {
                markers[type].forEach(marker => marker.remove());
                markers[type] = [];
            }
        },
        
        // Update UI elements
        updateUI: function() {
            // Update counters in UI
            ['exploitation', 'clearing', 'boundary'].forEach(type => {
                const count = this.getCountByType(type);
                
                // Update filter panel counts
                const filterCount = document.getElementById(`count-${type}`);
                if (filterCount) {
                    filterCount.textContent = count;
                }
                
                // Update type selector counts
                const typeBtn = document.querySelector(`.type-btn[data-type="${type}"] .type-count`);
                if (typeBtn) {
                    typeBtn.textContent = count;
                }
                
                // Update status bar
                const statusStat = document.querySelector(`.type-stat.${type}`);
                if (statusStat) {
                    const abbr = type === 'exploitation' ? 'E' : type === 'clearing' ? 'C' : 'B';
                    statusStat.textContent = `${abbr}:${count}`;
                }
            });
            
            // Update current type indicator
            const indicator = document.querySelector('#mark-btn .type-indicator');
            if (indicator) {
                if (settings.currentType) {
                    indicator.textContent = POINT_TYPES[settings.currentType].icon;
                    indicator.style.display = 'inline';
                } else {
                    indicator.style.display = 'none';
                }
            }
            
            // Update share button state
            this.updateShareButton();
        },
        
        // Update share button and clear all button enabled state
        updateShareButton: function() {
            const totalPoints = ['exploitation', 'clearing', 'boundary'].reduce((sum, type) => 
                sum + this.getCountByType(type), 0);
            
            // Update share button
            const shareBtn = document.getElementById('share-btn');
            if (shareBtn) {
                if (totalPoints === 0) {
                    shareBtn.disabled = true;
                    shareBtn.style.opacity = '0.5';
                    shareBtn.style.cursor = 'not-allowed';
                } else {
                    shareBtn.disabled = false;
                    shareBtn.style.opacity = '1';
                    shareBtn.style.cursor = 'pointer';
                }
            }
            
            // Update clear all button
            const clearAllBtn = document.getElementById('clear-all-btn');
            if (clearAllBtn) {
                if (totalPoints === 0) {
                    clearAllBtn.disabled = true;
                    clearAllBtn.style.opacity = '0.3';
                    clearAllBtn.style.cursor = 'not-allowed';
                } else {
                    clearAllBtn.disabled = false;
                    clearAllBtn.style.opacity = '1';
                    clearAllBtn.style.cursor = 'pointer';
                }
            }
        },
        
        // Clear all points with confirmation dialog
        clearAllPoints: function() {
            const totalPoints = ['exploitation', 'clearing', 'boundary'].reduce((sum, type) => 
                sum + this.getCountByType(type), 0);
            
            if (totalPoints === 0) {
                this.showClearAllNotification(i18n.t('nothingToClear'), 'info');
                return;
            }
            
            this.showClearAllConfirmDialog(totalPoints);
        },
        
        // Show confirmation dialog for clearing all points
        showClearAllConfirmDialog: function(totalPoints) {
            const dialog = document.createElement('div');
            dialog.className = 'clear-all-dialog-overlay';
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 4000;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(3px);
                -webkit-backdrop-filter: blur(3px);
            `;
            
            const dialogContent = document.createElement('div');
            dialogContent.className = 'clear-all-dialog';
            dialogContent.style.cssText = `
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                max-width: 400px;
                text-align: center;
                margin: 20px;
            `;
            
            dialogContent.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <svg width="64" height="64" style="color: #f44336; margin-bottom: 15px;" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    <h3 style="margin: 0 0 15px 0; color: #333; font-size: 20px;">${i18n.t('clearAllConfirmTitle')}</h3>
                </div>
                
                <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 20px 0 30px 0;">
                    ${i18n.t('clearAllConfirmMessage', { count: totalPoints })}
                </p>
                
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="clear-all-cancel" 
                            style="background: #f5f5f5; color: #333; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                        ${i18n.t('clearAllCancelButton')}
                    </button>
                    <button id="clear-all-confirm" 
                            style="background: #f44336; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">
                        ${i18n.t('clearAllConfirmButton')}
                    </button>
                </div>
            `;
            
            dialog.appendChild(dialogContent);
            document.body.appendChild(dialog);
            
            // Handle cancel
            document.getElementById('clear-all-cancel').addEventListener('click', () => {
                document.body.removeChild(dialog);
            });
            
            // Handle confirm
            document.getElementById('clear-all-confirm').addEventListener('click', () => {
                this.performClearAll();
                document.body.removeChild(dialog);
            });
            
            // Handle click outside dialog
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    document.body.removeChild(dialog);
                }
            });
            
            // Handle escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(dialog);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        },
        
        // Actually perform the clearing of all points
        performClearAll: function() {
            const types = ['exploitation', 'clearing', 'boundary'];
            
            // Clear all points from data
            types.forEach(type => {
                points[type] = [];
                counters[type] = 0;
                saveToLocalStorage(type);
            });
            
            // Clear all markers from map
            types.forEach(type => {
                // Close all popups and remove markers
                if (markers[type]) {
                    markers[type].forEach(marker => {
                        if (marker.getPopup && marker.getPopup()) {
                            marker.getPopup().remove();
                        }
                        marker.remove();
                    });
                    markers[type] = [];
                }
            });
            
            // Clear MapManager's pointMarkers array
            if (typeof MapManager !== 'undefined' && MapManager.clearPointMarkers) {
                MapManager.clearPointMarkers();
            }
            
            // Reset current type
            settings.currentType = null;
            saveSettings();
            
            // Update UI
            this.updateUI();
            
            // Show success message
            this.showClearAllNotification(i18n.t('clearAllSuccess'), 'success');
        },
        
        // Show notification for clear all operations
        showClearAllNotification: function(message, type = 'info') {
            if (typeof LocationTracker !== 'undefined' && LocationTracker.updateStatus) {
                LocationTracker.updateStatus(message, type);
            } else {
                // Fallback notification
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
                    color: white;
                    padding: 12px 20px;
                    border-radius: 6px;
                    z-index: 3001;
                    font-size: 14px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                `;
                notification.textContent = message;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 3000);
            }
        },
        
        // Export data
        exportData: function(options) {
            const format = options.format || 'json';
            const types = options.types || ['exploitation', 'clearing', 'boundary'];
            const data = {};
            
            types.forEach(type => {
                data[type] = points[type];
            });
            
            // Delegate to ExportManager if it exists
            if (typeof ExportManager !== 'undefined') {
                switch(format) {
                    case 'csv':
                        ExportManager.exportToCSV(data, types);
                        break;
                    case 'gpx':
                        ExportManager.exportToGPX(data, types);
                        break;
                    case 'json':
                    default:
                        ExportManager.exportToJSON(data, types);
                }
            } else {
                console.log('Export data:', data);
            }
        }
    };
})();