const fs = require('fs');
const file = 'src/components/RouteSearchPanel.tsx';
let txt = fs.readFileSync(file, 'utf8');

const t1 = `import { fetchPlaces, Place } from '../data/places';
import { fetchFishSpecies, fetchBaits, fetchBaitShops, fetchVerifiedSpots, FishSpecies, Bait, BaitShop, getCurrentSeason } from '../services/fishingService';
import { fetchCampingDetails, fetchRecommendedGear, fetchCampingRecipes, fetchNearbyAmenities, CampingSpotDetail, CampingGear, CampingRecipe, CampAmenity } from '../services/campingService';
import { fetchWeather, fetchTide, WeatherData, TideData } from '../services/weatherService';`;

const r1 = `import { fetchPlaces, Place } from '../data/places';
import { fetchSpotDetail } from '../services/spotService';
import { SpotDetail } from '../types/database.types';
import { fetchBaitShops, fetchVerifiedSpots, BaitShop, getCurrentSeason } from '../services/fishingService';
import { fetchNearbyAmenities, CampAmenity } from '../services/campingService';
import { fetchWeather, fetchTide, WeatherData, TideData } from '../services/weatherService';`;

const t2 = `    // Real Data State
    const [currentSpecies, setCurrentSpecies] = useState<FishSpecies[]>([]);
    const [currentBaits, setCurrentBaits] = useState<Bait[]>([]);
    const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
    const [currentTide, setCurrentTide] = useState<TideData | null>(null);
    const [nearbyShops, setNearbyShops] = useState<BaitShop[]>([]);

    // Camping Data State
    const [campingDetails, setCampingDetails] = useState<CampingSpotDetail | null>(null);
    const [recommendedGear, setRecommendedGear] = useState<CampingGear[]>([]);
    const [campingRecipes, setCampingRecipes] = useState<CampingRecipe[]>([]);
    const [nearbyAmenities, setNearbyAmenities] = useState<CampAmenity[]>([]);`;

const r2 = `    // Detail State
    const [spotDetail, setSpotDetail] = useState<SpotDetail | null>(null);
    const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
    const [currentTide, setCurrentTide] = useState<TideData | null>(null);
    const [nearbyShops, setNearbyShops] = useState<BaitShop[]>([]);

    const [nearbyAmenities, setNearbyAmenities] = useState<CampAmenity[]>([]);`;

const t3 = `        if (!focusedPlace) {
            // Reset Detail State
            setCurrentSpecies([]);
            setCurrentBaits([]);
            setCurrentWeather(null);
            setCurrentTide(null);
            setNearbyShops([]);
            setCampingDetails(null);
            setRecommendedGear([]);
            setCampingRecipes([]);
            setNearbyAmenities([]);
            return;
        }`;

const r3 = `        if (!focusedPlace) {
            // Reset Detail State
            setSpotDetail(null);
            setCurrentWeather(null);
            setCurrentTide(null);
            setNearbyShops([]);
            setNearbyAmenities([]);
            return;
        }`;

const t4 = `            // 2. Fishing Data (if applicable)
            if (focusedPlace.type === 'FISHING') {
                let species = await fetchFishSpecies(String(focusedPlace.id));

                // [Fallback] If no location-specific species, use seasonal defaults
                if (species.length === 0) {
                    console.log('[Fallback] No location-specific species found, fetching seasonal defaults.');
                    const { fetchSeasonalSpecies } = await import('../services/fishingService');
                    species = await fetchSeasonalSpecies();
                }

                setCurrentSpecies(species);

                // Fetch Baits for these species (with names for fallback)
                const speciesIds = species.map(s => s.id);
                const speciesNames = species.map(s => s.name);
                const baits = await fetchBaits(speciesIds, speciesNames);
                setCurrentBaits(baits);
            } else if (focusedPlace.type === 'CAMPING') {
                // Fetch Camping Data
                const details = await fetchCampingDetails(String(focusedPlace.id));
                setCampingDetails(details);

                const gear = await fetchRecommendedGear(String(focusedPlace.id));
                setRecommendedGear(gear);

                const recipes = await fetchCampingRecipes();
                setCampingRecipes(recipes);
            }`;

const r4 = `            // 2. Fetch Spot Details Single Row Record
            const detail = await fetchSpotDetail(String(focusedPlace.id));
            if (detail) {
                // Ensure raw strings are parsed into JSON if Supabase returned text instead of JSONB
                const safeParse = (data) => {
                    if (typeof data === 'string') {
                        try { return JSON.parse(data); } catch { return {}; }
                    }
                    return data || {};
                };
                
                detail.fishing_info = safeParse(detail.fishing_info);
                detail.camping_info = safeParse(detail.camping_info);
            }
            setSpotDetail(detail);`;

const t5 = `                                            {/* Fishing Section */}
                                            {focusedPlace.type === 'FISHING' && (
                                                <>
                                                    <div className="section-header">🐟 주요 어종</div>
                                                    <div className="mini-grid">
                                                        {currentSpecies.length > 0 ? currentSpecies.map((s) => (
                                                            <div key={s.id} className="mini-glass-item">
                                                                <div className="mini-icon-box">🐟</div>
                                                                <span className="mini-label">{s.name}</span>
                                                            </div>
                                                        )) : <span className="no-data">정보 없음</span>}
                                                    </div>

                                                    <div className="section-header">🪱 추천 미끼</div>
                                                    <div className="bait-list-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {currentBaits.map(b => (
                                                            <span key={b.id} className="bait-tag" style={{ background: '#ECFDF5', color: '#059669', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{b.name}</span>
                                                        ))}
                                                    </div>
                                                </>
                                            )}

                                            {/* Camping Section */}
                                            {focusedPlace.type === 'CAMPING' && (
                                                <>
                                                    <div className="section-header">🎒 추천 장비</div>
                                                    <div className="mini-grid">
                                                        {recommendedGear.map((g) => (
                                                            <div key={g.id} className="mini-glass-item">
                                                                <div className="mini-icon-box">
                                                                    {g.isEssentialForWinter ? '❄️' : '🎒'}
                                                                </div>
                                                                <span className="mini-label">{g.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="section-header">🍳 캠핑 요리</div>
                                                    <div className="mini-grid">
                                                        {campingRecipes.map((r) => (
                                                            <div key={r.id} className="mini-glass-item">
                                                                <div className="mini-icon-box">🍳</div>
                                                                <span className="mini-label">{r.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}`;

const r5 = `                                            {/* Fishing Section */}
                                            {focusedPlace.type === 'FISHING' && (
                                                <>
                                                    <div className="section-header">🐟 주요 어종</div>
                                                    <div className="mini-grid">
                                                        {(spotDetail?.fishing_info?.target_species?.length ?? 0) > 0 ? (
                                                            spotDetail.fishing_info.target_species.map((s, idx) => (
                                                                <div key={idx} className="mini-glass-item">
                                                                    <div className="mini-icon-box">🐟</div>
                                                                    <span className="mini-label">{s}</span>
                                                                </div>
                                                            ))
                                                        ) : <span className="no-data">상세 정보 없음</span>}
                                                    </div>

                                                    <div className="section-header">🪱 추천 미끼</div>
                                                    <div className="bait-list-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {(spotDetail?.fishing_info?.recommended_baits || []).map((b, idx) => (
                                                            <span key={idx} className="bait-tag" style={{ background: '#ECFDF5', color: '#059669', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{b}</span>
                                                        ))}
                                                    </div>
                                                </>
                                            )}

                                            {/* Camping Section */}
                                            {focusedPlace.type === 'CAMPING' && (
                                                <>
                                                    <div className="section-header">🎒 주요 시설 및 장비</div>
                                                    <div className="mini-grid">
                                                        {(spotDetail?.camping_info?.facilities || []).map((f, idx) => (
                                                            <div key={idx} className="mini-glass-item">
                                                                <div className="mini-icon-box">🎒</div>
                                                                <span className="mini-label">{f}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="section-header">🍳 캠핑 요리</div>
                                                    <div className="mini-grid">
                                                        {(spotDetail?.camping_info?.recipes || []).map((r, idx) => (
                                                            <div key={idx} className="mini-glass-item">
                                                                <div className="mini-icon-box">🍳</div>
                                                                <span className="mini-label">{r.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}`;

let replacements = [[t1, r1], [t2, r2], [t3, r3], [t4, r4], [t5, r5]];

for (let i = 0; i < replacements.length; i++) {
    const [t, r] = replacements[i];
    if (txt.includes(t)) {
        txt = txt.replace(t, r);
        console.log(`Successfully replaced chunk ${i + 1}`);
    } else {
        console.log(`FAILED to find chunk ${i + 1}`);
    }
}

fs.writeFileSync(file, txt);
