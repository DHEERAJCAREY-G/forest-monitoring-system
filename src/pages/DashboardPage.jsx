import React, { useState, useEffect } from 'react';
import { 
  TreePine, 
  Flame, 
  Radio, 
  LogOut, 
  MapPin, 
  Trash2, 
  ShieldCheck, 
  Info, 
  RefreshCw,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import InteractiveMap from '../components/dashboard/InteractiveMap';
import { 
  getUserMonitoredLocations, 
  addMonitoredLocation, 
  removeMonitoredLocation,
  fetchLocationPrediction
} from '../services/locationService';
import Spinner from '../components/common/Spinner';
import DeforestationAnalysis from '../components/dashboard/DeforestationAnalysis';

export const DashboardPage = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [monitoredLocations, setMonitoredLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [evaluatingId, setEvaluatingId] = useState(null);
  const [activeTab, setActiveTab] = useState('wildfire');

  const displayName = userProfile?.fullName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';

  // Load user's monitored locations from Firestore associated with Firebase UID
  useEffect(() => {
    const fetchLocations = async () => {
      if (currentUser?.uid) {
        setLoadingLocations(true);
        const locations = await getUserMonitoredLocations(currentUser.uid);
        setMonitoredLocations(locations);
        setLoadingLocations(false);
      }
    };
    fetchLocations();
  }, [currentUser]);

  const handleAddLocation = async (locationData) => {
    if (!currentUser?.uid) return;
    const result = await addMonitoredLocation(currentUser.uid, locationData, currentUser?.email);
    if (result.success) {
      setMonitoredLocations(result.updatedLocations);
    }
  };

  const handleRemoveLocation = async (locationId) => {
    if (!currentUser?.uid) return;
    const result = await removeMonitoredLocation(currentUser.uid, locationId);
    if (result.success) {
      setMonitoredLocations(result.updatedLocations);
    }
  };

  const handleRefreshPrediction = async (loc) => {
    setEvaluatingId(loc.id);
    const evalData = await fetchLocationPrediction(
      loc.lat, 
      loc.lng, 
      loc.name, 
      currentUser.uid, 
      loc.id, 
      currentUser.email
    );

    if (evalData) {
      const updated = monitoredLocations.map((item) => {
        if (item.id === loc.id) {
          return {
            ...item,
            lastUpdated: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            riskScore: evalData.prediction.risk_score,
            riskLevel: evalData.prediction.risk_level,
            riskProbability: evalData.prediction.risk_probability,
            forestHealth: `${100 - Math.round(evalData.prediction.risk_probability * 30)}% Vegetation Cover`,
            weatherData: evalData.weather_telemetry
          };
        }
        return item;
      });
      setMonitoredLocations(updated);
      localStorage.setItem('forest_monitoring_locations_' + currentUser.uid, JSON.stringify(updated));
    }
    setEvaluatingId(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Compute aggregated stats
  const totalLocations = monitoredLocations.length;
  const highRiskCount = monitoredLocations.filter(l => l.riskLevel === 'HIGH').length;
  const avgRiskScore = totalLocations > 0
    ? Math.round(monitoredLocations.reduce((sum, l) => sum + (l.riskScore || 0), 0) / totalLocations)
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Welcome Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Active Monitoring Session</span>
            </div>
            
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Welcome, {displayName}
            </h1>
            
            <p className="text-sm text-slate-400 font-mono">
              Account: <span className="text-emerald-400">{currentUser?.email}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm flex items-center space-x-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Information Notice */}
      <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 backdrop-blur-md flex items-start space-x-4">
        <div className="p-3 rounded-xl bg-emerald-900/40 text-emerald-400 border border-emerald-700/50 shrink-0">
          <Info className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-emerald-200">
            Wildfire Monitoring & XGBoost Predictive Pipeline
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Target forest locations are associated with your account UID in Firestore. Real-time weather telemetry is evaluated against the trained XGBoost model to predict fire risk probability and score. Alerts are automatically dispatched if the risk score crosses the configured threshold.
          </p>
        </div>
      </div>

      {/* Main Navigation Paths / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Navigation Card 1: Deforestation */}
        <div 
          onClick={() => setActiveTab('deforestation')}
          className={`p-5 rounded-xl space-y-4 border cursor-pointer transition-all ${activeTab === 'deforestation' ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analysis Module</span>
            <div className={`p-2 rounded-lg ${activeTab === 'deforestation' ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
              <TreePine className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-white">
              Deforestation
            </span>
            <p className="text-xs text-slate-400 mt-1">Satellite NDVI forest cover change detection</p>
          </div>
        </div>

        {/* Navigation Card 2: Weather Forecasting */}
        <div 
          onClick={() => setActiveTab('weather')}
          className={`p-5 rounded-xl space-y-4 border cursor-pointer transition-all ${activeTab === 'weather' ? 'border-blue-500 bg-blue-900/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analysis Module</span>
            <div className={`p-2 rounded-lg ${activeTab === 'weather' ? 'bg-blue-900 text-blue-400' : 'bg-slate-800 text-slate-400'}`}>
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-white">
              Weather Forecasting
            </span>
            <p className="text-xs text-slate-400 mt-1">Live telemetry & precipitation analysis</p>
          </div>
        </div>

        {/* Navigation Card 3: Wildfire Risk Analysis */}
        <div 
          onClick={() => setActiveTab('wildfire')}
          className={`p-5 rounded-xl space-y-4 border cursor-pointer transition-all ${activeTab === 'wildfire' ? 'border-amber-500 bg-amber-900/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Analysis Module</span>
            <div className={`p-2 rounded-lg ${activeTab === 'wildfire' ? 'bg-amber-900 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-lg font-bold text-white">
              Wildfire Risk Analysis
            </span>
            <p className="text-xs text-slate-400 mt-1">XGBoost ML probability & alert monitoring</p>
          </div>
        </div>
      </div>

      {/* Interactive Map Component */}
      <InteractiveMap 
        monitoredLocations={monitoredLocations} 
        onAddLocation={handleAddLocation} 
      />

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'deforestation' && (
          <DeforestationAnalysis 
            monitoredLocations={monitoredLocations} 
            currentUser={currentUser} 
          />
        )}
        
        {activeTab === 'weather' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-blue-900/10 border border-blue-800/20">
              <h3 className="text-lg font-bold text-blue-400 mb-2 flex items-center">
                <Radio className="w-5 h-5 mr-2" />
                Weather Forecasting & Telemetry
              </h3>
              <p className="text-sm text-slate-400">
                Live weather data and 14-day historical precipitation/temperature analysis for monitored regions.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monitoredLocations.map((loc) => (
                <div key={loc.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h4 className="font-bold text-white text-sm">{loc.name}</h4>
                  {loc.weatherData ? (
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 bg-slate-800 rounded border border-slate-700">
                        <span className="block text-slate-500 text-[10px] uppercase font-semibold">Max Temp</span>
                        <span className="text-slate-200">{loc.weatherData.max_temp}°C</span>
                      </div>
                      <div className="p-2 bg-slate-800 rounded border border-slate-700">
                        <span className="block text-slate-500 text-[10px] uppercase font-semibold">Precipitation</span>
                        <span className="text-blue-400">{loc.weatherData.precipitation} mm</span>
                      </div>
                      <div className="p-2 bg-slate-800 rounded border border-slate-700">
                        <span className="block text-slate-500 text-[10px] uppercase font-semibold">Wind Speed</span>
                        <span className="text-slate-200">{loc.weatherData.wind_speed} km/h</span>
                      </div>
                      <div className="p-2 bg-slate-800 rounded border border-slate-700">
                        <span className="block text-slate-500 text-[10px] uppercase font-semibold">Min Humidity</span>
                        <span className="text-slate-200">{loc.weatherData.min_humidity}%</span>
                      </div>
                      <div className="p-2 bg-slate-800 rounded border border-slate-700">
                        <span className="block text-slate-500 text-[10px] uppercase font-semibold">Days Since Rain</span>
                        <span className="text-amber-400">{loc.weatherData.days_since_rain} days</span>
                      </div>
                      <div className="p-2 bg-slate-800 rounded border border-slate-700">
                        <span className="block text-slate-500 text-[10px] uppercase font-semibold">14-Day Rain</span>
                        <span className="text-blue-400">{loc.weatherData['14_day_rain']?.toFixed(1) || 0} mm</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4 border border-dashed border-slate-700 rounded-xl">
                      <p className="text-xs text-slate-500">Weather data unavailable.</p>
                      <button 
                        onClick={() => handleRefreshPrediction(loc)}
                        disabled={evaluatingId === loc.id}
                        className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        {evaluatingId === loc.id ? 'Loading...' : 'Fetch Weather Data'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {monitoredLocations.length === 0 && (
                <div className="col-span-1 md:col-span-2 text-center p-8 border border-dashed border-slate-800 rounded-2xl text-slate-400 text-sm">
                  Please add locations on the map to view weather telemetry.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'wildfire' && (
          <div className="space-y-6">
            {/* Monitored Locations Manager Table / Grid */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                    <span>Wildfire Risk Assessment (XGBoost)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live prediction based on weather data for your target coordinates.
                  </p>
                </div>

                <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-slate-300 font-semibold">
                  Total Locations: {monitoredLocations.length}
                </span>
              </div>

              {loadingLocations ? (
                <Spinner size="md" label="Loading monitored coordinates..." />
              ) : monitoredLocations.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-800 space-y-3 bg-slate-950/40">
                  <MapPin className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">No Monitored Locations Added Yet</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Use the interactive map above to select and save forest coordinates to monitor.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {monitoredLocations.map((loc) => (
                    <div 
                      key={loc.id} 
                      className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-slate-100 text-sm">{loc.name}</h4>
                          <p className="text-xs font-mono text-slate-400">
                            {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleRefreshPrediction(loc)}
                            disabled={evaluatingId === loc.id}
                            className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/50 transition-colors"
                            title="Refresh live weather & prediction"
                          >
                            <RefreshCw className={`w-4 h-4 ${evaluatingId === loc.id ? 'animate-spin' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleRemoveLocation(loc.id)}
                            className="p-1.5 rounded-lg bg-red-950/40 text-red-300 hover:bg-red-900/60 border border-red-800/40 transition-colors"
                            title="Remove location"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Prediction Metrics Display */}
                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800/60 font-mono">
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Fire Risk</span>
                          {loc.riskScore !== null && loc.riskScore !== undefined ? (
                            <span className={`text-base font-extrabold ${loc.riskScore >= 75 ? 'text-red-400' : loc.riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {loc.riskScore}%
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-sans italic">Waiting for monitoring data</span>
                          )}
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Risk Level</span>
                          {loc.riskLevel ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border inline-block mt-0.5 ${
                              loc.riskLevel === 'HIGH' ? 'bg-red-950 text-red-300 border-red-800' :
                              loc.riskLevel === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                              'bg-emerald-950 text-emerald-300 border-emerald-800'
                            }`}>
                              {loc.riskLevel}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-sans italic">Waiting for monitoring data</span>
                          )}
                        </div>
                      </div>

                      {/* Metadata Row */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Last Updated: {loc.lastUpdated || 'Waiting for monitoring data'}</span>
                        </div>
                        <span className="text-emerald-400 font-semibold font-mono">Status: {loc.status || 'ACTIVE'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default DashboardPage;
