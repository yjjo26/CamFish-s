
export type TripTheme = 'FISHING' | 'CAMPING' | 'GENERAL';

export interface TripAnalysisResult {
    destination: string;
    theme: TripTheme;
    checklist: string[];
    searchKeywords: string[];
    // New Fields for Enhanced Recommendations
    targetSpecies?: string[];
    recommendedBait?: string[];
    recommendedSpots: {
        name: string;
        type: string;
        address?: string; // Optional for safety
    }[];
    recommendedStopovers?: {
        name: string;
        type: string;
        reason: string;
        address?: string;
    }[];
    // Enhanced Checklist
    checklistDetails?: {
        item: string;
        category: string;
        recommendedShops?: {
            name: string;
            address: string;
            description?: string; // Menu, Price, etc.
            lat?: number;
            lng?: number;
        }[];
    }[];
    // Hybrid Search Fields
    destinationId?: string;
    destinationCoords?: { lat: number; lng: number };
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Using Gemini 1.5 Flash for speed/efficiency/availability
// Using Gemini 1.5 Flash for speed/efficiency/availability
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_3_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
import { supabase } from '../lib/supabase';
import { fetchSeasonalSpecies, fetchBaitsBySpecies, FishSpecies, Bait } from './fishingService';
import { fetchCampingRecipes, fetchWinterEssentialGear, CampingGear, CampingRecipe } from './campingService';

// ==============================================================================
// Database Helper Functions
// ==============================================================================

// Helper to find verified shops from DB
const findVerifiedShops = async (region: string, category: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('places')
            .select('*')
            .ilike('name', `%${region}%`)
            .eq('type', 'AMENITY')
            .limit(3);

        if (error) {
            console.error('Supabase Error:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('DB Query Failed:', err);
        return [];
    }
};

/**
 * 현재 시즌에 맞는 어종 추천 데이터 가져오기
 */
export const getSeasonalFishingRecommendations = async (): Promise<{
    species: FishSpecies[];
    baits: Bait[];
}> => {
    const species = await fetchSeasonalSpecies();

    // Get baits for first 3 species
    const topSpecies = species.slice(0, 3);
    const allBaits: Bait[] = [];

    for (const sp of topSpecies) {
        const baits = await fetchBaitsBySpecies(sp.id);
        baits.forEach(b => {
            if (!allBaits.find(existing => existing.id === b.id)) {
                allBaits.push(b);
            }
        });
    }

    return { species, baits: allBaits };
};

/**
 * 캠핑 추천 데이터 가져오기 (레시피, 장비)
 */
export const getCampingRecommendations = async (): Promise<{
    recipes: CampingRecipe[];
    winterGear: CampingGear[];
}> => {
    const recipes = await fetchCampingRecipes();
    const winterGear = await fetchWinterEssentialGear();

    return { recipes, winterGear };
};

/**
 * 장소 이름으로 ID 조회
 */
export const findPlaceByName = async (name: string): Promise<string | null> => {
    const { data, error } = await supabase
        .from('places')
        .select('id')
        .ilike('name', `%${name}%`)
        .limit(1)
        .single();

    if (error || !data) return null;
    return data.id;
};

/**
 * 특정 장소의 추천 어종 목록 조회
 */
export const getLocationSpecies = async (placeName: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('places')
        .select(`
            id,
            location_species_map (
                fish_species (
                    korean_name
                )
            )
        `)
        .ilike('name', `%${placeName}%`)
        .limit(1)
        .single();

    if (error || !data) return [];

    return (data as any).location_species_map?.map((m: any) => m.fish_species?.korean_name).filter(Boolean) || [];
};

/**
 * 특정 캠핑장의 추천 장비 조회
 */
export const getCampingSpotGear = async (placeName: string): Promise<{ name: string; reason: string }[]> => {
    const { data, error } = await supabase
        .from('places')
        .select(`
            id,
            spot_gear_recommendation (
                reason,
                camping_gear (
                    name
                )
            )
        `)
        .ilike('name', `%${placeName}%`)
        .limit(1)
        .single();

    if (error || !data) return [];

    return (data as any).spot_gear_recommendation?.map((r: any) => ({
        name: r.camping_gear?.name || '',
        reason: r.reason || ''
    })).filter((g: any) => g.name) || [];
};


// Fallback Mock Logic (defnied first for hoisting)
const mockAnalyze = (query: string): TripAnalysisResult => {
    const lowerQuery = query.toLowerCase();
    let result: TripAnalysisResult = {
        destination: query,
        theme: 'GENERAL',
        checklist: ['물', '간식'],
        searchKeywords: ['편의점'],
        recommendedSpots: [],
        recommendedStopovers: [],
        checklistDetails: [
            { item: '물/음료', category: '식품', recommendedShops: [{ name: '이마트24 인천공항점', address: '인천 중구 공항로 271', description: '생수 1000원~', lat: 37.4601908, lng: 126.438507 }] }
        ]
    };

    if (lowerQuery.includes('낚시') || lowerQuery.includes('fish')) {
        result.theme = 'FISHING';
        result.checklist = ['지렁이/미끼', '얼음', '라면', '따뜻한 커피', '핫팩', '랜턴', '여분 낚싯줄'];
        result.searchKeywords = ['낚시점', '편의점'];
        result.destination = query.replace(/낚시|가서|갈거야/g, '').trim();
        // Add Mock Spots for Testing
        if (result.destination.includes('을왕리')) {
            result.recommendedSpots = [
                { name: '선녀바위 낚시프라자', type: '낚시가게', address: '인천 중구 을왕동 678-188' },
                { name: '이마트24 을왕리점', type: '편의점', address: '인천 중구 을왕로 20' },
                { name: '왕산 낚시 슈퍼', type: '낚시가게', address: '인천 중구 을왕동 810-128' }
            ];
        }
    } else if (lowerQuery.includes('캠핑') || lowerQuery.includes('camp')) {
        result.theme = 'CAMPING';
        result.checklist = ['숯/장작', '바베큐 고기', '쌈채소', '일회용품', '모기향', '가스버너'];
        result.searchKeywords = ['마트', '정육점', '편의점'];
        result.destination = query.replace(/캠핑|글램핑|차박/g, '').trim();
    }

    if (!result.destination) result.destination = query;
    return result;
}

export const analyzeTripIntent = async (query: string, startLocation: string = 'Seoul', knownSpots: any[] = []): Promise<TripAnalysisResult> => {
    if (!GEMINI_API_KEY) {
        console.warn("Gemini API Key is missing! Falling back to mock.");
        return mockAnalyze(query);
    }

    try {
        const spotListStr = knownSpots.length > 0
            ? `\nVERIFIED SPOTS DATABASE (Prioritize these if relevant):\n${knownSpots.map(s => `- ${s.name} (${s.type})`).join('\n')}\n`
            : "";

        const prompt = `
        You are an expert outdoor travel guide (Fishing & Camping).
        Analyze user input: "${query}" from "${startLocation}".
        
        ${spotListStr}

        1. Extract Destination. If the query matches a "VERIFIED SPOT", use its EXACT NAME.
        2. Determine Theme ('FISHING', 'CAMPING', 'GENERAL').
        3. Generate Checklist (10+ items). Suggest REAL shops near destination (Name, Address).
        4. Suggest Stopovers.
        
        [IF FISHING]
        - Identify Dominant Species & Best Bait.
        - Suggest 3 Real Shops (Korean Address required).
        
        Output JSON:
        {
            "destination": "string",
            "theme": "FISHING",
            "checklist": ["item1", ...],
            "searchKeywords": ["keyword1", ...],
            "targetSpecies": [],
            "recommendedBait": [],
            "recommendedSpots": [{"name": "", "type": "", "address": ""}],
            "recommendedStopovers": [{"name": "", "type": "", "reason": "", "address": ""}],
            "checklistDetails": [{"item": "", "category": "", "recommendedShops": [{"name": "", "address": ""}]}]
        }
        `;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Gemini");

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonStr) as TripAnalysisResult;

        if (!result.recommendedSpots) result.recommendedSpots = [];
        if (!result.recommendedStopovers) result.recommendedStopovers = [];

        // --- Hybrid Match Logic ---
        if (knownSpots.length > 0) {
            // Try to find exact match in DB
            const matched = knownSpots.find(s => s.name === result.destination || result.destination.includes(s.name));
            if (matched) {
                console.log(`[Hybrid Search] Matched Verified Spot: ${matched.name} (${matched.id})`);
                result.destination = matched.name; // Normalize name
                result.destinationId = matched.id;
                result.destinationCoords = { lat: matched.lat, lng: matched.lng };
            }
        }
        // --------------------------

        // Legacy DB Enhancement (Region based)
        let region = 'Seoul';
        if (result.destination.includes('부산') || result.destination.includes('Busan')) region = 'Busan';
        if (result.destination.includes('속초') || result.destination.includes('Sokcho')) region = 'Sokcho';
        if (result.destination.includes('인천') || result.destination.includes('Incheon')) region = 'Incheon';

        if (region !== 'Seoul') {
            const marts = await findVerifiedShops(region, 'MART');
            const fishingStores = await findVerifiedShops(region, 'FISHING_STORE');
            if (result.checklistDetails) {
                result.checklistDetails.forEach(detail => {
                    if (['Food', '식품'].includes(detail.category) || detail.item.includes('고기') || detail.item.includes('물')) {
                        if (marts.length > 0) {
                            detail.recommendedShops = marts.map(m => ({
                                name: m.name,
                                address: m.address,
                                lat: m.location ? m.location.coordinates[1] : undefined,
                                lng: m.location ? m.location.coordinates[0] : undefined
                            }));
                        }
                    }
                    if (detail.item.includes('미끼') || detail.item.includes('낚시')) {
                        if (fishingStores.length > 0) {
                            detail.recommendedShops = fishingStores.map(f => ({
                                name: f.name,
                                address: f.address,
                                lat: f.location ? f.location.coordinates[1] : undefined,
                                lng: f.location ? f.location.coordinates[0] : undefined
                            }));
                        }
                    }
                });
            }
        }

        // --- Stopover Enrichment (New) ---
        if (result.recommendedStopovers && result.recommendedStopovers.length > 0) {
            for (const stopover of result.recommendedStopovers) {
                // Try to find this place in our DB (e.g. 휴게소, 맛집)
                const { data: places } = await supabase
                    .from('places')
                    .select('name, address, type')
                    .ilike('name', `%${stopover.name}%`)
                    .limit(1);

                if (places && places.length > 0) {
                    const found = places[0];
                    console.log(`[Stopover Enrichment] Found DB Match: ${found.name}`);
                    stopover.name = found.name;
                    stopover.address = found.address;
                    stopover.type = found.type === 'AMENITY' ? 'Amenity' : found.type;
                }
            }
        }
        // --------------------------------

        console.log("Gemini Analysis:", result);
        return result;

    } catch (error) {
        console.error("Trip Analysis Failed:", error);
        return mockAnalyze(query);
    }
};

/**
 * Real-time AI Search for Places (Gemini 3.0)
 * Returns a list of places with addresses to be geocoded by Frontend.
 */
export const searchPlacesWithGemini = async (keyword: string, count: number = 3): Promise<{ name: string; type: string; address: string; description: string }[]> => {
    if (!GEMINI_API_KEY) return [];

    console.log(`🤖 Triggering Gemini 3.0 Search for: ${keyword}`);

    const prompt = `
    Find ${count} real, popular places in South Korea matching "${keyword}".
    Focus on Fishing Spots, Camping Sites, or Amenities (Shop, Mart, Restaurant).
    
    Output JSON format ONLY:
    [
        {
            "name": "Exact Name",
            "type": "FISHING" | "CAMPING" | "AMENITY",
            "address": "Full Road Name Address (Korea)",
            "description": "Short description"
        }
    ]
    `;

    try {
        const response = await fetch(GEMINI_3_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) throw new Error(`Gemini 3 API Error: ${response.statusText}`);

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return [];

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (e) {
        console.error("Gemini 3 Search Failed:", e);
        return [];
    }
};
