const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

// Using the keys found in .env
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function debug() {
    console.log("=== 1. spot_details 테이블 첫 3건 ===");
    const { data: details, error: detailError } = await supabase
        .from('spot_details')
        .select('spot_id, fishing_info, camping_info, summary')
        .limit(3);

    if (detailError) {
        console.error("spot_details 에러:", detailError);
    } else {
        console.log("spot_details 건수:", details?.length);
        details?.forEach((d, i) => {
            console.log(`\n--- Detail ${i + 1} ---`);
            console.log("spot_id:", d.spot_id, "(type:", typeof d.spot_id, ")");
            console.log("fishing_info type:", typeof d.fishing_info);
            console.log("fishing_info preview:", JSON.stringify(d.fishing_info)?.substring(0, 300));
            console.log("camping_info type:", typeof d.camping_info);
            console.log("summary:", d.summary);
        });
    }

    console.log("\n=== 2. spots 테이블 첫 3건 ===");
    const { data: spots, error: spotError } = await supabase
        .from('spots')
        .select('id, name, spot_type')
        .limit(3);

    if (spotError) {
        console.error("spots 에러:", spotError);
    } else {
        spots?.forEach((s, i) => {
            console.log(`Spot ${i + 1}: id=${s.id}, name=${s.name}`);
        });
    }

    // Cross-check
    if (details && details.length > 0 && spots && spots.length > 0) {
        const testDetailSpotId = details[0].spot_id;
        console.log(`\n=== 3. Cross-check: spot_details.spot_id="${testDetailSpotId}" in spots? ===`);
        const { data: m1 } = await supabase.from('spots').select('id, name').eq('id', testDetailSpotId).maybeSingle();
        console.log("spots 매칭:", m1 ? `FOUND: ${m1.name}` : "NOT FOUND ❌");

        const testSpotId = spots[0].id;
        console.log(`\n=== 4. Reverse: spots.id="${testSpotId}" in spot_details? ===`);
        const { data: m2 } = await supabase.from('spot_details').select('spot_id').eq('spot_id', testSpotId).maybeSingle();
        console.log("spot_details 매칭:", m2 ? "FOUND ✅" : "NOT FOUND ❌");
    }

    // Total count
    const { count: totalDetails } = await supabase.from('spot_details').select('*', { count: 'exact', head: true });
    const { count: totalSpots } = await supabase.from('spots').select('*', { count: 'exact', head: true });
    console.log(`\n=== 5. 총 건수 ===`);
    console.log(`spots: ${totalSpots}, spot_details: ${totalDetails}`);
}

debug().catch(console.error);
