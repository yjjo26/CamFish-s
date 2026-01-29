
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY;
const NAVER_ID = process.env.VITE_NAVER_MAP_CLIENT_ID;
const NAVER_SECRET = process.env.VITE_NAVER_MAP_CLIENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY || !NAVER_ID || !NAVER_SECRET) {
    console.error("Missing API Keys in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Target Configuration (Change these to run for different areas)
const TARGET_REGION = process.argv[2] || "속초";
const TARGET_CATEGORY = process.argv[3] || "맛집";
const TARGET_COUNT = 20;

// Debug function to check available models
async function checkModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
        const data = await response.json();
        if (data.models) {
            console.log("AVAILABLE MODELS:", data.models.map((m: any) => m.name));
        } else {
            console.error("ListModels Failed:", data);
        }
    } catch (e) {
        console.error("CheckModels Error:", e);
    }
}

async function fetchFromGemini(region: string, category: string, count: number) {
    console.log(`🤖 Asking Gemini for ${count} ${category} in ${region}...`);
    const prompt = `
    List ${count} popular, real "${category}" locations in "${region}" (South Korea).
    Focus on places relevant to tourists, anglers, or campers.
    
    Start with verified famous places.
    
    Output JSON format ONLY:
    [
        {
            "name": "Store Name",
            "type": "AMENITY", 
            "subtype": "RESTAURANT" | "CAFE" | "FISHING_STORE" | "MART" | "ATTRACTION",
            "address": "Real Korean Road Name Address (Important for Geocoding)",
            "description": "Short description (Menu, special features)",
            "rating": 4.5 (Mock rating 3.0-5.0)
        }
    ]
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    console.log("DEBUG GEMINI RESPONSE:", JSON.stringify(data, null, 2));

    if (data.error) {
        throw new Error(`Gemini API Error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty response");

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
}

async function geocodeAddress(address: string) {
    const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
        headers: {
            'X-NCP-APIGW-API-KEY-ID': NAVER_ID!,
            'X-NCP-APIGW-API-KEY': NAVER_SECRET!
        }
    });

    if (!response.ok) {
        console.error(`Geocoding Failed: ${response.status} ${response.statusText}`);
        return null;
    }

    const data = await response.json();
    if (data.addresses && data.addresses.length > 0) {
        const result = data.addresses[0];
        return { lat: parseFloat(result.y), lng: parseFloat(result.x), roadAddress: result.roadAddress };
    }
    return null;
}

async function main() {
    try {
        await checkModels(); // Check models first

        // 1. Get List from AI
        const places = await fetchFromGemini(TARGET_REGION, TARGET_CATEGORY, TARGET_COUNT);
        console.log(`📋 Gemini suggested ${places.length} places.`);

        let successCount = 0;

        // 2. Process each place
        for (const place of places) {
            console.log(`📍 Processing: ${place.name}...`);

            // 3. Geocode
            const coords = await geocodeAddress(place.address);
            if (!coords) {
                console.warn(`   ❌ Geocoding failed for "${place.address}". Skipping.`);
                continue;
            }
            console.log(`   ✅ Located at (${coords.lat}, ${coords.lng})`);

            // 4. Insert into Supabase
            // Note: We use raw SQL to insert geometry or use text representation if PostGIS is enabled
            // Here we assume 'location' column is PostGIS GEOGRAPHY(POINT, 4326)
            // Supabase JS doesn't support PostGIS insert easily, better to use RPC or RAW Query if possible.
            // But for now we might need to rely on a text insert if Supabase allows "ST_SetSRID..." string? 
            // No, Supabase client treats string as string.
            // Alternative: Insert Lat/Lng cols if we had them, OR use a stored procedure?
            // Let's use `location: `SRID=4326;POINT(${coords.lng} ${coords.lat})`` format which Supabase/Postgres might accept for Geography type.

            const pointWKT = `POINT(${coords.lng} ${coords.lat})`; // WKT format

            const { data: insertedPlace, error } = await supabase
                .from('places')
                .upsert({
                    name: place.name,
                    type: place.type,
                    address: coords.roadAddress || place.address,
                    description: place.description,
                    // Use a raw postgis insert trick? No, let's try the WKT string first, works often with pg drivers.
                    // If fails, we might need a workaround.
                    // Actually, our schema has `location` as GEOGRAPHY.
                    // Supabase-js handles GeoJSON for Geography.
                    location: { type: 'Point', coordinates: [coords.lng, coords.lat] }
                }, { onConflict: 'name' })
                .select()
                .single();

            if (error) {
                console.error(`   ❌ DB Insert failed:`, error.message);
            } else {
                console.log(`   🎉 Saved to DB: ${insertedPlace.name}`);

                // 5. Insert Details (Amenity)
                if (place.type === 'AMENITY') {
                    const { error: detailError } = await supabase
                        .from('amenity_details')
                        .upsert({
                            place_id: insertedPlace.id,
                            category: "CONVENIENCE_STORE", // Default fallback, or map subtype
                            rating: place.rating || 4.0,
                            operating_hours: '09:00 - 22:00',
                            signature_menu: place.description
                        }, { onConflict: 'place_id' });
                }
                successCount++;
            }
            // Rate limit gentleness
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`\n✨ Update Complete! Successfully added ${successCount}/${places.length} places.`);

    } catch (error) {
        console.error("Script Error:", error);
    }
}

main();
