// Export functionality for Forest Map Points
const ExportManager = {
    // Export points to CSV format
    exportToCSV: function(points, types) {
        const headers = [
            i18n.t('type'),
            'Number',
            i18n.t('coordinates') + ' (Lat)',
            i18n.t('coordinates') + ' (Lng)',
            i18n.t('accuracy') + ' (m)',
            i18n.t('recordedBy'),
            i18n.t('marked'),
            i18n.t('notes')
        ];
        const rows = [headers];
        
        types.forEach(type => {
            if (points[type]) {
                points[type].forEach(point => {
                    rows.push([
                        i18n.t(type),
                        point.number,
                        point.lat,
                        point.lng,
                        point.accuracy,
                        point.recordedBy || 'Unknown',
                        new Date(point.timestamp).toLocaleString(),
                        point.notes || ''
                    ]);
                });
            }
        });
        
        const csv = rows.map(row => 
            row.map(cell => 
                typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
            ).join(',')
        ).join('\n');
        
        this.downloadFile(csv, 'forest_points.csv', 'text/csv');
    },
    
    // Export points to GPX format for GPS devices
    exportToGPX: function(points, types) {
        let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
        gpx += '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"\n';
        gpx += '     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
        gpx += '     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';
        gpx += '  <metadata>\n';
        gpx += '    <name>Forest Map Points</name>\n';
        gpx += '    <desc>Points exported from Forest Map application</desc>\n';
        gpx += `    <time>${new Date().toISOString()}</time>\n`;
        gpx += '  </metadata>\n';
        
        types.forEach(type => {
            if (points[type]) {
                points[type].forEach(point => {
                    gpx += `  <wpt lat="${point.lat}" lon="${point.lng}">\n`;
                    gpx += `    <name>${i18n.t(type)} #${point.number}</name>\n`;
                    
                    // Enhanced description with collector info
                    let desc = point.notes || '';
                    if (point.recordedBy) {
                        desc = `Recorded by: ${point.recordedBy}${desc ? ' - ' + desc : ''}`;
                    }
                    gpx += `    <desc>${desc}</desc>\n`;
                    gpx += `    <type>${type}</type>\n`;
                    gpx += `    <time>${new Date(point.timestamp).toISOString()}</time>\n`;
                    
                    // Add traceability as extensions
                    if (point.accuracy || point.recordedBy) {
                        gpx += `    <extensions>\n`;
                        if (point.accuracy) {
                            gpx += `      <accuracy>${point.accuracy}</accuracy>\n`;
                        }
                        if (point.recordedBy) {
                            gpx += `      <recordedBy>${point.recordedBy}</recordedBy>\n`;
                            gpx += `      <recordedDate>${point.recordedDate || new Date(point.timestamp).toISOString().split('T')[0]}</recordedDate>\n`;
                        }
                        gpx += `    </extensions>\n`;
                    }
                    
                    gpx += `  </wpt>\n`;
                });
            }
        });
        
        gpx += '</gpx>';
        this.downloadFile(gpx, 'forest_points.gpx', 'application/gpx+xml');
    },
    
    // Export points to JSON format for backup/restore
    exportToJSON: function(points, types) {
        const data = {
            exportDate: new Date().toISOString(),
            exportedBy: 'Forest Map v2.0',
            language: i18n.getCurrentLanguage(),
            totalPoints: types.reduce((sum, type) => sum + (points[type] ? points[type].length : 0), 0),
            points: {}
        };
        
        types.forEach(type => {
            if (points[type]) {
                data.points[type] = points[type].map(point => ({
                    ...point,
                    typeName: i18n.t(type),
                    typeDescription: i18n.t(type + 'Desc')
                }));
            }
        });
        
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, 'forest_points.json', 'application/json');
    },
    
    // Export to KML format for Google Earth
    exportToKML: function(points, types) {
        let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
        kml += '  <Document>\n';
        kml += '    <name>Forest Map Points</name>\n';
        kml += '    <description>Points exported from Forest Map application</description>\n';
        
        // Add styles for each type
        const pointTypes = PointManager.getPointTypes();
        types.forEach(type => {
            const config = pointTypes[type];
            kml += `    <Style id="${type}Style">\n`;
            kml += '      <IconStyle>\n';
            kml += `        <color>ff${this.hexToKmlColor(config.color)}</color>\n`;
            kml += '        <scale>1.0</scale>\n';
            kml += '      </IconStyle>\n';
            kml += '    </Style>\n';
        });
        
        types.forEach(type => {
            if (points[type]) {
                kml += `    <Folder>\n`;
                kml += `      <name>${i18n.t(type)} (${points[type].length})</name>\n`;
                
                points[type].forEach(point => {
                    kml += '      <Placemark>\n';
                    kml += `        <name>${i18n.t(type)} #${point.number}</name>\n`;
                    kml += `        <description><![CDATA[\n`;
                    kml += `          <b>Type:</b> ${i18n.t(type)}<br/>\n`;
                    kml += `          <b>${i18n.t('coordinates')}:</b> ${point.formattedCoords}<br/>\n`;
                    kml += `          <b>${i18n.t('accuracy')}:</b> ±${point.accuracy}m<br/>\n`;
                    if (point.recordedBy) {
                        kml += `          <b>${i18n.t('recordedBy')}:</b> ${point.recordedBy}<br/>\n`;
                    }
                    kml += `          <b>${i18n.t('marked')}:</b> ${new Date(point.timestamp).toLocaleString()}<br/>\n`;
                    if (point.notes) {
                        kml += `          <b>${i18n.t('notes')}:</b> ${point.notes}<br/>\n`;
                    }
                    kml += `        ]]></description>\n`;
                    kml += `        <styleUrl>#${type}Style</styleUrl>\n`;
                    kml += '        <Point>\n';
                    kml += `          <coordinates>${point.lng},${point.lat},0</coordinates>\n`;
                    kml += '        </Point>\n';
                    kml += '      </Placemark>\n';
                });
                
                kml += '    </Folder>\n';
            }
        });
        
        kml += '  </Document>\n';
        kml += '</kml>';
        
        this.downloadFile(kml, 'forest_points.kml', 'application/vnd.google-earth.kml+xml');
    },
    
    // Helper function to convert hex color to KML color format
    hexToKmlColor: function(hex) {
        // Convert #FF6B35 to 356BFF (BGR format)
        const r = hex.slice(1, 3);
        const g = hex.slice(3, 5);
        const b = hex.slice(5, 7);
        return b + g + r;
    },
    
    // Generic file download function with mobile compatibility
    downloadFile: function(content, filename, mimeType) {
        try {
            const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
            
            // Check if we're on mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                           ('ontouchstart' in window) ||
                           (window.innerWidth <= 768);
            
            // Try modern File System Access API first (Chrome 86+)
            if ('showSaveFilePicker' in window) {
                this.downloadWithFileSystemAPI(blob, filename, mimeType);
                return;
            }
            
            // Fallback to traditional method with mobile improvements
            const url = URL.createObjectURL(blob);
            
            if (isMobile) {
                // Mobile-specific handling
                this.downloadMobile(url, filename, blob, mimeType);
            } else {
                // Desktop handling
                this.downloadDesktop(url, filename);
            }
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            // Show success message
            this.showExportNotification(filename);
        } catch (error) {
            console.error('Export failed:', error);
            this.showExportNotification(null, error.message);
        }
    },
    
    // Modern File System Access API download
    downloadWithFileSystemAPI: async function(blob, filename, mimeType) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'Forest Map Export',
                    accept: { [mimeType]: [`.${filename.split('.').pop()}`] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            this.showExportNotification(filename);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('File System API failed:', error);
                // Fallback to traditional method
                const url = URL.createObjectURL(blob);
                this.downloadDesktop(url, filename);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        }
    },
    
    // Mobile-optimized download
    downloadMobile: function(url, filename, blob, mimeType) {
        // Try multiple approaches for mobile
        
        // Approach 1: Try Web Share API with file
        if (navigator.share && navigator.canShare) {
            try {
                const file = new File([blob], filename, { type: mimeType });
                const shareData = { files: [file] };
                
                if (navigator.canShare(shareData)) {
                    navigator.share(shareData).then(() => {
                        this.showExportNotification(filename + ' (shared)');
                    }).catch(() => {
                        this.downloadMobileFallback(url, filename, blob);
                    });
                    return;
                }
            } catch (error) {
                // Continue to fallback
            }
        }
        
        this.downloadMobileFallback(url, filename, blob);
    },
    
    // Mobile fallback methods
    downloadMobileFallback: function(url, filename, blob) {
        // Approach 2: Open in new window/tab (iOS Safari compatible)
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            // iOS-specific: Open blob URL in new window
            const newWindow = window.open();
            if (newWindow) {
                newWindow.location.href = url;
                this.showMobileInstructions(filename);
                return;
            }
        }
        
        // Approach 3: Traditional download with mobile considerations
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.cssText = 'position: fixed; top: -1000px; left: -1000px;';
        
        document.body.appendChild(a);
        
        // Add user interaction for mobile browsers
        a.addEventListener('click', () => {
            this.showMobileInstructions(filename);
        });
        
        // Trigger click with timeout for mobile
        setTimeout(() => {
            a.click();
            setTimeout(() => document.body.removeChild(a), 100);
        }, 100);
    },
    
    // Desktop download
    downloadDesktop: function(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },
    
    // Show mobile-specific instructions
    showMobileInstructions: function(filename) {
        const dialog = document.createElement('div');
        dialog.className = 'mobile-download-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 5000;
            max-width: 350px;
            text-align: center;
        `;
        
        dialog.innerHTML = `
            <div style="margin-bottom: 20px;">
                <svg width="48" height="48" style="color: #FF9800; margin-bottom: 15px;" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                <h3 style="margin: 0 0 10px 0; color: #333;">Download Instructions</h3>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 15px 0;">
                Your file <strong>${filename}</strong> should download automatically.
            </p>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="color: #333; font-size: 13px; margin: 0; line-height: 1.4;">
                    <strong>Mobile Tips:</strong><br>
                    • Check your Downloads folder<br>
                    • Look for browser download notification<br>
                    • On iOS: Tap and hold the link, select "Download"
                </p>
            </div>
            
            <button onclick="document.body.removeChild(this.parentElement.parentElement)" 
                    style="background: #2196F3; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 10px;">
                Got it
            </button>
        `;
        
        document.body.appendChild(dialog);
        
        // Auto-close after 8 seconds
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        }, 8000);
    },
    
    // Show export notification
    showExportNotification: function(filename, error) {
        const message = error 
            ? `Export failed: ${error}`
            : `Successfully exported ${filename}`;
        
        // Use existing notification system if available
        if (typeof LocationTracker !== 'undefined' && LocationTracker.updateStatus) {
            LocationTracker.updateStatus(message, error ? 'error' : 'success');
        } else {
            // Fallback to alert
            alert(message);
        }
    },
    
    // Export points to GeoJSON format for sharing
    exportToGeoJSON: function(points, types, options = {}) {
        const features = [];
        const pointTypes = PointManager.getPointTypes();
        
        types.forEach(type => {
            if (points[type]) {
                points[type].forEach(point => {
                    const typeConfig = pointTypes[type];
                    features.push({
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [point.lng, point.lat]
                        },
                        properties: {
                            id: point.id,
                            pointType: type,
                            number: point.number,
                            typeName: i18n.t(type),
                            typeDescription: i18n.t(type + 'Desc'),
                            notes: point.notes || '',
                            timestamp: new Date(point.timestamp).toISOString(),
                            accuracy: point.accuracy,
                            icon: typeConfig.icon,
                            color: typeConfig.color,
                            formattedCoords: point.formattedCoords,
                            // TRACEABILITY FIELDS
                            recordedBy: point.recordedBy || 'Unknown',
                            recordedDate: point.recordedDate || new Date(point.timestamp).toISOString().split('T')[0],
                            sessionId: point.sessionId || point.recordedDate || 'unknown',
                            collectorInfo: {
                                name: point.recordedBy || 'Unknown',
                                date: point.recordedDate || new Date(point.timestamp).toISOString().split('T')[0],
                                session: point.sessionId || 'unknown'
                            }
                        }
                    });
                });
            }
        });
        
        const geoJson = {
            type: "FeatureCollection",
            features: features,
            properties: {
                title: "Forest Map Points",
                description: `${features.length} points exported from Forest Map`,
                exportDate: new Date().toISOString(),
                exportedBy: "Forest Map v2.0",
                language: i18n.getCurrentLanguage(),
                totalPoints: features.length,
                // Collector summary
                collectors: [...new Set(features.map(f => f.properties.recordedBy))],
                sessions: [...new Set(features.map(f => f.properties.sessionId))],
                pointTypes: {
                    exploitation: points.exploitation ? points.exploitation.length : 0,
                    clearing: points.clearing ? points.clearing.length : 0,
                    boundary: points.boundary ? points.boundary.length : 0
                }
            }
        };
        
        if (options.returnString) {
            return JSON.stringify(geoJson, null, 2);
        }
        
        if (options.share) {
            return this.shareGeoJSON(geoJson);
        }
        
        // Default: download file
        const geoJsonString = JSON.stringify(geoJson, null, 2);
        this.downloadFile(geoJsonString, 'forest_points.geojson', 'application/geo+json');
        return geoJson;
    },

    // Share GeoJSON using Web Share API or fallbacks
    shareGeoJSON: async function(geoJsonData) {
        const geoJsonString = JSON.stringify(geoJsonData, null, 2);
        const totalPoints = geoJsonData.features.length;
        
        if (totalPoints === 0) {
            this.showShareNotification(i18n.t('noPointsToShare'), 'error');
            return false;
        }
        
        const filename = `forest_points_${new Date().toISOString().split('T')[0]}.geojson`;
        const title = `Forest Map - ${totalPoints} ${i18n.t('points')}`;
        const text = `${totalPoints} forest points collected with GPS coordinates and metadata`;
        
        // Try Web Share API first (mobile browsers)
        if (navigator.share && navigator.canShare) {
            try {
                const file = new File([geoJsonString], filename, {
                    type: 'application/geo+json',
                    lastModified: Date.now()
                });
                
                const shareData = {
                    title: title,
                    text: text,
                    files: [file]
                };
                
                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    this.showShareNotification(i18n.t('shareSuccess'), 'success');
                    return true;
                }
            } catch (error) {
                console.warn('Web Share API failed:', error);
                // Fall through to alternative methods
            }
        }
        
        // Fallback 1: Try Web Share API without files (text only)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: text + '\n\nGeoJSON data available for download',
                    url: window.location.href
                });
                // Still download the file for them
                this.downloadFile(geoJsonString, filename, 'application/geo+json');
                this.showShareNotification(i18n.t('shareSuccess'), 'success');
                return true;
            } catch (error) {
                console.warn('Web Share API (text) failed:', error);
            }
        }
        
        // Fallback 2: Copy to clipboard and download
        return this.shareGeoJSONFallback(geoJsonString, filename, title);
    },

    // Fallback sharing methods
    shareGeoJSONFallback: function(geoJsonString, filename, title) {
        // Try clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(geoJsonString).then(() => {
                this.showShareDialog(filename, title, true);
            }).catch(() => {
                this.showShareDialog(filename, title, false);
            });
        } else {
            this.showShareDialog(filename, title, false);
        }
        
        // Always trigger download as backup
        this.downloadFile(geoJsonString, filename, 'application/geo+json');
        return true;
    },

    // Show share dialog with instructions
    showShareDialog: function(filename, title, copiedToClipboard) {
        const dialog = document.createElement('div');
        dialog.className = 'share-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 3000;
            max-width: 350px;
            text-align: center;
        `;
        
        const clipboardStatus = copiedToClipboard 
            ? `<p style="color: #4CAF50; font-size: 14px; margin: 10px 0;">✓ ${i18n.t('copiedToClipboard')}</p>`
            : '';
        
        dialog.innerHTML = `
            <div style="margin-bottom: 20px;">
                <svg width="48" height="48" style="color: #2196F3; margin-bottom: 15px;" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
                </svg>
                <h3 style="margin: 0 0 10px 0; color: #333;">${i18n.t('shareGeoJSON')}</h3>
            </div>
            
            ${clipboardStatus}
            
            <p style="color: #666; font-size: 14px; line-height: 1.5; margin: 15px 0;">
                ${i18n.t('geoJsonDownloaded')}<br>
                <strong>${filename}</strong>
            </p>
            
            <div style="margin: 20px 0;">
                <button onclick="document.body.removeChild(this.parentElement.parentElement.parentElement)" 
                        style="background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px;">
                    ${i18n.t('close')}
                </button>
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 15px;">
                ${i18n.t('shareInstructions')}
            </p>
        `;
        
        document.body.appendChild(dialog);
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        }, 10000);
    },

    // Show share notification
    showShareNotification: function(message, type = 'info') {
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

    // Show export options dialog
    showExportDialog: function() {
        const types = ['exploitation', 'clearing', 'boundary'];
        const totalPoints = types.reduce((sum, type) => 
            sum + PointManager.getCountByType(type), 0);
        
        if (totalPoints === 0) {
            this.showExportNotification(null, 'No points to export');
            return;
        }
        
        // Create simple export dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 2000;
            min-width: 250px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top: 0;">${i18n.t('export')} (${totalPoints} points)</h3>
            <div style="margin: 15px 0;">
                <button onclick="ExportManager.exportToCSV(PointManager.getAllPoints(), ['exploitation', 'clearing', 'boundary']); document.body.removeChild(this.parentElement.parentElement);" 
                        style="display: block; width: 100%; margin: 5px 0; padding: 8px; cursor: pointer;">
                    ${i18n.t('exportCSV')}
                </button>
                <button onclick="ExportManager.exportToGPX(PointManager.getAllPoints(), ['exploitation', 'clearing', 'boundary']); document.body.removeChild(this.parentElement.parentElement);" 
                        style="display: block; width: 100%; margin: 5px 0; padding: 8px; cursor: pointer;">
                    ${i18n.t('exportGPX')}
                </button>
                <button onclick="ExportManager.exportToJSON(PointManager.getAllPoints(), ['exploitation', 'clearing', 'boundary']); document.body.removeChild(this.parentElement.parentElement);" 
                        style="display: block; width: 100%; margin: 5px 0; padding: 8px; cursor: pointer;">
                    ${i18n.t('exportJSON')}
                </button>
                <button onclick="ExportManager.exportToKML(PointManager.getAllPoints(), ['exploitation', 'clearing', 'boundary']); document.body.removeChild(this.parentElement.parentElement);" 
                        style="display: block; width: 100%; margin: 5px 0; padding: 8px; cursor: pointer;">
                    Export KML
                </button>
                <button onclick="document.body.removeChild(this.parentElement.parentElement);" 
                        style="display: block; width: 100%; margin: 10px 0 0 0; padding: 8px; cursor: pointer; background: #f0f0f0;">
                    ${i18n.t('close')}
                </button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeDialog(e) {
                if (!dialog.contains(e.target)) {
                    document.body.removeChild(dialog);
                    document.removeEventListener('click', closeDialog);
                }
            });
        }, 100);
    }
};