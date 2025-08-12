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
                    gpx += `    <desc>${point.notes || ''}</desc>\n`;
                    gpx += `    <type>${type}</type>\n`;
                    gpx += `    <time>${new Date(point.timestamp).toISOString()}</time>\n`;
                    
                    // Add accuracy as extensions
                    if (point.accuracy) {
                        gpx += `    <extensions>\n`;
                        gpx += `      <accuracy>${point.accuracy}</accuracy>\n`;
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
    
    // Generic file download function
    downloadFile: function(content, filename, mimeType) {
        try {
            const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            // Show success message
            this.showExportNotification(filename);
        } catch (error) {
            console.error('Export failed:', error);
            this.showExportNotification(null, error.message);
        }
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