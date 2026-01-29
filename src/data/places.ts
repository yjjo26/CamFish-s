export interface Place {
    id: number;
    name: string;
    type: 'FISHING' | 'CAMPING' | 'AMENITY' | string; // Relaxed type
    address: string;
    lat: number;
    lng: number;
    desc?: string;
    description?: string;
    image_url?: string;
}


import { supabase } from '../lib/supabase';

export const fetchPlaces = async (): Promise<Place[]> => {
    console.log("[DEBUG] fetchPlaces called");
    const { data, error } = await supabase
        .from('places')
        .select('*');

    if (error) {
        console.error('Error fetching places:', error);
        return [];
    }

    return data as Place[];
};

// Fallback/Legacy export if needed, or we can just export an empty array to satisfy types for now
// until we refactor the consumer.
export const PREDEFINED_PLACES: Place[] = [];

