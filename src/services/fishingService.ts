import { supabase } from '../lib/supabase';
import type {
    FishSpecies as DBFishSpecies,
    Bait as DBBait,
    Place,
    SpeciesBaitMap,
    LocationSpeciesMap
} from '../types/database.types';

// ==============================================================================
// Export Types
// ==============================================================================

export interface FishSpecies {
    id: string;
    name: string;
    habitat: string;
    activeSeason: string[];
    cookingRecommendation?: string;
}

export interface Bait {
    id: string;
    name: string;
    category: string;
    targetDepth?: string;
    effectiveness?: number;
}

export interface BaitShop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    address?: string;
    phone?: string;
    rating?: number;
    operatingHours?: string;
    distance?: number;
}

export interface FishingSpotInfo {
    species: FishSpecies[];
    recommendedBaits: Bait[];
    nearbyBaitShops: BaitShop[];
}

// ==============================================================================
// Season Utilities
// ==============================================================================

const SEASON_MAP: Record<number, string> = {
    1: 'WINTER', 2: 'WINTER',
    3: 'SPRING', 4: 'SPRING', 5: 'SPRING',
    6: 'SUMMER', 7: 'SUMMER', 8: 'SUMMER',
    9: 'AUTUMN', 10: 'AUTUMN', 11: 'AUTUMN',
    12: 'WINTER'
};

const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export const getCurrentSeason = (): string => {
    const month = new Date().getMonth() + 1;
    return SEASON_MAP[month] || 'SPRING';
};

export const getCurrentMonth = (): string => {
    const month = new Date().getMonth();
    return MONTH_NAMES[month];
};

// ==============================================================================
// Data Fetching Functions
// ==============================================================================

/**
 * 현재 시즌에 맞는 추천 어종 목록 가져오기
 */
export const fetchSeasonalSpecies = async (): Promise<FishSpecies[]> => {
    const currentMonth = getCurrentMonth();

    const { data, error } = await supabase
        .from('fish_species')
        .select('*')
        .contains('active_season', [currentMonth]);

    if (error) {
        console.error('Error fetching seasonal species:', error);
        return [];
    }

    return data.map((species: DBFishSpecies) => ({
        id: species.id,
        name: species.korean_name,
        habitat: species.habitat_description || '',
        activeSeason: species.active_season || [],
        cookingRecommendation: species.cooking_recommendation || undefined
    }));
};

/**
 * 특정 장소에서 잡을 수 있는 어종 목록 가져오기
 */
export const fetchSpeciesByLocation = async (placeId: string): Promise<FishSpecies[]> => {
    const { data, error } = await supabase
        .from('location_species_map')
        .select(`
            season_specific,
            fish_species (
                id,
                korean_name,
                habitat_description,
                active_season,
                cooking_recommendation
            )
        `)
        .eq('place_id', placeId);

    if (error) {
        console.error('Error fetching species by location:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.fish_species.id,
        name: item.fish_species.korean_name,
        habitat: item.fish_species.habitat_description || '',
        activeSeason: item.fish_species.active_season || [],
        cookingRecommendation: item.fish_species.cooking_recommendation
    }));
};

/**
 * 특정 어종에 효과적인 미끼 목록 가져오기
 */
export const fetchBaitsBySpecies = async (speciesId: string): Promise<Bait[]> => {
    const { data, error } = await supabase
        .from('species_bait_map')
        .select(`
            effectiveness_rating,
            baits (
                id,
                name,
                category,
                target_depth
            )
        `)
        .eq('species_id', speciesId)
        .order('effectiveness_rating', { ascending: false });

    if (error) {
        console.error('Error fetching baits:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.baits.id,
        name: item.baits.name,
        category: item.baits.category || 'UNKNOWN',
        targetDepth: item.baits.target_depth,
        effectiveness: item.effectiveness_rating
    }));
};

/**
 * 여러 어종에 공통적으로 효과적인 미끼 목록 가져오기
 */
export const fetchBaitsForMultipleSpecies = async (speciesIds: string[]): Promise<Bait[]> => {
    if (speciesIds.length === 0) return [];

    const { data: mapData, error: mapError } = await supabase
        .from('species_bait_map')
        .select('bait_id, effectiveness_rating')
        .in('species_id', speciesIds);

    if (mapError || !mapData) return [];

    // Count occurrences and average effectiveness
    const baitStats: Record<string, { count: number; totalRating: number }> = {};
    mapData.forEach((item: any) => {
        if (!baitStats[item.bait_id]) {
            baitStats[item.bait_id] = { count: 0, totalRating: 0 };
        }
        baitStats[item.bait_id].count++;
        baitStats[item.bait_id].totalRating += item.effectiveness_rating || 3;
    });

    const baitIds = Object.keys(baitStats);

    const { data: baitData, error: baitError } = await supabase
        .from('baits')
        .select('*')
        .in('id', baitIds);

    if (baitError) return [];

    return baitData
        .map((bait: DBBait) => ({
            id: bait.id,
            name: bait.name,
            category: bait.category || 'UNKNOWN',
            targetDepth: bait.target_depth || undefined,
            effectiveness: Math.round(baitStats[bait.id].totalRating / baitStats[bait.id].count)
        }))
        .sort((a, b) => (b.effectiveness || 0) - (a.effectiveness || 0));
};

/**
 * 주변 낚시점 찾기
 */
export const fetchBaitShops = async (
    centerLat: number,
    centerLng: number,
    radiusKm: number = 20
): Promise<BaitShop[]> => {
    const { data, error } = await supabase
        .from('places')
        .select(`
            id,
            name,
            address,
            amenity_details (
                category,
                rating,
                operating_hours
            )
        `)
        .eq('type', 'AMENITY');

    if (error) {
        console.error('Error fetching bait shops:', error);
        return [];
    }

    // Filter for BAIT_SHOP category and calculate distance
    const shops = data
        .filter((place: any) => {
            const details = place.amenity_details;
            return details && details.category === 'BAIT_SHOP';
        })
        .map((place: any) => {
            // Note: In production, use ST_Distance from PostGIS for accurate distance
            // This is a simplified client-side calculation
            return {
                id: place.id,
                name: place.name,
                lat: 0, // Would come from location field
                lng: 0,
                address: place.address,
                rating: place.amenity_details?.rating,
                operatingHours: place.amenity_details?.operating_hours,
                distance: 0 // Placeholder
            };
        });

    return shops.slice(0, 10); // Return top 10
};

/**
 * 낚시 포인트 종합 정보 가져오기
 */
export const fetchFishingSpotInfo = async (placeId: string, lat: number, lng: number): Promise<FishingSpotInfo> => {
    // 1. Get species at this location
    const species = await fetchSpeciesByLocation(placeId);

    // 2. Get recommended baits for all species
    const speciesIds = species.map(s => s.id);
    const baits = await fetchBaitsForMultipleSpecies(speciesIds);

    // 3. Get nearby bait shops
    const shops = await fetchBaitShops(lat, lng);

    return {
        species,
        recommendedBaits: baits,
        nearbyBaitShops: shops
    };
};

/**
 * 검색어로 어종 찾기
 */
export const searchSpecies = async (query: string): Promise<FishSpecies[]> => {
    const { data, error } = await supabase
        .from('fish_species')
        .select('*')
        .ilike('korean_name', `%${query}%`);

    if (error) {
        console.error('Error searching species:', error);
        return [];
    }

    return data.map((species: DBFishSpecies) => ({
        id: species.id,
        name: species.korean_name,
        habitat: species.habitat_description || '',
        activeSeason: species.active_season || [],
        cookingRecommendation: species.cooking_recommendation || undefined
    }));
};

// ==============================================================================
// Legacy exports for backward compatibility
// ==============================================================================

export const fetchFishSpecies = fetchSpeciesByLocation;
export const fetchBaits = fetchBaitsForMultipleSpecies;
