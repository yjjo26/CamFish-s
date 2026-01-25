
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
        }[];
    }[];
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
// Using Gemini 1.5 Flash for speed/efficiency/availability
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
import { supabase } from '../lib/supabase';

// Helper to find verified shops from DB
const findVerifiedShops = async (region: string, category: string): Promise<any[]> => {
    try {
        const { data, error } = await supabase
            .from('places')
            .select('*')
            .ilike('region', `%${region}%`)
            .eq('category', category)
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
            { item: '물/음료', category: '식품', recommendedShops: [{ name: '이마트24 인천공항점', address: '인천 중구 공항로 271', description: '생수 1000원~' }] }
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

export const analyzeTripIntent = async (query: string, startLocation: string = 'Seoul'): Promise<TripAnalysisResult> => {
    if (!GEMINI_API_KEY) {
        console.warn("Gemini API Key is missing! Falling back to mock.");
        return mockAnalyze(query);
    }

    try {
        const prompt = `
        You are an expert outdoor travel guide (Fishing & Camping specialist).
        Analyze the user's input: "${query}".
        The user is traveling from: "${startLocation}".
        
        1. Extract the Destination.
        2. Determine the Theme: 'FISHING', 'CAMPING', or 'GENERAL'.
        3. Generate a COMPREHENSIVE Itemized Checklist (at least 10 items).
           - Group items simply by category if possible.
           - For key items (e.g. Meat, Charcoal, Bait, Water, Snacks), suggest a specific REAL shop or market near the destination or start location.
           - CRITICAL: Do NOT say "Nearby Convenience Store". You MUST provide a specific Brand & Branch Name (e.g. "CU Sokcho-Beach Branch", "Emart Sokcho").
           - Even if you are unsure of the exact closest one, provide a REAL famous chain store in that city (e.g. "Lotte Mart Incheon Branch").
           - Provide the **Real Road Name Address** (e.g. "123, Beach-ro, Sokcho-si").
           - For Restaurants or Food Shops, provide a **Representative Menu & Approx Price** (e.g. "Pork Belly 180g (15,000 KRW)").
           - This is required so we can find it on the map.
        4. Suggest 2-3 stopovers/waypoint recommendations between "${startLocation}" and the destination.
           - Suitable for a rest stop, famous snack, or scenic view along the route.

        
        [IF THEME IS FISHING]
        4. Identify the DOMINANT Fish Species caught in this specific location (e.g. "Flatfish", "Rockfish").
        5. Recommend the BEST BAIT specifically for these species (e.g. "Lugworm", "Squid slices").
        
        6. Suggest 3 specific REAL commercial places (shops) near the destination suitable for the theme.
           CRITICAL: You MUST provide the real KOREAN ADDRESS (Road Name or Jigubun) for each spot so it can be located on a map.
        
        Output valid JSON:
        {
            "destination": "string",
            "theme": "FISHING",
            "checklist": ["item1", ...],
            "searchKeywords": ["keyword1", ...],
            "targetSpecies": ["Fish1", "Fish2"],
            "recommendedBait": ["Bait1", "Bait2"],
            "recommendedSpots": [
                { "name": "Store Name", "type": "Category", "address": "Real Address String" },
                { "name": "Store Name 2", "type": "Category", "address": "Real Address String" }
            ],
            "recommendedStopovers": [
                { "name": "Rest Area Name", "type": "Rest Area/Restaurant", "reason": "Famous for Walnut Cakes", "address": "Approx Address" }
            ],
            "checklistDetails": [
                { 
                    "item": "Samgyeopsal (Pork Belly)", 
                    "category": "Food", 
                    "recommendedShops": [ 
                        { "name": "Best Butcher", "address": "Real Address", "description": "Menu/Price info" } 
                    ]
                }
            ]
        }
        `;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.statusText}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No response from Gemini");

        // Clean any potential markdown code blocks provided by the LLM
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonStr) as TripAnalysisResult;

        if (!result.recommendedSpots) result.recommendedSpots = [];
        if (!result.recommendedStopovers) result.recommendedStopovers = [];

        // --- NEW: Enhance with Database Results (Reliable Spots) ---
        // 1. Detect Region from Destination (Simple string match)
        let region = 'Seoul'; // default
        if (result.destination.includes('부산') || result.destination.includes('Busan') || result.destination.includes('기장')) region = 'Busan';
        if (result.destination.includes('속초') || result.destination.includes('Sokcho')) region = 'Sokcho';
        if (result.destination.includes('인천') || result.destination.includes('Incheon') || result.destination.includes('을왕리')) region = 'Incheon';

        if (region !== 'Seoul') {
            console.log(`Enhancing results with DB data for region: ${region}`);

            // Fetch verified places from DB
            const marts = await findVerifiedShops(region, 'MART');
            const fishingStores = await findVerifiedShops(region, 'FISHING_STORE');

            // Map DB results to Checklist Recommendations
            if (result.checklistDetails) {
                result.checklistDetails.forEach(detail => {
                    // If item needs meat/groceries -> Suggest Mart
                    if (detail.category === 'Food' || detail.item.includes('고기') || detail.item.includes('물')) {
                        if (marts.length > 0) {
                            detail.recommendedShops = marts.map(m => ({ name: m.name, address: m.address }));
                        }
                    }
                    // If item needs bait -> Suggest Fishing Store
                    if (detail.item.includes('미끼') || detail.item.includes('지렁이') || detail.item.includes('낚시')) {
                        if (fishingStores.length > 0) {
                            detail.recommendedShops = fishingStores.map(f => ({ name: f.name, address: f.address }));
                        }
                    }
                });
            }
        }
        // -----------------------------------------------------------

        console.log("Gemini Analysis:", result);
        return result;

    } catch (error) {
        console.error("Trip Analysis Failed:", error);
        return mockAnalyze(query); // Fallback to safe mock if API fails
    }
};
