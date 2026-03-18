
import 'dotenv/config';
import { fetchSpots, fetchSpotDetail } from './src/services/spotService';
import { supabase } from './src/lib/supabase';

async function verifySpots() {
    console.log("Verifying Spots Data Fetching...");

    // 1. Fetch Spots
    console.log("1. Fetching Spots...");
    const spots = await fetchSpots();
    console.log(`Fetched ${spots.length} spots.`);
    if (spots.length > 0) {
        console.log("Sample Spot:", spots[0]);
    } else {
        console.warn("No spots found. Check if 'spots' table is populated.");
    }

    // 2. Fetch Detail
    if (spots.length > 0) {
        const spotId = spots[0].id;
        console.log(`2. Fetching Detail for Spot ID: ${spotId}...`);
        const detail = await fetchSpotDetail(spotId);
        if (detail) {
            console.log("Fetched Detail:", JSON.stringify(detail, null, 2));
        } else {
            console.warn(`No detail found for spot ${spotId}. Check 'spot_details' table.`);
        }
    }
}

verifySpots();
