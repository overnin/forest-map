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
            pointFilters: 'Point Filters',
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
            gpsAccuracy: 'GPS Accuracy: ±{accuracy}m',
            
            // Share functionality
            sharePoints: 'Share Points',
            shareGeoJSON: 'Share GeoJSON',
            noPointsToShare: 'No points to share',
            shareSuccess: 'Points shared successfully',
            shareFailed: 'Sharing failed',
            downloadInstead: 'GeoJSON file downloaded',
            copiedToClipboard: 'Copied to clipboard',
            geoJsonDownloaded: 'GeoJSON file has been downloaded:',
            shareInstructions: 'You can now share this file through any app or upload it to mapping services like QGIS, ArcGIS, or Google Earth.',
            
            // Clear all functionality
            clearAllPoints: 'Clear All Points',
            clearAllConfirmTitle: 'Clear All Points?',
            clearAllConfirmMessage: 'This will permanently delete all {count} recorded points. This action cannot be undone.',
            clearAllConfirmButton: 'Yes, Clear All',
            clearAllCancelButton: 'Cancel',
            clearAllSuccess: 'All points cleared successfully',
            nothingToClear: 'No points to clear',
            
            // Traceability
            enterYourName: 'Enter Your Name',
            nameRequired: 'Name is required to record points',
            recordedBy: 'Recorded by',
            rememberNameToday: 'Your name will be remembered for today',
            namePromptTitle: 'Identify Yourself',
            namePromptMessage: 'Please enter your name to enable point traceability:',
            confirm: 'Confirm',
            session: 'Session',
            collector: 'Collector'
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
            pointFilters: 'Filtres de points',
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
            gpsAccuracy: 'Précision GPS : ±{accuracy}m',
            
            // Share functionality
            sharePoints: 'Partager les points',
            shareGeoJSON: 'Partager en GeoJSON',
            noPointsToShare: 'Aucun point à partager',
            shareSuccess: 'Points partagés avec succès',
            shareFailed: 'Échec du partage',
            downloadInstead: 'Fichier GeoJSON téléchargé',
            copiedToClipboard: 'Copié dans le presse-papier',
            geoJsonDownloaded: 'Le fichier GeoJSON a été téléchargé :',
            shareInstructions: 'Vous pouvez maintenant partager ce fichier via n\'importe quelle application ou le télécharger vers des services de cartographie comme QGIS, ArcGIS ou Google Earth.',
            
            // Clear all functionality
            clearAllPoints: 'Effacer tous les points',
            clearAllConfirmTitle: 'Effacer tous les points ?',
            clearAllConfirmMessage: 'Cela supprimera définitivement tous les {count} points enregistrés. Cette action ne peut pas être annulée.',
            clearAllConfirmButton: 'Oui, tout effacer',
            clearAllCancelButton: 'Annuler',
            clearAllSuccess: 'Tous les points ont été effacés avec succès',
            nothingToClear: 'Aucun point à effacer',
            
            // Traceability
            enterYourName: 'Entrez votre nom',
            nameRequired: 'Le nom est requis pour enregistrer des points',
            recordedBy: 'Enregistré par',
            rememberNameToday: 'Votre nom sera mémorisé pour aujourd\'hui',
            namePromptTitle: 'Identifiez-vous',
            namePromptMessage: 'Veuillez entrer votre nom pour activer la traçabilité des points :',
            confirm: 'Confirmer',
            session: 'Session',
            collector: 'Collecteur'
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