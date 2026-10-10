import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const fetchDeforestationAnalysis = async (lat, lng, locationName, recipientEmail) => {
  try {
    const response = await axios.get(`${API_URL}/api/deforestation/detect`, {
      params: {
        lat,
        lng,
        location_name: locationName,
        recipient_email: recipientEmail
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching deforestation data:', error);
    return {
      error: error.response?.data?.detail || 'Failed to connect to the backend analysis service.'
    };
  }
};
