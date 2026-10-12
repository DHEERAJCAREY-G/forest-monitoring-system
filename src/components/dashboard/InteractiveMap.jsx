import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { MaptilerLayer } from '@maptiler/leaflet-maptilersdk';
import { MapPin, Plus, Navigation, Layers, CheckCircle2, Compass, CircleDot, Globe } from 'lucide-react';

// Custom Leaflet Pin Icon Fix for React-Leaflet
const createCustomIcon = (color = '#10b981') => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background-color: #ffffff;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
};

const activePinIcon = createCustomIcon('#10b981'); // Emerald
const selectedPinIcon = createCustomIcon('#f59e0b'); // Amber

// Map click handler sub-component with coordinate wrapping (-180 to 180)
function LocationPickerMarker({ selectedCoords, setSelectedCoords }) {
  useMapEvents({
    click(e) {
      // Leaflet can return unwrapped longitudes (e.g. > 180 or < -180) when user scrolls past world copy.
      // e.latlng.wrap() normalizes longitude strictly to [-180, 180] and clamps latitude to [-90, 90].
      const wrapped = e.latlng.wrap();
      setSelectedCoords({
        lat: Number(wrapped.lat.toFixed(4)),
        lng: Number(wrapped.lng.toFixed(4))
      });
    },
  });

  return selectedCoords ? (
    <Marker position={[selectedCoords.lat, selectedCoords.lng]} icon={selectedPinIcon}>
      <Popup>
        <div className="text-xs font-sans">
          <p className="font-bold text-slate-800">Selected Target Coordinates</p>
          <p className="text-slate-600 font-mono">{selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}</p>
        </div>
      </Popup>
    </Marker>
  ) : null;
}

// MapTiler Hybrid Layer sub-component with explicit English language configuration
function MapTilerHybridLayer({ apiKey }) {
  const map = useMap();

  useEffect(() => {
    if (!apiKey) return;
    let mtLayer = null;
    try {
      mtLayer = new MaptilerLayer({
        apiKey: apiKey,
        style: 'hybrid', // Satellite imagery + roads + labels
        language: 'en'   // Documented English language configuration
      });
      mtLayer.addTo(map);
    } catch (err) {
      console.warn('[InteractiveMap] MapTiler layer init warning:', err);
    }

    return () => {
      if (mtLayer) {
        try {
          map.removeLayer(mtLayer);
        } catch (e) {
          // ignore cleanup
        }
      }
    };
  }, [map, apiKey]);

  return null;
}

export const InteractiveMap = ({ monitoredLocations, onAddLocation }) => {
  const defaultCenter = [0, 0];
  const [selectedCoords, setSelectedCoords] = useState({ lat: -3.4653, lng: -62.2159 }); // Amazon Rainforest default
  const [radiusKm, setRadiusKm] = useState(5.0);
  const [locationName, setLocationName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // MapTiler API Key from secure environment variable
  const maptilerApiKey = import.meta.env.VITE_MAPTILER_API_KEY || '';

  // Preset forest locations across world regions (India, China, Japan, Korea, Europe, Americas)
  const presets = [
    { name: 'Amazon Rainforest Zone', lat: -3.4653, lng: -62.2159, radius: 5.0 },
    { name: 'Western Ghats Sanctuary (India)', lat: 10.1632, lng: 77.0118, radius: 2.0 },
    { name: 'Sichuan Forest Reserve (China)', lat: 30.5728, lng: 103.9215, radius: 5.0 },
    { name: 'Yakushima Ancient Forest (Japan)', lat: 30.3444, lng: 130.5286, radius: 5.0 },
    { name: 'Seoraksan Biosphere (South Korea)', lat: 38.1192, lng: 128.4656, radius: 5.0 },
    { name: 'Black Forest Reserve (Europe)', lat: 48.0537, lng: 8.2037, radius: 5.0 },
    { name: 'Pacific Northwest Reserve (North America)', lat: 46.8523, lng: -121.7603, radius: 5.0 },
    { name: 'Congo Basin Sector B', lat: -0.2280, lng: 15.8277, radius: 10.0 }
  ];

  const handleSelectPreset = (preset) => {
    setSelectedCoords({ lat: preset.lat, lng: preset.lng });
    setLocationName(preset.name);
    if (preset.radius) setRadiusKm(preset.radius);
  };

  const handleAddCurrent = async (e) => {
    e.preventDefault();
    if (!selectedCoords) return;

    setIsAdding(true);
    const finalName = locationName.trim() || `Location (${selectedCoords.lat}, ${selectedCoords.lng})`;
    
    await onAddLocation({
      name: finalName,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      radiusKm: Number(radiusKm)
    });

    setFeedbackMsg(`Location "${finalName}" (${radiusKm} km radius) added to monitoring system.`);
    setLocationName('');
    setIsAdding(false);

    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  return (
    <div className="space-y-4">
      
      {/* Map Control Bar */}
      <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Navigation className="w-4 h-4 text-emerald-400" />
            <span>Interactive Map & Location Selector</span>
          </h3>
          <p className="text-xs text-slate-400">
            Click anywhere on the satellite map or select preset coordinates to add a location for monitoring.
          </p>
        </div>

        {/* Quick Presets Dropdown & Language Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Labels: English (Global)</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider shrink-0">Preset Zones:</span>
            <select
              onChange={(e) => {
                const p = presets[e.target.value];
                if (p) handleSelectPreset(p);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Choose Forest Region --</option>
              {presets.map((p, idx) => (
                <option key={idx} value={idx}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Map Viewer Container */}
      <div className="relative rounded-3xl overflow-hidden border border-emerald-900/40 shadow-2xl h-[420px] z-10">
        <MapContainer
          center={[selectedCoords.lat, selectedCoords.lng]}
          zoom={4}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          {/* Tile Layer Provider with Global English Labels */}
          {maptilerApiKey ? (
            <MapTilerHybridLayer apiKey={maptilerApiKey} />
          ) : (
            <>
              {/* High-Resolution Satellite Base Layer (Esri World Imagery) */}
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              {/* Esri World Reference Boundaries & English Labels Overlay (Watermark-free, key-free) */}
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, USGS'
                url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                zIndex={650}
                maxZoom={19}
              />
            </>
          )}

          {/* Location Picker Click Event */}
          <LocationPickerMarker 
            selectedCoords={selectedCoords} 
            setSelectedCoords={setSelectedCoords} 
          />

          {/* Monitoring Radius Circle for Selected Target */}
          {selectedCoords && (
            <Circle
              center={[selectedCoords.lat, selectedCoords.lng]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '5, 5'
              }}
            />
          )}

          {/* Render User's Monitored Locations Pins & Defined Radius Circles */}
          {monitoredLocations.map((loc) => {
            const locRadius = loc.radiusKm || 5.0;
            const isAlert = loc.deforestationStatus === 'ALERT' || loc.deforestationStatus === 'CONFIRMED_DEFORESTATION' || loc.riskLevel === 'HIGH';
            const isWarning = loc.deforestationStatus === 'WARNING' || loc.deforestationStatus === 'POTENTIAL_FOREST_LOSS' || loc.riskLevel === 'MEDIUM';
            const circleColor = isAlert ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';

            return (
              <React.Fragment key={loc.id}>
                <Circle
                  center={[loc.lat, loc.lng]}
                  radius={locRadius * 1000}
                  pathOptions={{
                    color: circleColor,
                    fillColor: circleColor,
                    fillOpacity: 0.12,
                    weight: 1.5
                  }}
                />
                <Marker 
                  position={[loc.lat, loc.lng]} 
                  icon={activePinIcon}
                >
                  <Popup>
                    <div className="text-xs font-sans space-y-1.5 p-0.5">
                      <p className="font-bold text-slate-900 text-sm">{loc.name}</p>
                      <p className="text-slate-600 font-mono">Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}</p>
                      <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Radius: {locRadius} km • Area: {Math.round(Math.PI * locRadius * locRadius * 100).toLocaleString()} ha
                      </div>
                      <div className="pt-1.5 border-t border-slate-200 text-[11px] space-y-1">
                        <p className="flex justify-between">
                          <span className="text-slate-500 font-medium">Vegetation:</span>
                          <span className="font-bold text-emerald-700">{loc.forestHealth || 'Stable'}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-500 font-medium">Fire Risk:</span>
                          <span className={`font-bold ${loc.riskScore >= 75 ? 'text-red-600' : loc.riskScore >= 40 ? 'text-amber-600' : 'text-emerald-700'}`}>
                            {loc.riskScore !== null && loc.riskScore !== undefined ? `${loc.riskScore}%` : 'Waiting for monitoring data'}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-slate-500 font-medium">Deforestation:</span>
                          <span className={`font-bold ${(loc.deforestationStatus === 'ALERT' || loc.deforestationStatus === 'CONFIRMED_DEFORESTATION') ? 'text-red-600' : (loc.deforestationStatus === 'WARNING' || loc.deforestationStatus === 'POTENTIAL_FOREST_LOSS') ? 'text-amber-600' : loc.deforestationStatus === 'INSUFFICIENT_DATA' ? 'text-slate-500' : 'text-emerald-700'}`}>
                            {loc.deforestationStatus || 'Waiting for monitoring data'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Selected Coordinates & Defined Radius Form Box */}
      <form onSubmit={handleAddCurrent} className="p-4 rounded-2xl glass-card border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          {/* Coordinates Display */}
          <div className="flex items-center space-x-2 text-xs font-mono bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 shrink-0">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-400">Lat:</span>
            <span className="text-amber-300 font-bold">{selectedCoords.lat}</span>
            <span className="text-slate-400 ml-2">Lng:</span>
            <span className="text-amber-300 font-bold">{selectedCoords.lng}</span>
          </div>

          {/* Defined Radius Selector */}
          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
            <CircleDot className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-slate-400 font-medium">Radius:</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="bg-transparent text-xs text-emerald-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value={1} className="bg-slate-900 text-slate-200">1 km (~314 ha)</option>
              <option value={2} className="bg-slate-900 text-slate-200">2 km (~1,257 ha)</option>
              <option value={5} className="bg-slate-900 text-slate-200">5 km (~7,854 ha)</option>
              <option value={10} className="bg-slate-900 text-slate-200">10 km (~31,416 ha)</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Custom location label (optional)..."
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
          />
        </div>

        <button
          type="submit"
          disabled={isAdding}
          className="w-full lg:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg flex items-center justify-center space-x-2 border border-emerald-400/20 transition-all disabled:opacity-50 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Monitored Area ({Math.round(Math.PI * radiusKm * radiusKm * 100).toLocaleString()} ha)</span>
        </button>
      </form>

    </div>
  );
};

export default InteractiveMap;
