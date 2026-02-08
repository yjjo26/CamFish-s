
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
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

console.log('URL:', supabaseUrl);
console.log('Key prefix:', serviceRoleKey.substring(0, 15) + '...');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    db: {
        schema: 'public'
    }
});

async function seedData() {
    console.log('Starting seed process...');

    const sqlPath = path.resolve(cwd, 'seed_data.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error('seed_data.sql not found');
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    const lines = sqlContent.split('\n');
    let valuesPart = '';
    let startCollecting = false;

    for (const line of lines) {
        if (line.trim().startsWith('insert into places')) {
            startCollecting = true;
            continue;
        }
        if (startCollecting) {
            if (line.trim().startsWith('--')) continue;
            valuesPart += line.trim() + ' ';
            if (line.trim().endsWith(';')) break;
        }
    }

    const rawTuples = valuesPart.slice(0, -2)
        .split('),')
        .map(s => s.trim() + (s.trim().endsWith(')') ? '' : ')'));

    const places = [];

    for (const tuple of rawTuples) {
        const clean = tuple.replace(/^\(/, '').replace(/\)$/, '');

        const args = [];
        let current = '';
        let inQuote = false;

        for (let i = 0; i < clean.length; i++) {
            const char = clean[i];
            if (char === "'" && clean[i - 1] !== '\\') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                args.push(current.trim());
                current = '';
                continue;
            }
            current += char;
        }
        args.push(current.trim());

        const unquote = (s: string) => {
            if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
            return s;
        }


        if (args.length >= 6) {
            const lat = parseFloat(args[3]);
            const lng = parseFloat(args[4]);
            places.push({
                name: unquote(args[0]),
                type: unquote(args[1]),
                address: unquote(args[2]),
                description: unquote(args[5]),
                location: `POINT(${lng} ${lat})`
            });
        }
    }

    console.log(`Parsed ${places.length} places to insert.`);

    if (places.length > 0) {
        const { error: deleteError } = await supabase.from('places').delete().neq('name', '___Placeholder___');

        if (deleteError) console.error('Delete error:', deleteError.message);
        else console.log('Cleared existing places.');

        const { error: insertError } = await supabase.from('places').insert(places);

        if (insertError) {
            console.error('Insert failed:', insertError.message);
        } else {
            console.log('Successfully seeded places!');
        }
    }
}

seedData();
