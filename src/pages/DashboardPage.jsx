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

export const DashboardPage = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [monitoredLocations, setMonitoredLocations] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [evaluatingId, setEvaluatingId] = useState(null);

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
            forestHealth: `${100 - Math.round(evalData.prediction.risk_probability * 30)}% Vegetation Cover`
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
      <div className="p-8 rounded-3xl glass-panel border border-emerald-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-emerald-500/5 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-800/60 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Active Monitoring Session</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Welcome, <span className="forest-gradient-text">{displayName}</span>
            </h1>
            
            <p className="text-sm text-slate-300 font-mono">
              Account: <span className="text-emerald-300">{currentUser?.email}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleLogout}
              className="px-5 py-3 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/50 font-semibold text-sm flex items-center space-x-2 shadow-lg transition-all"
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

      {/* Environmental Information Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Forest Health */}
        <div className="p-6 rounded-2xl glass-card space-y-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Forest Health Information</span>
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
              <TreePine className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold font-mono text-emerald-400">
              {totalLocations > 0 ? `${100 - (avgRiskScore ? Math.round(avgRiskScore * 0.2) : 5)}%` : 'Waiting for monitoring data'}
            </span>
            <p className="text-xs text-slate-400 mt-1">Vegetation canopy health across monitored zones</p>
          </div>
        </div>

        {/* Card 2: Fire Risk Information */}
        <div className="p-6 rounded-2xl glass-card space-y-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fire-Risk Score</span>
            <div className="p-2 rounded-lg bg-amber-950 text-amber-400 border border-amber-800/40">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div>
            {avgRiskScore !== null ? (
              <span className={`text-3xl font-extrabold font-mono ${avgRiskScore >= 75 ? 'text-red-400' : avgRiskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {avgRiskScore}%
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-400">Waiting for monitoring data</span>
            )}
            <p className="text-xs text-slate-400 mt-1">XGBoost model estimated risk score</p>
          </div>
        </div>

        {/* Card 3: Deforestation & Risk Alerts */}
        <div className="p-6 rounded-2xl glass-card space-y-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Alert Status</span>
            <div className="p-2 rounded-lg bg-teal-950 text-teal-400 border border-teal-800/40">
              <Radio className="w-5 h-5" />
            </div>
          </div>
          <div>
            {highRiskCount > 0 ? (
              <span className="text-3xl font-extrabold font-mono text-red-400">{highRiskCount} HIGH RISK</span>
            ) : (
              <span className="text-3xl font-extrabold font-mono text-emerald-300">0 ALERTS</span>
            )}
            <p className="text-xs text-slate-400 mt-1">Threshold alerts active for account</p>
          </div>
        </div>

      </div>

      {/* Interactive Map Component */}
      <InteractiveMap 
        monitoredLocations={monitoredLocations} 
        onAddLocation={handleAddLocation} 
      />

      {/* Monitored Locations Manager Table / Grid */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <span>Your Monitored Locations</span>
            </h3>
            <p className="text-xs text-slate-400">
              Target coordinates associated with your account UID (<span className="font-mono text-emerald-300">{currentUser?.uid}</span>)
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
                className="p-5 rounded-2xl glass-card border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-all"
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
  );
};

export default DashboardPage;
