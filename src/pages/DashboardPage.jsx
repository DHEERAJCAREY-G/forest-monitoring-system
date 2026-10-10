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
  AlertTriangle,
  Satellite,
  Compass,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import InteractiveMap from '../components/dashboard/InteractiveMap';
import { 
  getUserMonitoredLocations, 
  addMonitoredLocation, 
  removeMonitoredLocation,
  fetchLocationPrediction,
  fetchLocationDeforestation
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
    const radius = loc.radiusKm || 5.0;

    const [evalData, deforestData] = await Promise.all([
      fetchLocationPrediction(
        loc.lat, 
        loc.lng, 
        loc.name, 
        currentUser.uid, 
        loc.id, 
        currentUser.email
      ),
      fetchLocationDeforestation(
        loc.lat,
        loc.lng,
        radius,
        loc.name,
        currentUser.uid,
        loc.id,
        currentUser.email
      )
    ]);

    const updated = monitoredLocations.map((item) => {
      if (item.id === loc.id) {
        return {
          ...item,
          lastUpdated: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          riskScore: evalData ? evalData.prediction.risk_score : item.riskScore,
          riskLevel: evalData ? evalData.prediction.risk_level : item.riskLevel,
          riskProbability: evalData ? evalData.prediction.risk_probability : item.riskProbability,
          forestHealth: deforestData ? `${100 - Math.round(deforestData.analysis.forest_loss_percentage)}% Canopy Density` : item.forestHealth,
          deforestationStatus: deforestData ? deforestData.analysis.status : item.deforestationStatus,
          deforestationLossHectares: deforestData ? deforestData.analysis.forest_loss_hectares : item.deforestationLossHectares,
          deforestationLossPercentage: deforestData ? deforestData.analysis.forest_loss_percentage : item.deforestationLossPercentage,
          baselineNdvi: deforestData ? deforestData.analysis.baseline_ndvi : item.baselineNdvi,
          recentNdvi: deforestData ? deforestData.analysis.recent_ndvi : item.recentNdvi,
          deforestationConfidence: deforestData ? deforestData.analysis.confidence_score : item.deforestationConfidence,
          deforestationEvidence: deforestData ? deforestData.analysis.evidence : item.deforestationEvidence,
          deforestationAlerts: deforestData?.alert_triggered ? 'Active Deforestation Alert' : 'No active alerts'
        };
      }
      return item;
    });

    setMonitoredLocations(updated);
    localStorage.setItem('forest_monitoring_locations_' + currentUser.uid, JSON.stringify(updated));
    setEvaluatingId(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Compute aggregated stats
  const totalLocations = monitoredLocations.length;
  const highRiskFireCount = monitoredLocations.filter(l => l.riskLevel === 'HIGH').length;
  const deforestationAlertCount = monitoredLocations.filter(l => l.deforestationStatus === 'ALERT').length;
  const totalAlertsCount = highRiskFireCount + deforestationAlertCount;
  const totalHectaresMonitored = Math.round(
    monitoredLocations.reduce((sum, l) => sum + (l.areaHectares || (Math.PI * Math.pow(l.radiusKm || 5.0, 2) * 100)), 0)
  );

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
          <Satellite className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-emerald-200">
            Wildfire (XGBoost) & Deforestation (Sentinel-2 Harmonized) Monitoring Pipeline
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Target forest zones are bounded with user-defined monitoring radii and synchronized under your account UID in Firestore. The system executes dual-pipeline intelligence: real-time meteorological telemetry evaluated by XGBoost for wildfire risk, and Sentinel-2 cloud-masked Surface Reflectance composites evaluated for canopy loss (Delta-NDVI). Alerts are automatically dispatched if risk or deforestation thresholds are crossed.
          </p>
        </div>
      </div>

      {/* Environmental Information Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Card 1: Forest Health */}
        <div className="p-6 rounded-2xl glass-card space-y-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Canopy Health</span>
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
              <TreePine className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-extrabold font-mono text-emerald-400">
              {totalLocations > 0 ? (deforestationAlertCount > 0 ? 'WARNING' : 'HEALTHY') : 'Waiting for monitoring data'}
            </span>
            <p className="text-xs text-slate-400 mt-1">Vegetation canopy status across zones</p>
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
            {totalAlertsCount > 0 ? (
              <span className="text-2xl font-extrabold font-mono text-red-400">
                {totalAlertsCount} ACTIVE ALERTS
              </span>
            ) : (
              <span className="text-3xl font-extrabold font-mono text-emerald-300">0 ALERTS</span>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {totalLocations > 0 ? `${highRiskFireCount} Fire • ${deforestationAlertCount} Deforestation` : 'Waiting for monitoring data'}
            </p>
          </div>
        </div>

        {/* Card 4: Monitored Area */}
        <div className="p-6 rounded-2xl glass-card space-y-4 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Monitored Area</span>
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/40">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold font-mono text-cyan-300">
              {totalLocations > 0 ? `${totalHectaresMonitored.toLocaleString()} ha` : 'Waiting for monitoring data'}
            </span>
            <p className="text-xs text-slate-400 mt-1">{totalLocations} active forest zones</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {monitoredLocations.map((loc) => {
              const radius = loc.radiusKm || 5.0;
              const areaHa = loc.areaHectares || Math.round(Math.PI * Math.pow(radius, 2) * 100);
              const isEvaluating = evaluatingId === loc.id;
              const isDeforestAlert = loc.deforestationStatus === 'ALERT';
              const isDeforestWarning = loc.deforestationStatus === 'WARNING';
              const isFireAlert = loc.riskLevel === 'HIGH';

              return (
                <div 
                  key={loc.id} 
                  className={`p-5 rounded-2xl glass-card border space-y-4 transition-all ${
                    isDeforestAlert || isFireAlert 
                      ? 'border-red-500/50 bg-red-950/10' 
                      : isDeforestWarning 
                      ? 'border-amber-500/40 bg-amber-950/10' 
                      : 'border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  {/* Location Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-100 text-base">{loc.name}</h4>
                        {isDeforestAlert && (
                          <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-700 text-red-300 text-[10px] font-bold">
                            DEFORESTATION ALERT
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400">
                        <span>{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                        <span>•</span>
                        <span className="text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 font-semibold text-[11px]">
                          Radius: {radius} km (~{areaHa.toLocaleString()} ha)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleRefreshPrediction(loc)}
                        disabled={isEvaluating}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        title="Run live weather telemetry & Sentinel-2 satellite analysis"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin text-emerald-400' : ''}`} />
                        <span className="hidden sm:inline">{isEvaluating ? 'Analyzing...' : 'Run Satellite'}</span>
                      </button>

                      <button
                        onClick={() => handleRemoveLocation(loc.id)}
                        className="p-1.5 rounded-xl bg-red-950/40 text-red-300 hover:bg-red-900/60 border border-red-800/40 transition-colors"
                        title="Remove location"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Dual Pipeline Metrics Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800/60 font-mono">
                    
                    {/* Panel 1: Wildfire Prediction (XGBoost) */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center space-x-1">
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>Wildfire Risk</span>
                        </span>
                        {loc.riskLevel ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            loc.riskLevel === 'HIGH' ? 'bg-red-950 text-red-300 border-red-800' :
                            loc.riskLevel === 'MEDIUM' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                            'bg-emerald-950 text-emerald-300 border-emerald-800'
                          }`}>
                            {loc.riskLevel}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Pending</span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between">
                        {loc.riskScore !== null && loc.riskScore !== undefined ? (
                          <span className={`text-xl font-extrabold ${loc.riskScore >= 75 ? 'text-red-400' : loc.riskScore >= 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {loc.riskScore}%
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-sans italic">Waiting for monitoring data</span>
                        )}
                        <span className="text-[10px] text-slate-400 font-sans">
                          {loc.forestHealth || 'Telemetry Active'}
                        </span>
                      </div>
                    </div>

                    {/* Panel 2: Deforestation Detection (Sentinel-2 Harmonized) */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center space-x-1">
                          <Satellite className="w-3 h-3 text-cyan-400" />
                          <span>Deforestation (S2)</span>
                        </span>
                        {loc.deforestationStatus ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            loc.deforestationStatus === 'ALERT' ? 'bg-red-950 text-red-300 border-red-800' :
                            loc.deforestationStatus === 'WARNING' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                            'bg-emerald-950 text-emerald-300 border-emerald-800'
                          }`}>
                            {loc.deforestationStatus === 'ALERT' ? 'CRITICAL LOSS' : loc.deforestationStatus === 'WARNING' ? 'MODERATE LOSS' : 'STABLE'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Pending</span>
                        )}
                      </div>

                      <div>
                        {loc.deforestationLossPercentage !== null && loc.deforestationLossPercentage !== undefined ? (
                          <div className="space-y-0.5">
                            <div className="flex justify-between items-baseline">
                              <span className="text-[11px] font-bold text-slate-200">
                                Loss: {loc.deforestationLossHectares || 0} ha ({loc.deforestationLossPercentage}%)
                              </span>
                              <span className="text-[10px] text-cyan-400">
                                {loc.deforestationConfidence ? `${loc.deforestationConfidence}% Conf.` : ''}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex justify-between">
                              <span>NDVI: {loc.baselineNdvi ?? '—'} → {loc.recentNdvi ?? '—'}</span>
                              <span className="text-slate-400">10m Res</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-sans italic">Waiting for monitoring data</span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Last Analyzed: {loc.lastUpdated || 'Waiting for monitoring data'}</span>
                    </div>
                    <span className="text-emerald-400 font-semibold font-mono">Status: {loc.status || 'ACTIVE'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default DashboardPage;
