
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env explicitly from current working directory
const cwd = process.cwd();
const envPath = path.resolve(cwd, '.env');

if (fs.existsSync(envPath)) {
    console.log('Loading .env from', envPath);
    dotenv.config({ path: envPath });
} else {
    // Try .env.local
    const envLocalPath = path.resolve(cwd, '.env.local');
    if (fs.existsSync(envLocalPath)) {
        console.log('Loading .env.local from', envLocalPath);
        dotenv.config({ path: envLocalPath });
    } else {
        console.log('No .env or .env.local found in', cwd);
    }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase environment variables');
    console.error('VITE_SUPABASE_URL:', supabaseUrl);
    console.error('VITE_SUPABASE_KEY:', supabaseKey ? '(set)' : '(not set)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyConnection() {
    console.log('Verifying Supabase connection...');
    console.log('URL:', supabaseUrl);

    // Check 'places' table
    // Check 'places' table
    const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('id, name')
        .limit(5);

    if (placesError) {
        console.error('Error connecting to "places" table:', placesError.message);
    } else {
        if (placesData && placesData.length > 0) {
            console.log(`Successfully connected. Found ${placesData.length} places (sample):`);
            placesData.forEach(p => console.log(` - ${p.name} (${p.id})`));
        } else {
            console.log('Successfully connected, but "places" table is empty (0 rows).');
        }
    }

    // Check relevant tables
    const tables = [
        'fish_species',
        'location_species_map',
        'species_bait_map',
        'baits',
        'camping_spot_details',
        'spot_gear_recommendation',
        'camping_gear',
        'camping_recipes'
    ];

    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) {
            console.error(`Missing or inaccessible table: ${table} (${error.message})`);
        } else {
            console.log(`Table exists: ${table} (Rows: ${count})`);
        }
    }
}

verifyConnection();
