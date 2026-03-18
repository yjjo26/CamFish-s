const url = 'https://lpitchsqanzrinravzde.supabase.co/rest/v1/spot_details?select=*&limit=3';
const headers = {
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaXRjaHNxYW56cmlucmF2emRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDQ1MzIsImV4cCI6MjA4NDgyMDUzMn0.VjnXB5bmX_1j_9WrhR854QR_G7cIktlMCZREqu_cwQI',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaXRjaHNxYW56cmlucmF2emRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDQ1MzIsImV4cCI6MjA4NDgyMDUzMn0.VjnXB5bmX_1j_9WrhR854QR_G7cIktlMCZREqu_cwQI'
};

fetch(url, { headers })
  .then(res => res.json())
  .then(data => {
     console.log('--- spot_details ---');
     console.dir(data, {depth: null});
  });

const url2 = 'https://lpitchsqanzrinravzde.supabase.co/rest/v1/spots?select=id,name&limit=3';
fetch(url2, { headers })
  .then(res => res.json())
  .then(data => {
     console.log('\n--- spots ---');
     console.dir(data, {depth: null});
  });
