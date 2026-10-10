import React, { useState } from 'react';
import { TreePine, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { fetchDeforestationAnalysis } from '../../services/deforestationService';
import Spinner from '../common/Spinner';

export const DeforestationAnalysis = ({ monitoredLocations, currentUser }) => {
  const [analyzingId, setAnalyzingId] = useState(null);
  const [results, setResults] = useState({});

  const handleAnalyze = async (loc) => {
    setAnalyzingId(loc.id);
    const result = await fetchDeforestationAnalysis(
      loc.lat,
      loc.lng,
      loc.name,
      currentUser.email
    );
    setResults(prev => ({
      ...prev,
      [loc.id]: result
    }));
    setAnalyzingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 backdrop-blur-md">
        <h3 className="text-lg font-bold text-emerald-300 mb-2 flex items-center">
          <TreePine className="w-5 h-5 mr-2" />
          Deforestation Detection Module
        </h3>
        <p className="text-sm text-slate-300">
          This module uses Google Earth Engine and Sentinel-2 satellite imagery to calculate NDVI (Normalized Difference Vegetation Index) changes over a specified period. Significant drops in NDVI may indicate deforestation or forest degradation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {monitoredLocations.map((loc) => {
          const result = results[loc.id];
          return (
            <div key={loc.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">{loc.name}</h4>
                  <p className="text-xs font-mono text-slate-400">
                    {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                  </p>
                </div>
                <button
                  onClick={() => handleAnalyze(loc)}
                  disabled={analyzingId === loc.id}
                  className="px-3 py-1.5 rounded-lg bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 border border-emerald-700/50 transition-colors text-xs font-semibold flex items-center"
                >
                  {analyzingId === loc.id ? <Spinner size="sm" /> : 'Run Analysis'}
                </button>
              </div>

              {result && (
                <div className={`p-4 rounded-xl border ${result.deforestation_detected ? 'bg-red-950/20 border-red-800/50' : 'bg-emerald-950/20 border-emerald-800/50'}`}>
                  {result.error ? (
                    <p className="text-red-400 text-xs">{result.error}</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${result.deforestation_detected ? 'bg-red-900 text-red-200' : 'bg-emerald-900 text-emerald-200'}`}>
                          {result.deforestation_detected ? 'Deforestation Detected' : 'Forest Cover Stable'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Max NDVI</span>
                          <span className="text-slate-200">{result.max_ndvi?.toFixed(4)}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">Min NDVI</span>
                          <span className="text-slate-200">{result.min_ndvi?.toFixed(4)}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800 col-span-2">
                          <span className="text-slate-400 block text-[10px]">NDVI Drop</span>
                          <span className={result.deforestation_detected ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                            {result.ndvi_drop?.toFixed(4)}
                          </span>
                        </div>
                      </div>
                      
                      {result.email_dispatched && (
                        <p className="text-[10px] text-red-300 flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Alert email dispatched
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {monitoredLocations.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center p-8 border border-dashed border-slate-800 rounded-2xl text-slate-400 text-sm">
            Please add locations on the map to run deforestation analysis.
          </div>
        )}
      </div>
    </div>
  );
};

export default DeforestationAnalysis;
