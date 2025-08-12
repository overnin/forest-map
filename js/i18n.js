// Internationalization module for Forest Map
const i18n = (function() {
    let currentLang = 'en';
    
    const translations = {
        en: {
            // Point types
            exploitation: 'Exploitation',
            clearing: 'Clearing',
            boundary: 'Boundary',
            exploitationDesc: 'Trees for economic harvesting',
            clearingDesc: 'Trees for land clearing',
            boundaryDesc: 'Parcel boundary markers',
            
            // UI elements
            markPoint: 'Mark point at current location',
            selectPointType: 'Select Point Type:',
            pointFilters: 'Point Filters (Long press to switch)',
            points: 'Points',
            longPressToSwitch: 'Long press mark button or type indicator to change type',
            
            // Actions
            delete: 'Delete',
            editNotes: 'Edit Notes',
            addNotes: 'Add Notes',
            export: 'Export',
            close: 'Close',
            
            // Messages
            gpsRequired: 'GPS location required for marking points',
            pointMarked: '{type} #{number} marked',
            coordinates: 'Coordinates',
            accuracy: 'Accuracy',
            marked: 'Marked',
            notes: 'Notes',
            type: 'Type',
            
            // Export
            exportCSV: 'Export as CSV',
            exportGPX: 'Export as GPX',
            exportJSON: 'Export as JSON',
            
            // Status
            noGPS: 'No GPS signal',
            gpsAccuracy: 'GPS Accuracy: ±{accuracy}m'
        },
        fr: {
            // Point types
            exploitation: 'Exploitation',
            clearing: 'Défrichage',
            boundary: 'Délimitation',
            exploitationDesc: 'Arbres pour exploitation économique',
            clearingDesc: 'Arbres pour défrichage',
            boundaryDesc: 'Marqueurs de limites de parcelle',
            
            // UI elements
            markPoint: 'Marquer un point à la position actuelle',
            selectPointType: 'Sélectionner le type de point :',
            pointFilters: 'Filtres de points (Appui long pour changer)',
            points: 'Points',
            longPressToSwitch: 'Appui long sur le bouton ou l\'indicateur pour changer de type',
            
            // Actions
            delete: 'Supprimer',
            editNotes: 'Modifier les notes',
            addNotes: 'Ajouter des notes',
            export: 'Exporter',
            close: 'Fermer',
            
            // Messages
            gpsRequired: 'Position GPS requise pour marquer des points',
            pointMarked: '{type} n°{number} marqué',
            coordinates: 'Coordonnées',
            accuracy: 'Précision',
            marked: 'Marqué',
            notes: 'Notes',
            type: 'Type',
            
            // Export
            exportCSV: 'Exporter en CSV',
            exportGPX: 'Exporter en GPX',
            exportJSON: 'Exporter en JSON',
            
            // Status
            noGPS: 'Pas de signal GPS',
            gpsAccuracy: 'Précision GPS : ±{accuracy}m'
        }
    };
    
    return {
        init: function() {
            // Detect language from browser
            const browserLang = navigator.language || navigator.userLanguage;
            const lang = browserLang.startsWith('fr') ? 'fr' : 'en';
            
            // Check for saved preference
            const savedLang = localStorage.getItem('forestMap_user_language');
            this.setLanguage(savedLang || lang);
        },
        
        setLanguage: function(lang) {
            currentLang = translations[lang] ? lang : 'en';
            localStorage.setItem('forestMap_user_language', currentLang);
            this.updateUI();
        },
        
        t: function(key, params) {
            let text = translations[currentLang][key] || translations['en'][key] || key;
            
            // Replace parameters
            if (params) {
                Object.keys(params).forEach(param => {
                    text = text.replace(`{${param}}`, params[param]);
                });
            }
            
            return text;
        },
        
        getCurrentLanguage: function() {
            return currentLang;
        },
        
        updateUI: function() {
            // Update all data-i18n elements
            document.querySelectorAll('[data-i18n]').forEach(element => {
                const key = element.getAttribute('data-i18n');
                element.textContent = this.t(key);
            });
            
            // Update all data-i18n-title elements
            document.querySelectorAll('[data-i18n-title]').forEach(element => {
                const key = element.getAttribute('data-i18n-title');
                element.title = this.t(key);
            });
            
            // Update all data-i18n-placeholder elements
            document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
                const key = element.getAttribute('data-i18n-placeholder');
                element.placeholder = this.t(key);
            });
        }
    };
})();