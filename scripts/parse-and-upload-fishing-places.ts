import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// We will assume 'fishing_data' is the expected bucket since there might not be another one, or maybe 'public-bucket'. 
// Let's use 'data' as it's common, but we can check if there are others. First let's check bucket lists.
const BUCKET_NAME = 'data'; // Modify this if it throws

const csvFilePath = '/Users/yongjunjo/Downloads/fishingPlace.csv';
const jsonOutputPath = '/Users/yongjunjo/Downloads/fishingflace.json';

// A robust CSV parser that correctly handles quotes containing commas and newlines
function parseCSV(csvText: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;
  
  // To handle CRLF easily, just strip the CRs.
  csvText = csvText.replace(/\r/g, '');
  
  const headers: string[] = [];
  let isHeaderRow = true;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentVal += '"';
          i++;
        } else {
          // End quote
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentVal);
        currentVal = '';
      } else if (char === '\n') {
        row.push(currentVal);
        
        // Skip empty rows at the end of the file
        if (row.length === 1 && row[0] === '') {
           break;
        }

        if (isHeaderRow) {
          headers.push(...row);
          isHeaderRow = false;
        } else {
          const obj: Record<string, string> = {};
          for (let j = 0; j < headers.length; j++) {
             // Trim values just in case
             obj[headers[j]] = row[j] !== undefined ? row[j].trim() : '';
          }
           result.push(obj);
        }
        
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  // Handle last row if file doesn't end with newline
  if (!isHeaderRow && (row.length > 0 || currentVal !== '')) {
     row.push(currentVal);
    // Ignore completely empty dangling row
    if (!(row.length === 1 && row[0] === '')) {
       const obj: Record<string, string> = {};
       for (let j = 0; j < headers.length; j++) {
           obj[headers[j]] = row[j] !== undefined ? row[j].trim() : '';
       }
       result.push(obj);
    }
  }

  return result;
}

async function run() {
  console.log('Reading CSV file from', csvFilePath);
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found at ${csvFilePath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  console.log(`Read ${csvContent.length} bytes. Parsing...`);
  
  const parsedData = parseCSV(csvContent);
  console.log(`Successfully parsed ${parsedData.length} rows.`);

  console.log(`Writing to JSON file at ${jsonOutputPath}...`);
  fs.writeFileSync(jsonOutputPath, JSON.stringify(parsedData, null, 2), 'utf-8');
  console.log('JSON file created successfully!');

  console.log(`Uploading to Supabase bucket: '${BUCKET_NAME}'...`);
  
  const fileBuffer = fs.readFileSync(jsonOutputPath);
  
  // Check available buckets first to try guessing if 'data' doesn't exist.
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
      console.warn("Could not list buckets, trying upload anyway. Error:", listError);
  } else {
      console.log("Available buckets:", buckets.map(b => b.name).join(', '));
      const bucketExists = buckets.find(b => b.name === BUCKET_NAME);
      if (!bucketExists && buckets.length > 0) {
          console.log(`Bucket '${BUCKET_NAME}' not found. Let's try to upload to the first bucket: '${buckets[0].name}'`);
          // Use the first available bucket if the assumed one is missing. Or you can prompt.
          // Let's create 'data' if it's missing just in case? Service key can do it.
          // Actually, let's create a bucket called 'data' if missing.
          console.log(`Creating bucket '${BUCKET_NAME}'...`);
          await supabase.storage.createBucket(BUCKET_NAME, { public: true });
      }
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload('fishingflace.json', fileBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (error) {
    console.error('Upload failed:', error.message);
    process.exit(1);
  } else {
    console.log('Upload successful!', data);
  }
}

run();
