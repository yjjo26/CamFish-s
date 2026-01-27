import { supabase } from '../lib/supabase';

export interface FishSpecies {
    id: string;
    name: string; // korean_name
    habitat: string; // habitat_description
    season?: string; // from link table
    activeTime?: 'Day' | 'Night' | 'All'; // Placeholder, not in DB yet
}

export interface Bait {
    id: string;
    name: string;
    category: string;
    description?: string;
}

export interface BaitShop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    address?: string;
    phone?: string;
    distance?: number; // Calculated distance
}

const SEASON_MAP: Record<number, string> = {
    3: 'SPRING', 4: 'SPRING', 5: 'SPRING',
    6: 'SUMMER', 7: 'SUMMER', 8: 'SUMMER',
    9: 'AUTUMN', 10: 'AUTUMN', 11: 'AUTUMN',
    12: 'WINTER', 1: 'WINTER', 2: 'WINTER'
};

export const getCurrentSeason = (): string => {
    const month = new Date().getMonth() + 1;
    return SEASON_MAP[month] || 'SPRING';
};

export const fetchFishSpecies = async (placeId: string): Promise<FishSpecies[]> => {
    // Join spot_species_season -> fish_species
    // Currently filtering by current season loosely or showing all for the spot with season info
    const currentSeason = getCurrentSeason();
    
    const { data, error } = await supabase
        .from('spot_species_season')
        .select(`
            season,
            fishing_tip,
            fish_species (
                id,
                korean_name,
                habitat_description
            )
        `)
        .eq('place_id', placeId)
        .eq('season', currentSeason);

    if (error) {
        console.error('Error fetching species:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.fish_species.id,
        name: item.fish_species.korean_name,
        habitat: item.fish_species.habitat_description,
        season: item.season,
        activeTime: 'All' // Default for now
    }));
};

export const fetchBaits = async (speciesIds: string[]): Promise<Bait[]> => {
    if (speciesIds.length === 0) return [];

    // This is a bit complex in Supabase JS to join multiple levels efficiently in one go 
    // without a view, but let's try a distinct selection via the map table.
    
    // 1. Get bait IDs for these species
    const { data: mapData, error: mapError } = await supabase
        .from('species_bait_map')
        .select('bait_id')
        .in('species_id', speciesIds);
        
    if (mapError || !mapData) return [];

    const baitIds = [...new Set(mapData.map((d: any) => d.bait_id))];

    // 2. Fetch bait details
    const { data: baitData, error: baitError } = await supabase
        .from('baits')
        .select('*')
        .in('id', baitIds);

    if (baitError) return [];

    return baitData.map((b: any) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        description: `${b.category} type bait` // Placeholder description
    }));
};

export const fetchBaitShops = async (centerLat: number, centerLng: number, radiusKm: number = 20): Promise<BaitShop[]> => {
    // Fetch places of type AMENITY and filter check names or use specific category if implemented
    // The current schema has 'amenity_details' for category but let's just fetch all AMENITY places based on name/type for simplicity first
    // ideally we use the `amenity_details` table joined with places.
    
    const { data, error } = await supabase
        .from('places')
        .select(`
            id,
            name,
            lat,
            lng,
            address,
            contact_phone,
            amenity_details!inner ( category )
        `)
        .eq('type', 'AMENITY')
        .filter('amenity_details.category', 'eq', 'BAIT_SHOP'); 

    // Note: Implicitly relying on client side distance filter for small dataset
    // PostGIS RPC would be better for real prod.

    if (error) {
        console.error('Error fetching shops:', error);
        return [];
    }

    // Client-side distance filter
    const shops = data.map((place: any) => {
        const dist = getDistanceFromLatLonInKm(centerLat, centerLng, place.lat, place.lng);
        return {
            id: place.id,
            name: place.name,
            lat: place.lat,
            lng: place.lng,
            address: place.address,
            phone: place.contact_phone,
            distance: dist
        };
    }).filter(s => s.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return shops;
};

// Helper for distance
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}
