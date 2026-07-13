import { Client } from '@googlemaps/google-maps-services-js';
import { GOOGLE_MAPS_API_KEY } from '../config/env.js';

const mapsClient = new Client({});

/**
 * Geocode an address
 * @param {string} address - The physical address to geocode
 * @returns {Promise<Object>} Geocoding results
 */
export const geocodeAddress = async (address) => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error('Google Maps API Key is missing in environment configuration.');
    }

    const response = await mapsClient.geocode({
      params: {
        address: address,
        key: GOOGLE_MAPS_API_KEY,
      },
      timeout: 5000, // milliseconds
    });

    if (response.data.status === 'OK') {
      return response.data.results;
    } else {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }
  } catch (error) {
    console.error('Error in geocodeAddress service:', error.message);
    throw error;
  }
};

export default mapsClient;
