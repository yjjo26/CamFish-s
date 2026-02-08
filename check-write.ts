
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const cwd = process.cwd();
const envPath = path.resolve(cwd, '.env');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    const envLocalPath = path.resolve(cwd, '.env.local');
    if (fs.existsSync(envLocalPath)) {
        dotenv.config({ path: envLocalPath });
    }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWrite() {
    console.log('Checking write permission...');

    const testData = {
        name: 'Test Write Access',
        type: 'TEST',
        address: 'Test Address',
        lat: 0,
        lng: 0
    };

    const { data, error } = await supabase.from('places').insert(testData).select();

    if (error) {
        console.error('Write failed:', error.message);
        console.log('You might need VITE_SUPABASE_SERVICE_ROLE_KEY for seeding.');
        process.exit(1);
    }

    console.log('Write successful!');
    // Clean up
    if (data && data[0] && data[0].id) {
        await supabase.from('places').delete().eq('id', data[0].id);
        console.log('Cleanup successful.');
    }
}

checkWrite();
