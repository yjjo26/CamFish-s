
import { supabase } from '../lib/supabase';

export interface VectorSpot {
    id: string;
    name: string;
    location: string; // WKT or Hex
    lat: number;
    lng: number;
    distance_meters?: number;
    similarity?: number; // If vector search used similarity
    metadata?: any;
}

/**
 * Fetch spots near a location using Supabase Edge Function 'get_spots_near'
 */
export const fetchVectorSpots = async (lat: number, lng: number, radiusMeters: number = 5000, query?: string): Promise<VectorSpot[]> => {
    try {
        const { data, error } = await supabase.functions.invoke('get_spots_near', {
            body: {
                lat,
                lng,
                radius_meters: radiusMeters,
                query: query // Optional text query for embedding search
            }
        });

        if (error) {
            console.error('Error invoking get_spots_near:', error);
            return [];
        }

        if (!data) return [];

        // Assuming the function returns an array of objects
        // We might need to adapt the response structure depending on what the Edge Function returns
        return data.map((spot: any) => ({
            id: spot.id,
            name: spot.name || 'Unknown Spot',
            location: spot.location,
            lat: spot.lat || 0, // Ensure the function returns lat/lng or we parse it
            lng: spot.lng || 0,
            distance_meters: spot.dist_meters,
            metadata: spot.metadata
        }));
    } catch (e) {
        console.error('Exception in fetchVectorSpots:', e);
        return [];
    }
};
