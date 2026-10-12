import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';

const LOCAL_STORAGE_KEY_PREFIX = 'forest_monitoring_locations_';
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8000';

/**
 * Fetch monitored locations for a specific user UID
 */
export const getUserMonitoredLocations = async (userId) => {
  if (!userId) return [];

  const cached = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + userId);
  let localLocations = [];
  if (cached) {
    try {
      localLocations = JSON.parse(cached);
    } catch (e) {
      console.warn('Local storage parse error:', e);
    }
  }

  try {
    const locationsRef = collection(db, 'monitored_locations');
    const q = query(locationsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    const remoteLocations = [];
    querySnapshot.forEach((docSnap) => {
      remoteLocations.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (remoteLocations.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + userId, JSON.stringify(remoteLocations));
      return remoteLocations;
    }
  } catch (error) {
    console.warn('[Location Service] Firestore fetch warning, using local cache:', error.message);
  }

  return localLocations;
};

/**
 * Fetch prediction & weather telemetry from backend API for a given location
 */
export const fetchLocationPrediction = async (lat, lng, name, userId, locationId, userEmail) => {
  try {
    const url = `${BACKEND_API_URL}/api/monitoring/evaluate-location?lat=${lat}&lng=${lng}&location_name=${encodeURIComponent(name)}&user_id=${userId}&location_id=${locationId}&recipient_email=${encodeURIComponent(userEmail || 'user@forestmonitoring.org')}`;
    const response = await fetch(url, { method: 'POST' });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Location Service] Backend inference API fetch warning:', err.message);
  }
  return null;
};

/**
 * Fetch deforestation evaluation & Sentinel-2 change detection from backend API
 */
export const fetchLocationDeforestation = async (
  lat, 
  lng, 
  radiusKm, 
  name, 
  userId, 
  locationId, 
  userEmail, 
  forceLoss = null, 
  polygonCoordinates = null
) => {
  try {
    const payload = {
      latitude: lat,
      longitude: lng,
      radius_km: radiusKm || 5.0,
      polygon_coordinates: polygonCoordinates,
      location_name: name,
      user_id: userId,
      location_id: locationId,
      recipient_email: userEmail || 'user@forestmonitoring.org'
    };
    if (forceLoss !== null) {
      payload.force_simulated_loss = forceLoss;
    }

    const response = await fetch(`${BACKEND_API_URL}/api/deforestation/evaluate-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Location Service] Deforestation API fetch warning:', err.message);
  }
  return null;
};

/**
 * Save a new monitored coordinate/location associated with user UID
 */
export const addMonitoredLocation = async (userId, locationData, userEmail = '') => {
  if (!userId) return { success: false, error: 'User ID is required' };

  const locationId = 'loc_' + Date.now();
  const radiusKm = Number(locationData.radiusKm) || 5.0;
  const areaHectares = Math.round(Math.PI * Math.pow(radiusKm, 2) * 100 * 100) / 100;
  
  // Try fetching initial ML prediction & satellite deforestation analysis in parallel
  const [evalData, deforestData] = await Promise.all([
    fetchLocationPrediction(
      locationData.lat, 
      locationData.lng, 
      locationData.name, 
      userId, 
      locationId, 
      userEmail
    ),
    fetchLocationDeforestation(
      locationData.lat,
      locationData.lng,
      radiusKm,
      locationData.name,
      userId,
      locationId,
      userEmail,
      null,
      locationData.polygon_coordinates || null
    )
  ]);

  const newLocation = {
    id: locationId,
    userId,
    name: locationData.name || `Location (${locationData.lat.toFixed(4)}, ${locationData.lng.toFixed(4)})`,
    lat: Number(locationData.lat),
    lng: Number(locationData.lng),
    radiusKm: radiusKm,
    areaHectares: areaHectares,
    addedAt: new Date().toISOString(),
    status: 'ACTIVE',
    lastUpdated: (evalData || deforestData) ? new Date().toLocaleString() : null,
    riskScore: evalData ? evalData.prediction.risk_score : null,
    riskLevel: evalData ? evalData.prediction.risk_level : null,
    riskProbability: evalData ? evalData.prediction.risk_probability : null,
    forestHealth: deforestData ? `${100 - Math.round(deforestData.analysis.forest_loss_percentage || 0)}% Canopy Density` : (evalData ? `${100 - Math.round(evalData.prediction.risk_probability * 30)}% Vegetation Density` : null),
    // Deforestation Metrics
    deforestationStatus: deforestData ? deforestData.analysis.status : null,
    deforestationLossHectares: deforestData ? deforestData.analysis.forest_loss_hectares : null,
    deforestationLossPercentage: deforestData ? deforestData.analysis.forest_loss_percentage : null,
    baselineNdvi: deforestData ? deforestData.analysis.baseline_ndvi : null,
    recentNdvi: deforestData ? (deforestData.analysis.comparison_ndvi || deforestData.analysis.recent_ndvi) : null,
    deforestationConfidence: deforestData ? deforestData.analysis.confidence_score : null,
    dataQuality: deforestData ? deforestData.analysis.data_quality : null,
    baselineScenesCount: deforestData ? deforestData.analysis.baseline_scenes_count : null,
    comparisonScenesCount: deforestData ? deforestData.analysis.comparison_scenes_count : null,
    observationDates: deforestData ? deforestData.analysis.observation_dates : null,
    deforestationEvidence: deforestData ? deforestData.analysis.evidence : null,
    deforestationAlerts: deforestData?.alert_triggered ? 'Active Deforestation Alert' : 'No active alerts'
  };

  // Sync to local storage
  const current = await getUserMonitoredLocations(userId);
  const updated = [newLocation, ...current];
  localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + userId, JSON.stringify(updated));

  // Sync to Firestore
  try {
    const locRef = doc(db, 'monitored_locations', locationId);
    await setDoc(locRef, {
      ...newLocation,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn('[Location Service] Firestore save warning:', error.message);
  }

  return { success: true, location: newLocation, updatedLocations: updated };
};

/**
 * Remove a monitored location
 */
export const removeMonitoredLocation = async (userId, locationId) => {
  if (!userId || !locationId) return { success: false };

  const current = await getUserMonitoredLocations(userId);
  const updated = current.filter((loc) => loc.id !== locationId);
  localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + userId, JSON.stringify(updated));

  try {
    const locRef = doc(db, 'monitored_locations', locationId);
    await deleteDoc(locRef);
  } catch (error) {
    console.warn('[Location Service] Firestore delete warning:', error.message);
  }

  return { success: true, updatedLocations: updated };
};
