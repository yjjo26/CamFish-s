export interface Place {
    id: string; // Updated to string for UUID
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
        .from('spots')
        .select('*');

    if (error) {
        console.error('Error fetching places:', error);
        return [];
    }

    return (data || []).map((place: any) => {
        return {
            id: place.id,
            name: place.name,
            type: place.spot_type, // Map spot_type
            address: place.address || '',
            lat: place.lat || 0,
            lng: place.lng || 0,
            desc: place.description || '',
            description: place.description || '',
            image_url: undefined
        } as Place;
    });
};


// Fallback/Legacy export if needed, or we can just export an empty array to satisfy types for now
// until we refactor the consumer.
export const PREDEFINED_PLACES: Place[] = [];

