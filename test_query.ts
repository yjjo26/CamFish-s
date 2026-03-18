import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lpitchsqanzrinravzde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaXRjaHNxYW56cmlucmF2emRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDQ1MzIsImV4cCI6MjA4NDgyMDUzMn0.VjnXB5bmX_1j_9WrhR854QR_G7cIktlMCZREqu_cwQI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    const { data: sData } = await supabase.from('spots').select('id, name, spot_type').limit(3);
    console.log('Spots sample:');
    console.dir(sData, {depth: null});

    const { data: dData } = await supabase.from('spot_details').select('*').limit(3);
    console.log('\nDetails sample:');
    console.dir(dData, {depth: null});
    
    // check if a spot has a corresponding detail
    if (sData && sData.length > 0) {
        const sid = sData[0].id;
        const { data: specific } = await supabase.from('spot_details').select('*').eq('spot_id', sid);
        console.log(`\nDetail for spot ${sid}:`, specific);
    }
}
checkDb();
