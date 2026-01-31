import { supabase } from '../lib/supabase';
import type {
    FishSpecies as DBFishSpecies,
    Bait as DBBait
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
 * Fallback: DB에 매핑이 없으면 어종 이름 기반 추천
 */
export const fetchBaitsForMultipleSpecies = async (speciesIds: string[], speciesNames?: string[]): Promise<Bait[]> => {
    if (speciesIds.length === 0) return [];

    const { data: mapData, error: mapError } = await supabase
        .from('species_bait_map')
        .select('bait_id, effectiveness_rating')
        .in('species_id', speciesIds);

    if (mapError || !mapData || mapData.length === 0) {
        // [FALLBACK] DB 매핑이 없으면 어종 이름 기반 추천
        console.log('[Bait Fallback] No DB mapping found, using fish-based recommendations');
        return getFallbackBaits(speciesNames || []);
    }

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

    if (baitError || !baitData || baitData.length === 0) {
        // [FALLBACK] 미끼 데이터 조회 실패 시
        return getFallbackBaits(speciesNames || []);
    }

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
 * 어종 이름을 기반으로 기본 미끼 추천 (Fallback)
 */
const getFallbackBaits = (speciesNames: string[]): Bait[] => {
    const recommendations: Set<string> = new Set();

    // 어종별 기본 미끼 매핑
    const BAIT_RULES: Record<string, string[]> = {
        // 바다 어종
        '우럭': ['갯지렁이', '오징어살', '크릴새우'],
        '광어': ['다운샷웜', '미노우', '오징어살'],
        '숭어': ['빵가루', '곤쟁이', '청갯지렁이'],
        '삼치': ['폴락미노우', '메탈지그', '버클테일'],
        '농어': ['미노우', '크랭크베이트', '전갱이'],
        '감성돔': ['갯지렁이', '크릴새우', '참갯지렁이'],
        '참돔': ['참갯지렁이', '크릴새우', '오징어살'],
        '볼락': ['갯지렁이', '청갯지렁이', '크릴새우'],
        '노래미': ['갯지렁이', '오징어살', '미꾸라지'],
        '돔류': ['참갯지렁이', '크릴새우'],
        // 두족류
        '쭈꾸미': ['에기', '에자'],
        '갑오징어': ['에기', '에자'],
        '문어': ['에기', '생미끼'],
        '오징어': ['에기', '생미끼'],
        '한치': ['에기', '에자'],
        // 민물 어종
        '붕어': ['지렁이', '떡밥', '옥수수'],
        '잉어': ['옥수수', '새우', '떡밥'],
        '배스': ['웜', '크랭크베이트', '스피너베이트'],
        '송어': ['플라이', '스푼', '미노우'],
        '쏘가리': ['미노우', '웜', '새우'],
        // 망둥어/밴댕이 등
        '망둥어': ['갯지렁이', '청갯지렁이'],
        '밴댕이': ['곤쟁이', '크릴'],
        '갯바위': ['갯지렁이', '크릴새우', '오징어살'],
    };

    // 기본 범용 미끼
    const DEFAULT_BAITS = ['갯지렁이', '크릴새우', '오징어살'];

    speciesNames.forEach(name => {
        const lowerName = name.toLowerCase();

        // 직접 매칭
        if (BAIT_RULES[name]) {
            BAIT_RULES[name].forEach(b => recommendations.add(b));
            return;
        }

        // 부분 매칭
        for (const [key, baits] of Object.entries(BAIT_RULES)) {
            if (lowerName.includes(key) || key.includes(name)) {
                baits.forEach(b => recommendations.add(b));
                return;
            }
        }

        // 묵시적 분류
        if (lowerName.includes('오징어') || lowerName.includes('쭈꾸미') || lowerName.includes('문어')) {
            ['에기', '에자'].forEach(b => recommendations.add(b));
        } else if (lowerName.includes('돔') || lowerName.includes('참돔') || lowerName.includes('감성')) {
            ['갯지렁이', '크릴새우'].forEach(b => recommendations.add(b));
        } else {
            // 기본 미끼 추가
            DEFAULT_BAITS.forEach(b => recommendations.add(b));
        }
    });

    // Set이 비어있으면 기본 미끼 추가
    if (recommendations.size === 0) {
        DEFAULT_BAITS.forEach(b => recommendations.add(b));
    }

    // Bait 객체 배열로 변환
    return Array.from(recommendations).map((name, idx) => ({
        id: `fallback-${idx}`,
        name,
        category: 'GENERAL',
        effectiveness: 4
    }));
};

/**
 * 주변 낚시점 찾기
 * TODO: PostGIS ST_Distance 구현 시 좌표 파라미터 활용 예정
 */
export const fetchBaitShops = async (
    _centerLat: number,
    _centerLng: number,
    _radiusKm: number = 20
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

// Fetch all verified spots for AI Context Injection
export const fetchVerifiedSpots = async () => {
    const { data, error } = await supabase
        .from('places')
        .select('id, name, type, lat, lng, image_url, description')
        .in('type', ['FISHING', 'CAMPING']);

    if (error) {
        console.error('Error fetching verified spots:', error);
        return [];
    }
    return data || [];
};
