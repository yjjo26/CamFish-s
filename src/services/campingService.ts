import { supabase } from '../lib/supabase';
import type {
    CampingGear as DBCampingGear,
    CampingRecipe as DBCampingRecipe
} from '../types/database.types';

// ==============================================================================
// Export Types
// ==============================================================================

export interface CampingGear {
    id: string;
    name: string;
    category: string;
    isEssentialForWinter: boolean;
    description?: string;
    reason?: string; // From spot recommendation
}

export interface CampingRecipe {
    id: string;
    name: string;
    ingredients: string[];
    method: string;
    difficulty: number;
    bestSeason?: string;
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
    type: 'STORE' | 'GAS' | 'RESTAURANT' | 'CONVENIENCE_STORE';
    lat: number;
    lng: number;
    distance?: number;
    address?: string;
    phone?: string;
    rating?: number;
    operatingHours?: string;
    signatureMenu?: string;
}

export interface CampingSpotInfo {
    details: CampingSpotDetail | null;
    recommendedGear: CampingGear[];
    nearbyAmenities: CampAmenity[];
    recommendedRecipes: CampingRecipe[];
}

// ==============================================================================
// Season Utilities
// ==============================================================================

const SEASON_MAP: Record<number, string> = {
    1: 'Winter', 2: 'Winter',
    3: 'Spring', 4: 'Spring', 5: 'Spring',
    6: 'Summer', 7: 'Summer', 8: 'Summer',
    9: 'Autumn', 10: 'Autumn', 11: 'Autumn',
    12: 'Winter'
};

export const getCurrentSeason = (): string => {
    const month = new Date().getMonth() + 1;
    return SEASON_MAP[month] || 'Summer';
};

export const isWinterSeason = (): boolean => {
    const month = new Date().getMonth() + 1;
    return month === 12 || month === 1 || month === 2;
};

// ==============================================================================
// Data Fetching Functions
// ==============================================================================

/**
 * 캠핑장 상세 정보 가져오기
 */
export const fetchCampingDetails = async (placeId: string): Promise<CampingSpotDetail | null> => {
    const { data, error } = await supabase
        .from('camping_spot_details')
        .select('*')
        .eq('place_id', placeId)
        .single();

    if (error) {
        console.error('Error fetching camping details:', error);
        return null;
    }

    return {
        placeId: data.place_id,
        campType: data.camp_type || 'AUTO_CAMPING',
        floorType: data.floor_type || undefined,
        facilities: {
            electricity: data.has_electricity || false,
            hotWater: data.has_hot_water || false,
            wifi: data.has_wifi || false,
            petFriendly: data.is_pet_friendly || false
        },
        price: data.base_fee || undefined,
        checkIn: data.check_in_time || undefined,
        checkOut: data.check_out_time || undefined
    };
};

/**
 * 특정 캠핑장에 추천되는 장비 목록 가져오기
 */
export const fetchRecommendedGear = async (placeId: string): Promise<CampingGear[]> => {
    const { data, error } = await supabase
        .from('spot_gear_recommendation')
        .select(`
            reason,
            camping_gear (
                id,
                name,
                category,
                is_essential_for_winter,
                description
            )
        `)
        .eq('place_id', placeId);

    if (error || !data) {
        console.error('Error fetching recommended gear:', error);
        return [];
    }

    return data.map((item: any) => ({
        id: item.camping_gear.id,
        name: item.camping_gear.name,
        category: item.camping_gear.category || 'UTILITY',
        isEssentialForWinter: item.camping_gear.is_essential_for_winter || false,
        description: item.camping_gear.description,
        reason: item.reason
    }));
};

/**
 * 동계 필수 장비 목록 가져오기
 */
export const fetchWinterEssentialGear = async (): Promise<CampingGear[]> => {
    const { data, error } = await supabase
        .from('camping_gear')
        .select('*')
        .eq('is_essential_for_winter', true);

    if (error) {
        console.error('Error fetching winter gear:', error);
        return [];
    }

    return data.map((gear: DBCampingGear) => ({
        id: gear.id,
        name: gear.name,
        category: gear.category || 'UTILITY',
        isEssentialForWinter: true,
        description: gear.description || undefined
    }));
};

/**
 * 시즌에 맞는 캠핑 레시피 가져오기
 */
export const fetchCampingRecipes = async (season?: string): Promise<CampingRecipe[]> => {
    const currentSeason = season || getCurrentSeason();

    let query = supabase
        .from('camping_recipes')
        .select('*');

    // Filter by season if specified
    if (currentSeason) {
        query = query.or(`best_season.eq.${currentSeason},best_season.is.null`);
    }

    const { data, error } = await query.limit(5);

    if (error || !data) {
        console.error('Error fetching recipes:', error);
        return [];
    }

    return data.map((recipe: DBCampingRecipe) => ({
        id: recipe.id,
        name: recipe.name,
        ingredients: recipe.ingredients || [],
        method: recipe.cooking_method || '',
        difficulty: recipe.difficulty_level || 1,
        bestSeason: recipe.best_season || undefined
    }));
};

/**
 * 주변 편의시설 찾기 (마트, 주유소, 식당 등)
 * TODO: PostGIS ST_Distance 구현 시 좌표 파라미터 활용 예정
 */
export const fetchNearbyAmenities = async (
    _centerLat: number,
    _centerLng: number,
    _radiusKm: number = 20
): Promise<CampAmenity[]> => {
    const { data, error } = await supabase
        .from('places')
        .select(`
            id,
            name,
            address,
            amenity_details (
                category,
                rating,
                operating_hours,
                signature_menu
            )
        `)
        .eq('type', 'AMENITY');

    if (error || !data) {
        console.error('Error fetching amenities:', error);
        return [];
    }

    // Filter out BAIT_SHOP (handled by fishingService)
    const amenities = data
        .filter((p: any) => {
            const cat = p.amenity_details?.category;
            return cat && cat !== 'BAIT_SHOP';
        })
        .map((place: any) => {
            const categoryMap: Record<string, 'STORE' | 'GAS' | 'RESTAURANT' | 'CONVENIENCE_STORE'> = {
                'CONVENIENCE_STORE': 'CONVENIENCE_STORE',
                'GAS_STATION': 'GAS',
                'RESTAURANT': 'RESTAURANT',
                'TOILET': 'STORE'
            };

            return {
                id: place.id,
                name: place.name,
                type: categoryMap[place.amenity_details?.category] || 'STORE',
                lat: 0, // Would come from PostGIS
                lng: 0,
                address: place.address,
                rating: place.amenity_details?.rating,
                operatingHours: place.amenity_details?.operating_hours,
                signatureMenu: place.amenity_details?.signature_menu
            };
        });

    return amenities.slice(0, 15);
};

/**
 * 캠핑 포인트 종합 정보 가져오기
 */
export const fetchCampingSpotInfo = async (placeId: string, lat: number, lng: number): Promise<CampingSpotInfo> => {
    // 1. Get camping spot details
    const details = await fetchCampingDetails(placeId);

    // 2. Get recommended gear for this spot + winter essentials if applicable
    let gear = await fetchRecommendedGear(placeId);
    if (isWinterSeason()) {
        const winterGear = await fetchWinterEssentialGear();
        const existingIds = new Set(gear.map(g => g.id));
        const additionalWinterGear = winterGear.filter(g => !existingIds.has(g.id));
        gear = [...gear, ...additionalWinterGear];
    }

    // 3. Get nearby amenities
    const amenities = await fetchNearbyAmenities(lat, lng);

    // 4. Get seasonal recipes
    const recipes = await fetchCampingRecipes();

    return {
        details,
        recommendedGear: gear,
        nearbyAmenities: amenities,
        recommendedRecipes: recipes
    };
};

/**
 * 카테고리별 장비 목록 가져오기
 */
export const fetchGearByCategory = async (category: string): Promise<CampingGear[]> => {
    const { data, error } = await supabase
        .from('camping_gear')
        .select('*')
        .eq('category', category);

    if (error) {
        console.error('Error fetching gear by category:', error);
        return [];
    }

    return data.map((gear: DBCampingGear) => ({
        id: gear.id,
        name: gear.name,
        category: gear.category || category,
        isEssentialForWinter: gear.is_essential_for_winter || false,
        description: gear.description || undefined
    }));
};

/**
 * 모든 캠핑 장비 목록 가져오기
 */
export const fetchAllGear = async (): Promise<CampingGear[]> => {
    const { data, error } = await supabase
        .from('camping_gear')
        .select('*')
        .order('category', { ascending: true });

    if (error) {
        console.error('Error fetching all gear:', error);
        return [];
    }

    return data.map((gear: DBCampingGear) => ({
        id: gear.id,
        name: gear.name,
        category: gear.category || 'UTILITY',
        isEssentialForWinter: gear.is_essential_for_winter || false,
        description: gear.description || undefined
    }));
};

// ==============================================================================
// Helper Functions (exported for future use in distance calculations)
// ==============================================================================

export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

