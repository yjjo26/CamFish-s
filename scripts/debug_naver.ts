
import 'dotenv/config';

// Load keys
const ID = process.env.VITE_NAVER_MAP_CLIENT_ID;
const SECRET = process.env.VITE_NAVER_MAP_CLIENT_SECRET;

console.log(`Loaded ID: '${ID}' (Length: ${ID?.length})`);
console.log(`Loaded Secret: '${SECRET?.substring(0, 5)}...' (Length: ${SECRET?.length})`);

async function testGeocode() {
    const address = "분당구 불정로 6";
    const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;

    console.log("Requesting URL:", url);
    console.log("Headers:", {
        'X-NCP-APIGW-API-KEY-ID': ID,
        'X-NCP-APIGW-API-KEY': '***HIDDEN***'
    });

    try {
        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': ID?.trim()!,
                'X-NCP-APIGW-API-KEY': SECRET?.trim()!
            }
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.log("Response Body:", text);
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testGeocode();
