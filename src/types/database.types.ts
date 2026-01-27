// ==============================================================================
// CamFish Supabase Database Types
// Auto-generated from schema - 2026-01-28
// ==============================================================================

// 장소 유형
export type PlaceType = 'FISHING' | 'CAMPING' | 'AMENITY';

// 미끼 카테고리
export type BaitCategory = 'LIVE' | 'LURE' | 'POWDER' | 'PRESERVED';

// 편의시설 카테고리
export type AmenityCategory = 'BAIT_SHOP' | 'RESTAURANT' | 'GAS_STATION' | 'CONVENIENCE_STORE' | 'TOILET';

// 캠핑 타입
export type CampType = 'AUTO_CAMPING' | 'GLAMPING' | 'CAR_CAMPING' | 'BACKPACKING';

// 장비 카테고리
export type GearCategory = 'SLEEPING' | 'KITCHEN' | 'SHELTER' | 'UTILITY';

// ==============================================================================
// Database Row Types
// ==============================================================================

export interface Place {
    id: string;
    name: string;
    type: PlaceType;
    address: string | null;
    location: unknown; // PostGIS GEOGRAPHY type
    description: string | null;
    weather_grid_x: number | null;
    weather_grid_y: number | null;
    tide_station_code: string | null;
    created_at: string;
    updated_at: string;
    // Computed fields (from DB view or client-side)
    lat?: number;
    lng?: number;
}

export interface FishSpecies {
    id: string;
    korean_name: string;
    scientific_name: string | null;
    habitat_description: string | null;
    active_season: string[] | null; // Array of months like ['9월', '10월']
    cooking_recommendation: string | null;
    created_at: string;
}

export interface Bait {
    id: string;
    name: string;
    category: BaitCategory | null;
    target_depth: string | null;
    created_at: string;
}

export interface SpeciesBaitMap {
    species_id: string;
    bait_id: string;
    effectiveness_rating: number | null; // 1-5
}

export interface LocationSpeciesMap {
    place_id: string;
    species_id: string;
    season_specific: string | null;
}

export interface CampingGear {
    id: string;
    name: string;
    category: GearCategory | null;
    is_essential_for_winter: boolean;
    description: string | null;
}

export interface CampingRecipe {
    id: string;
    name: string;
    ingredients: string[] | null;
    cooking_method: string | null;
    difficulty_level: number | null; // 1-5
    best_season: string | null;
}

export interface AmenityDetails {
    place_id: string;
    category: AmenityCategory | null;
    rating: number | null;
    operating_hours: string | null;
    signature_menu: string | null;
}

export interface CampingSpotDetails {
    place_id: string;
    camp_type: CampType | null;
    floor_type: string | null;
    has_electricity: boolean;
    has_hot_water: boolean;
    has_wifi: boolean;
    is_pet_friendly: boolean;
    base_fee: number | null;
    check_in_time: string | null;
    check_out_time: string | null;
}

export interface SpotGearRecommendation {
    place_id: string;
    gear_id: string;
    reason: string | null;
}

// ==============================================================================
// Joined/Enriched Types (for frontend use)
// ==============================================================================

export interface PlaceWithDetails extends Place {
    fishingDetails?: {
        species: FishSpeciesWithBaits[];
    };
    campingDetails?: CampingSpotDetails & {
        recommendedGear: (CampingGear & { reason: string })[];
    };
    amenityDetails?: AmenityDetails;
}

export interface FishSpeciesWithBaits extends FishSpecies {
    recommendedBaits: (Bait & { effectiveness: number })[];
}

export interface CampingSpotWithRecipes extends CampingSpotDetails {
    recommendedRecipes: CampingRecipe[];
}

// ==============================================================================
// API Response Types
// ==============================================================================

export interface WeatherData {
    temp: number;
    humidity: number;
    windSpeed: number;
    condition: string;
    forecast: string[];
}

export interface TideData {
    date: string;
    tideType: 'high' | 'low';
    time: string;
    height: number;
    score: number; // 물때 점수 (1-13)
}

export interface SeasonRecommendation {
    currentMonth: string;
    currentSeason: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
    recommendedSpecies: FishSpecies[];
    recommendedSpots: Place[];
}
