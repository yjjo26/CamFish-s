const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

// Mocking the fetchSpotDetail logic manually since importing TS in CJS is tricky
async function fetchSpotDetailMock(spotId, name) {
    console.log(`[TEST] Fetching for ID: ${spotId}, Name: ${name}`);

    // 1. Try by ID
    const { data, error } = await supabase
        .from('spot_details')
        .select('*')
        .eq('spot_id', spotId)
        .maybeSingle();

    if (data) {
        console.log("Found by ID!");
        return data;
    }

    // 2. Fallback by name
    if (name) {
        console.log(`No detail found for ID. Falling back to name: ${name}`);
        const { data: siblingSpots } = await supabase
            .from('spots')
            .select('id')
            .eq('name', name);

        if (siblingSpots && siblingSpots.length > 0) {
            const siblingIds = siblingSpots.map(s => s.id);
            console.log("Sibling IDs found:", siblingIds);
            const { data: fallbackData } = await supabase
                .from('spot_details')
                .select('*')
                .in('spot_id', siblingIds)
                .limit(1)
                .maybeSingle();

            if (fallbackData) {
                console.log("Found by Name Fallback!");
                return fallbackData;
            }
        }
    }
    return null;
}

async function verify() {
    // We know '춘천박사마을 어린이 글램핑장' has details but IDs might mismatch
    const name = "춘천박사마을 어린이 글램핑장";

    // Get one ID that definitely exists in 'spots' for this name
    const { data: spots } = await supabase.from('spots').select('id').eq('name', name).limit(1);

    if (!spots || spots.length === 0) {
        console.log("Test spot not found in 'spots' table.");
        return;
    }

    const testId = spots[0].id;
    const detail = await fetchSpotDetailMock(testId, name);

    if (detail) {
        console.log("SUCCESS: Detail found!");
        console.log("Summary:", detail.summary);
        console.log("Fishing Info Keys:", Object.keys(detail.fishing_info || {}));
    } else {
        console.log("FAILURE: Detail still not found.");
    }
}

verify().catch(console.error);
