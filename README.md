# Forest Map GPS Tracker

A web-based GPS tracking application for forest exploitation management. Works on both Android and iOS devices through the browser.

## Features

- **Real-time GPS tracking** - Shows your current location on the map
- **Multiple map layers** - Switch between streets, satellite, terrain, and hybrid views
- **Offline capability** - Works without internet connection (cached areas)
- **Progressive Web App** - Installable on mobile devices
- **No backend required** - Pure frontend solution for minimal maintenance
- **Cross-platform** - Works on any modern mobile browser

## Quick Start

### Option 1: Local Development

1. Navigate to the app directory:
```bash
cd app
```

2. Start a local server (choose one):
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if http-server is installed)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

3. Open in browser:
```
http://localhost:8000
```

### Option 2: Deploy to GitHub Pages

1. Push the code to a GitHub repository
2. Go to Settings > Pages
3. Select source: "Deploy from a branch"
4. Select branch: main (or master)
5. Select folder: /app
6. Save and wait for deployment

Your app will be available at: `https://[username].github.io/[repository-name]/`

### Option 3: Deploy to Netlify

1. Create a Netlify account
2. Drag and drop the `app` folder to Netlify
3. Your app will be instantly deployed with a URL

## Usage

### Mobile Usage

1. **Open the app** in your mobile browser
2. **Allow location permission** when prompted
3. **Your location** will appear as a blue dot on the map
4. **Use controls:**
   - **Location button** - Center map on your position
   - **Layers button** - Switch map styles
   - **Fullscreen button** - Enter fullscreen mode

### Installing as PWA

#### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Name the app and tap "Add"

#### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (3 dots)
3. Select "Add to Home screen"
4. Confirm installation

## Features in Detail

### Location Tracking
- High-accuracy GPS mode enabled by default
- Shows accuracy radius around your position
- Displays coordinates and accuracy in meters
- Automatic position updates as you move

### Map Layers
- **Streets** - Standard street map
- **Satellite** - Aerial imagery
- **Terrain** - Topographic features
- **Hybrid** - Satellite with labels

### Offline Mode
- Service worker caches app resources
- Map tiles are cached as you browse
- App works without internet in cached areas
- Status bar shows online/offline state

## Technical Details

### Technologies Used
- **Mapbox GL JS** v3.0.0 - Map rendering
- **Geolocation API** - GPS tracking
- **Service Workers** - Offline functionality
- **Web App Manifest** - PWA features
- **Vanilla JavaScript** - No framework dependencies

### Browser Requirements
- Modern mobile browser (Chrome, Safari, Firefox)
- GPS/Location services enabled
- HTTPS connection (required for geolocation)

### Mapbox Token
The app uses the provided Mapbox token. For production use, consider:
- Creating your own Mapbox account
- Generating a new token with URL restrictions
- Updating the token in `/app/js/map.js`

## Customization

### Change Default Location
Edit `/app/js/map.js` line 20:
```javascript
center: [longitude, latitude], // Your coordinates
```

### Modify Map Styles
Add custom styles in `/app/js/map.js`:
```javascript
const mapStyles = {
    custom: 'mapbox://styles/your-username/style-id'
};
```

### Adjust GPS Settings
Edit `/app/js/location.js` line 9-13:
```javascript
const config = {
    enableHighAccuracy: true,  // GPS accuracy
    timeout: 10000,            // Timeout in ms
    maximumAge: 0              // Cache age
};
```

## Troubleshooting

### Location Permission Denied
1. Check browser settings
2. Enable location services for the browser
3. Ensure HTTPS connection

### Map Not Loading
1. Check internet connection
2. Verify Mapbox token is valid
3. Check browser console for errors

### GPS Accuracy Issues
1. Move to open area (away from buildings)
2. Ensure high accuracy mode is enabled
3. Wait for GPS signal to stabilize

## Security Notes

- The app only accesses location when permission is granted
- No data is sent to external servers (except map tiles)
- All processing happens locally in the browser
- Consider token restrictions for production use

## Maintenance

This app is designed for minimal maintenance:
- No backend servers to maintain
- No database required
- No build process needed
- Static files only
- CDN-hosted dependencies

## License

This project is provided as-is for forest exploitation management purposes.

## Support

For issues or questions:
1. Check browser console for errors
2. Ensure all files are properly uploaded
3. Verify HTTPS is enabled
4. Test on different devices/browsers