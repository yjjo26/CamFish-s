const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY);

async function debug() {
    // 1. Check for duplicates in 'spots' by name for some known names
    const names = ["춘천박사마을 어린이 글램핑장", "바람재 오토캠핑장", "배알도 별빛야영장"];
    console.log("=== 1. Checking specific names in 'spots' ===");
    for (const name of names) {
        const { data } = await supabase.from('spots').select('id, name').eq('name', name);
        console.log(`Name: "${name}" -> IDs:`, data.map(d => d.id));
    }

    // 2. Check if spot_details has name columns
    console.log("\n=== 2. spot_details column check ===");
    const { data: colCheck } = await supabase.from('spot_details').select('*').limit(1);
    if (colCheck && colCheck.length > 0) {
        console.log("Columns in spot_details:", Object.keys(colCheck[0]));
    }

    // 3. Let's see if we can find any spot that HAS a detail entry
    console.log("\n=== 3. Find spots with details ===");
    const { data: joined } = await supabase
        .from('spots')
        .select('id, name, spot_details!inner(spot_id)')
        .limit(10);
    console.log("Spots with inner join to details (count):", joined?.length);
    joined?.forEach(j => console.log(`- ${j.name} (id: ${j.id})`));

    // 4. Check if vector spots match IDs
    // The user might be searching and getting "Vector Spots" which might have different IDs
}

debug().catch(console.error);
