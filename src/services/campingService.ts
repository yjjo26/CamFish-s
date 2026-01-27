import { supabase } from '../lib/supabase';

export interface CampingGear {
    id: string;
    name: string;
    category: string;
    isEssential: boolean;
    reason?: string;
}

export interface CampingRecipe {
    id: string;
    name: string;
    ingredients: string[];
    method: string;
    difficulty: number;
}

export interface CampingSpotDetail {
    placeId: string;
    campType: string;
    floorType?: string;
    facilities: {
        electricity: boolean;
        hotWater: boolean;
        wifi: boolean;
        petFriendly: boolean;
    };
    price?: number;
    checkIn?: string;
    checkOut?: string;
}

export interface CampAmenity {
    id: string;
    name: string;
    type: 'STORE' | 'GAS' | 'RESTAURANT';
    lat: number;
    lng: number;
    distance?: number;
    address?: string;
    phone?: string;
}

// Fetch details for a specific camping spot
export const fetchCampingDetails = async (placeId: string): Promise<CampingSpotDetail | null> => {
    const { data, error } = await supabase
        .from('camping_spot_details')
        .select('*')
        .eq('place_id', placeId)
        .single();

    if (error) {
        // console.error('Error fetching camping details:', error);
        return null;
    }

    return {
        placeId: data.place_id,
        campType: data.camp_type,
        floorType: data.floor_type,
        facilities: {
            electricity: data.has_electricity,
            hotWater: data.has_hot_water,
            wifi: data.has_wifi,
            petFriendly: data.is_pet_friendly
        },
        price: data.base_fee,
        checkIn: data.check_in_time,
        checkOut: data.check_out_time
    };
};

export const fetchRecommendedGear = async (placeId: string): Promise<CampingGear[]> => {
    // Join spot_gear_recommendation -> camping_gear
    const { data, error } = await supabase
        .from('spot_gear_recommendation')
        .select(`
            reason,
            camping_gear (
                id,
                name,
                category,
                is_essential_for_winter
            )
        `)
        .eq('place_id', placeId);

    if (error || !data) return [];

    return data.map((item: any) => ({
        id: item.camping_gear.id,
        name: item.camping_gear.name,
        category: item.camping_gear.category,
        isEssential: item.camping_gear.is_essential_for_winter, // Using winter essential as a proxy for "Essential" trigger for now
        reason: item.reason
    }));
};

export const fetchCampingRecipes = async (): Promise<CampingRecipe[]> => {
    // Fetch random 3 recipes for now (or seasonal)
    const { data, error } = await supabase
        .from('camping_recipes')
        .select('*')
        .limit(3);

    if (error || !data) return [];

    return data.map((r: any) => ({
        id: r.id,
        name: r.name,
        ingredients: r.ingredients || [],
        method: r.cooking_method,
        difficulty: r.difficulty_level
    }));
};

export const fetchNearbyAmenities = async (centerLat: number, centerLng: number, radiusKm: number = 20): Promise<CampAmenity[]> => {
    // Similar to bait shops, but looking for generic amenities
    // Real implementation should use PostGIS ST_DWithin

    // Fetch 'amenity' type places
    const { data, error } = await supabase
        .from('places')
        .select(`
            id,
            name,
            lat,
            lng,
            address,
            contact_phone,
            amenity_details ( category )
        `)
        .eq('type', 'AMENITY');

    if (error || !data) return [];

    // Filter by Amenity Type (e.g., exclude Bait Shops if we only want regular stores)
    // For now, let's include anything that is NOT a Bait Shop, or specific types like Convenience Store

    const amenities = data
        .filter((p: any) => {
            // Check if amenity_details exists and is not empty array/object
            const details = p.amenity_details;
            // If details is an array (supa quirk sometimes) or object
            const cat = Array.isArray(details) ? details[0]?.category : details?.category;
            return cat !== 'BAIT_SHOP'; // Exclude bait shops for camping context maybe? or keep them?
        })
        .map((place: any) => {
            const dist = getDistanceFromLatLonInKm(centerLat, centerLng, place.lat, place.lng);
            return {
                id: place.id,
                name: place.name,
                type: 'STORE', // Generic for now, ideally map from amenity_details.category
                lat: place.lat,
                lng: place.lng,
                address: place.address,
                phone: place.contact_phone,
                distance: dist
            };
        })
        .filter((s: any) => s.distance <= radiusKm)
        .sort((a: any, b: any) => a.distance - b.distance);

    return amenities as CampAmenity[];
};

// Helper for distance (Duplicate from fishingService, could extract to utils)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}
