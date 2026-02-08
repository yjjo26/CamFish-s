
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env
const cwd = process.cwd();
const envPath = path.resolve(cwd, '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyAdmin() {
    console.log('Verifying with Service Role Key...');

    const { count, error } = await supabase.from('places').select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Row count (Admin): ${count}`);
    }

    // Sample data check
    const { data } = await supabase.from('places').select('name').limit(3);
    if (data) {
        console.log('Sample data:', data);
    }
}

verifyAdmin();
