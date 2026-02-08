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

    // location GEOGRAPHY에서 좌표 추출 (format: "POINT(lng lat)")
    return (data || []).map((place: any) => {
        let lat = 0, lng = 0;
        if (place.location) {
            const match = String(place.location).match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
            if (match) {
                lng = parseFloat(match[1]);
                lat = parseFloat(match[2]);
            }
        }
        return {
            id: place.id,
            name: place.name,
            type: place.type,
            address: place.address || '',
            lat,
            lng,
            desc: place.description,
            description: place.description,
            image_url: undefined  // 스키마에 없는 컬럼이므로 undefined
        } as Place;
    });
};

// Fallback/Legacy export if needed, or we can just export an empty array to satisfy types for now
// until we refactor the consumer.
export const PREDEFINED_PLACES: Place[] = [];

