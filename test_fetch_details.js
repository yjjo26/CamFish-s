const url = 'https://lpitchsqanzrinravzde.supabase.co/rest/v1/spot_details?spot_id=eq.c876bd1a-e2e4-4d51-a255-a26a9d1750ae&select=*';
const headers = {
  'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaXRjaHNxYW56cmlucmF2emRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDQ1MzIsImV4cCI6MjA4NDgyMDUzMn0.VjnXB5bmX_1j_9WrhR854QR_G7cIktlMCZREqu_cwQI',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwaXRjaHNxYW56cmlucmF2emRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNDQ1MzIsImV4cCI6MjA4NDgyMDUzMn0.VjnXB5bmX_1j_9WrhR854QR_G7cIktlMCZREqu_cwQI'
};

fetch(url, { headers })
  .then(res => res.json())
  .then(data => {
     console.log('fetchSpotDetail returns:');
     console.dir(data, {depth: null});
  });
