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
            icon: '💰',
            color: '#FF6B35',
            getDescription: () => i18n.t('exploitationDesc')
        },
        clearing: {
            getLabel: () => i18n.t('clearing'),
            icon: '💀',
            color: '#DC143C',
            getDescription: () => i18n.t('clearingDesc')
        },
        boundary: {
            getLabel: () => i18n.t('boundary'),
            icon: '📍',
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
                notes: ''
            };
            
            points[type].push(point);
            saveToLocalStorage(type);
            
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
                points[type].splice(index, 1);
                saveToLocalStorage(type);
                
                // Remove marker from map if it exists
                const markerIndex = markers[type].findIndex(m => m.pointId === pointId);
                if (markerIndex !== -1) {
                    markers[type][markerIndex].remove();
                    markers[type].splice(markerIndex, 1);
                }
                
                this.updateUI();
                return true;
            }
            return false;
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
                        <button onclick="PointManager.deletePoint('${point.id}', '${point.type}')" 
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
            if (settings.currentType) {
                const indicator = document.querySelector('#mark-btn .type-indicator');
                if (indicator) {
                    indicator.textContent = POINT_TYPES[settings.currentType].icon;
                    indicator.style.display = 'inline';
                }
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