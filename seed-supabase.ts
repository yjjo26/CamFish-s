
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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    db: {
        schema: 'public'
    }
});

interface ParsedTable {
    tableName: string;
    columns: string[];
    rows: any[];
}

function parseArrayString(str: string): string[] {
    // Convert ARRAY['a', 'b'] to ['a', 'b']
    if (str.startsWith('ARRAY[')) {
        const content = str.substring(6, str.lastIndexOf(']'));
        return content.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
    }
    return [];
}

function parseValue(val: string): any {
    val = val.trim();
    if (val.startsWith("'") && val.endsWith("'")) {
        return val.slice(1, -1).replace(/''/g, "'");
    }
    if (val.toUpperCase() === 'TRUE') return true;
    if (val.toUpperCase() === 'FALSE') return false;
    if (val.toUpperCase() === 'NULL') return null;
    if (val.startsWith('ARRAY[')) return parseArrayString(val);
    if (!isNaN(Number(val))) return Number(val);
    return val;
}

function parseSqlFile(filePath: string): ParsedTable[] {
    let content = fs.readFileSync(filePath, 'utf-8');
    // Remove comments
    content = content.replace(/--.*$/gm, '');

    const statements = content.split(';').filter(s => s.trim().length > 0);
    const tables: ParsedTable[] = [];

    for (const statement of statements) {
        const insertMatch = statement.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*/i);
        if (!insertMatch) continue;

        const tableName = insertMatch[1];
        const columns = insertMatch[2].split(',').map(c => c.trim().replace(/^"|"$/g, '')); // Remove quotes from column names if present
        const valuesPart = statement.substring(insertMatch[0].length).trim();

        // Simple tuple parser
        // Note: This matches outer parentheses. It assumes no nested parentheses except within ARRAY[].
        // Refined split logic for tuples like (1, 'a', ARRAY['x']), (2, 'b', ...)

        const rows: any[] = [];
        let buffer = '';
        let inTuple = false;
        let inQuote = false;
        let inArray = false;

        for (let i = 0; i < valuesPart.length; i++) {
            const char = valuesPart[i];

            if (char === "'" && valuesPart[i - 1] !== '\\') {
                inQuote = !inQuote;
            }

            if (!inQuote) {
                if (char === '(' && !inTuple) {
                    inTuple = true;
                    buffer = '';
                    continue;
                }
                if (char === ')' && inTuple && !inArray) { // End of tuple
                    inTuple = false;

                    // Process buffer
                    const fields = [];
                    let fieldBuf = '';
                    let fQuote = false;
                    let fArray = false;

                    for (let j = 0; j < buffer.length; j++) {
                        const c = buffer[j];
                        if (c === "'") fQuote = !fQuote;
                        if (c === '[') fArray = true;
                        if (c === ']') fArray = false;

                        if (c === ',' && !fQuote && !fArray) {
                            fields.push(fieldBuf.trim());
                            fieldBuf = '';
                        } else {
                            fieldBuf += c;
                        }
                    }
                    fields.push(fieldBuf.trim());

                    const rowObj: any = {};
                    columns.forEach((col, idx) => {
                        if (idx < fields.length) {
                            rowObj[col] = parseValue(fields[idx]);
                        }
                    });
                    rows.push(rowObj);
                    continue;
                }

                if (valuesPart.substring(i).startsWith('ARRAY[')) {
                    inArray = true;
                }
                if (char === ']' && inArray) {
                    inArray = false;
                }
            }

            if (inTuple) buffer += char;
        }

        if (rows.length > 0) {
            tables.push({ tableName, columns, rows });
        }
    }

    return tables;
}

async function seedData() {
    console.log('Starting extended seed process...');

    // 1. Seed 'places' from original logic (preserved for safety, or migrated?)
    // For now, let's assume we want to run both or just the extended one.
    // The user request was "checking Supabase data... connect...".
    // Let's run the extended seed data FIRST.

    const extendedPath = path.resolve(cwd, 'seed_data_extended.sql');
    if (fs.existsSync(extendedPath)) {
        console.log(`Parsing ${extendedPath}...`);
        const tables = parseSqlFile(extendedPath);

        // Define cleanup order (child tables first)
        const cleanupOrder = ['species_bait_map', 'camping_recipes', 'camping_gear', 'baits', 'fish_species'];

        for (const table of cleanupOrder) {
            console.log(`Cleaning table ${table}...`);
            let query = supabase.from(table).delete();

            if (table === 'species_bait_map') {
                // species_bait_map has no ID, composite key (species_id, bait_id)
                // Filter by species_id not being null/empty
                query = query.neq('species_id', '00000000-0000-0000-0000-000000000000');
            } else {
                query = query.neq('id', '00000000-0000-0000-0000-000000000000');
            }

            const { error } = await query;
            if (error) console.warn(`Cleanup warning for ${table}:`, error.message);
        }

        // Insert new data
        for (const table of tables) {
            console.log(`Seeding ${table.tableName} (${table.rows.length} rows)...`);
            const { error } = await supabase.from(table.tableName).insert(table.rows);
            if (error) {
                console.error(`Error seeding ${table.tableName}:`, error.message);
                console.error('Sample Data:', table.rows[0]);
            } else {
                console.log(`Successfully seeded ${table.tableName}`);
            }
        }
    } else {
        console.error('seed_data_extended.sql not found!');
    }

    // 2. Re-run places seed from seed_data.sql (if needed)
    // The original seed-supabase.ts logic handled `seed_data.sql` for `places`.
    // We should include that logic here too to ensure we have PLACES.

    const sqlPath = path.resolve(cwd, 'seed_data.sql');
    if (fs.existsSync(sqlPath)) {
        console.log(`Parsing ${sqlPath} for places...`);
        // ... (Keep simpler logic for places or reuse generic parser if standard SQL)
        // seed_data.sql uses standard VALUES format, so we can reuse parseSqlFile!
        const placesTables = parseSqlFile(sqlPath);

        for (const table of placesTables) {
            if (table.tableName === 'places') {
                // Check if places already exist to avoid duplicates if using upsert, 
                // but here we might want to just upsert.
                // Actually, let's just use upsert or delete-insert.
                console.log(`Seeding places (${table.rows.length} rows)...`);

                // Filter out latch/lng if present (computed columns)
                const sanitizedRows = table.rows.map(row => {
                    const { lat, lng, ...rest } = row;
                    // Ensure location is set if missing (though the parser might not have set it if it came from explicit lat/lng columns)
                    if ((lat || lat === 0) && (lng || lng === 0) && !rest.location) {
                        rest.location = `POINT(${lng} ${lat})`;
                    }
                    return rest;
                });

                // Batch insert places to avoid packet too large
                const batchSize = 50;
                for (let i = 0; i < sanitizedRows.length; i += batchSize) {
                    const batch = sanitizedRows.slice(i, i + batchSize);

                    const { error } = await supabase.from('places').upsert(batch, { onConflict: 'name' });
                    if (error) console.error(`Error inserting batch ${i}:`, error.message);
                }
                console.log('Finished seeding places.');
            }
        }
    }

}

seedData();
