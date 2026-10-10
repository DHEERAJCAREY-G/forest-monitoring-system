import ee
import os
import json
from google.oauth2.service_account import Credentials

def initialize_ee():
    try:
        creds_path = os.path.join(os.path.dirname(__file__), 'ee-service-account.json')
        if not os.path.exists(creds_path):
            raise FileNotFoundError(f"Earth Engine credentials not found at {creds_path}")
        
        # Load credentials
        creds = Credentials.from_service_account_file(
            creds_path,
            scopes=['https://www.googleapis.com/auth/earthengine']
        )
        # Initialize Earth Engine
        ee.Initialize(creds)
        print("Earth Engine initialized successfully")
    except Exception as e:
        print(f"Error initializing Earth Engine: {e}")
        raise e

def detect_deforestation(lat, lng, start_date='2022-01-01', end_date='2022-12-31'):
    """
    Detect deforestation using Sentinel-2 and NDVI.
    For demonstration, we calculate the max and min NDVI over the period, and return a change metric.
    """
    try:
        point = ee.Geometry.Point([lng, lat])
        collection = ee.ImageCollection('COPERNICUS/S2_SR') \
            .filterBounds(point) \
            .filterDate(start_date, end_date) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        
        if collection.size().getInfo() == 0:
            return {"error": "No images found for the specified period and location."}
            
        def calculate_ndvi(image):
            ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
            return image.addBands(ndvi)
        
        ndvi_collection = collection.map(calculate_ndvi)
        
        # Calculate max and min NDVI to find change
        max_ndvi = ndvi_collection.select('NDVI').max().reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point,
            scale=10
        ).getInfo()
        
        min_ndvi = ndvi_collection.select('NDVI').min().reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point,
            scale=10
        ).getInfo()
        
        ndvi_max_val = max_ndvi.get('NDVI', 0)
        ndvi_min_val = min_ndvi.get('NDVI', 0)
        
        if ndvi_max_val is None or ndvi_min_val is None:
            return {"error": "Could not compute NDVI."}
            
        # Simplified logic: If the drop in NDVI is significant, it might indicate deforestation
        ndvi_drop = ndvi_max_val - ndvi_min_val
        is_deforested = ndvi_drop > 0.3 # Arbitrary threshold for demonstration
        
        return {
            "lat": lat,
            "lng": lng,
            "max_ndvi": ndvi_max_val,
            "min_ndvi": ndvi_min_val,
            "ndvi_drop": ndvi_drop,
            "deforestation_detected": is_deforested,
            "message": "Significant NDVI drop detected." if is_deforested else "Forest cover seems stable."
        }
    except Exception as e:
        return {"error": f"Error calculating deforestation: {e}"}
