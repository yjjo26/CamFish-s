import { useState, useRef, useEffect } from 'react';
import { getDrivingRoute, geocodeAddress, Coordinates } from '../services/naverMapService';
import { analyzeTripIntent, TripAnalysisResult, searchPlacesWithGemini, searchPlacesByKeywords } from '../services/tripAgentService';
import { supabase } from '../lib/supabase';
import { fetchPlaces, Place } from '../data/places';
import { fetchFishSpecies, fetchBaits, fetchBaitShops, fetchVerifiedSpots, FishSpecies, Bait, BaitShop, getCurrentSeason } from '../services/fishingService';
import { fetchCampingDetails, fetchRecommendedGear, fetchCampingRecipes, fetchNearbyAmenities, CampingSpotDetail, CampingGear, CampingRecipe, CampAmenity } from '../services/campingService';
import { fetchWeather, fetchTide, WeatherData, TideData } from '../services/weatherService';
import CleanupReviewSection from './CleanupReviewSection';

// @ts-ignore
import MarkerClustering from '../lib/MarkerClustering';
import './RouteSearchPanel.css';

const POPULAR_POINTS = [
    { id: 'p1', name: '을왕리 선녀바위', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=200&fit=crop', desc: '서울 근교 국민 포인트' },
    { id: 'p2', name: '궁평항 피싱피어', image: 'https://images.unsplash.com/photo-1516939884455-1445c8652f83?w=200&h=200&fit=crop', desc: '가족 낚시 추천' },
    { id: 'p3', name: '시화방조제', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=200&fit=crop', desc: '우럭/광어 손맛' },
    { id: 'p4', name: '가평 자라섬', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&h=200&fit=crop', desc: '캠핑 페스티벌' },
    { id: 'p5', name: '몽산포 캠핑장', image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=200&h=200&fit=crop', desc: '갯벌 체험 가능한 곳' }
];

interface RouteSearchPanelProps {
    map: naver.maps.Map | null;
    activeCategory: 'ALL' | 'NONE' | 'FISHING' | 'CAMPING';
    onCategoryChange: (category: 'ALL' | 'NONE' | 'FISHING' | 'CAMPING') => void;
    // Lifted State
    isExpanded: boolean;
    onExpandChange: (expanded: boolean) => void;
}

interface Waypoint {
    id: string;
    value: string;
}

const RouteSearchPanel = ({ map, activeCategory, onCategoryChange, isExpanded, onExpandChange: setIsExpanded }: RouteSearchPanelProps) => {
    // Inputs (Keep existing)
    const [startLocation, setStartLocation] = useState('내 위치');
    const [goalLocation, setGoalLocation] = useState('');
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

    // Data State (Keep existing)
    const [places, setPlaces] = useState<Place[]>([]);

    // UI State
    // isExpanded removed (lifted)
    const [isSearching, setIsSearching] = useState(false);

    // Touch Logic for Slide
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientY);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > minSwipeDistance) {
            setIsExpanded(true);
        } else if (distance < -minSwipeDistance) {
            setIsExpanded(false);
        }
    };


    // AI Trip State
    const [tripResult, setTripResult] = useState<TripAnalysisResult | null>(null);
    const [verifiedSpots, setVerifiedSpots] = useState<any[]>([]);

    // Load Verified Spots on Mount for Hybrid Search
    useEffect(() => {
        const loadSpots = async () => {
            const spots = await fetchVerifiedSpots();
            console.log("Loaded Verified Spots:", spots.length);
            setVerifiedSpots(spots);
        };
        loadSpots();
    }, []);


    // Real Data State
    const [currentSpecies, setCurrentSpecies] = useState<FishSpecies[]>([]);
    const [currentBaits, setCurrentBaits] = useState<Bait[]>([]);
    const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
    const [currentTide, setCurrentTide] = useState<TideData | null>(null);
    const [nearbyShops, setNearbyShops] = useState<BaitShop[]>([]);

    // Camping Data State
    const [campingDetails, setCampingDetails] = useState<CampingSpotDetail | null>(null);
    const [recommendedGear, setRecommendedGear] = useState<CampingGear[]>([]);
    const [campingRecipes, setCampingRecipes] = useState<CampingRecipe[]>([]);
    const [nearbyAmenities, setNearbyAmenities] = useState<CampAmenity[]>([]);

    const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
    const [focusedPlace, setFocusedPlace] = useState<Place | null>(null);

    // Checklist State
    const [selectedChecklistItems, setSelectedChecklistItems] = useState<Set<string>>(new Set());
    const [expandedChecklistItems, setExpandedChecklistItems] = useState<Set<string>>(new Set());

    // Map Objects
    const mapObjectsRef = useRef<{
        startMarker?: naver.maps.Marker;
        goalMarker?: naver.maps.Marker;
        waypointMarkers: naver.maps.Marker[];
        polyline?: naver.maps.Polyline;
        categoryMarkers: naver.maps.Marker[]; // Legacy: Kept for type safety, but unused with clustering
        shopMarkers: naver.maps.Marker[];
        clusterer?: any; // MarkerClustering Instance
    }>({ waypointMarkers: [], categoryMarkers: [], shopMarkers: [] });

    const [routeSummary, setRouteSummary] = useState<{ distance: number; duration: number } | null>(null);

    useEffect(() => {
        // Just ensures we have a map
        (window as any).setGoal = (name: string) => {
            setGoalLocation(name);
            setIsExpanded(true);
            alert(`'${name}' 도착지로 설정되었습니다!`);
        };
    }, [map]);

    // Fetch Places on Mount
    useEffect(() => {
        const loadPlaces = async () => {
            const data = await fetchPlaces();

            setPlaces(data);
        };
        loadPlaces();
    }, []);


    // Effect: Fetch Detail Data when focusedPlace changes
    useEffect(() => {
        if (!focusedPlace) {
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
        }

        const loadDetailData = async () => {
            // 1. Weather & Tide
            const weather = await fetchWeather(focusedPlace.lat, focusedPlace.lng);
            const tide = await fetchTide(focusedPlace.lat, focusedPlace.lng);
            setCurrentWeather(weather);
            setCurrentTide(tide);

            // 2. Fishing Data (if applicable)
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
            }
        };

        loadDetailData();
    }, [focusedPlace]);

    // Handle Category Toggles with Clustering
    useEffect(() => {
        if (!map) return;

        // ... existing cleanup code ...
        // 1. Clear existing clusterer and markers
        if (mapObjectsRef.current.clusterer) {
            mapObjectsRef.current.clusterer.setMap(null);
            mapObjectsRef.current.clusterer = null;
        }

        // Clear existing shop markers
        if (mapObjectsRef.current.shopMarkers) {
            mapObjectsRef.current.shopMarkers.forEach(m => m.setMap(null));
        }
        mapObjectsRef.current.shopMarkers = [];

        if (activeCategory === 'NONE') return;

        // 2. Filter Places
        const placesToShow = activeCategory === 'ALL'
            ? places
            : places.filter(p => p.type === activeCategory);

        // Refined Logic for Focus Mode
        let markersToRender: Place[];
        if (focusedPlace) {
            markersToRender = [focusedPlace];
        } else {
            markersToRender = placesToShow;
        }

        // 3. Create Markers
        const newMarkers = markersToRender.map(place => {
            const iconChar = place.type === 'FISHING' ? '🎣' : '⛺';
            const color = place.type === 'FISHING' ? '#2563EB' : '#10B981';

            const marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(place.lat, place.lng),
                title: place.name,
                icon: {
                    content: `<div style="background:${color}cc;backdrop-filter:blur(4px);width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,0.6);box-shadow:0 8px 32px rgba(31,38,135,0.25);display:flex;justify-content:center;align-items:center;font-size:18px;">
                                ${iconChar}
                              </div>`,
                    anchor: new naver.maps.Point(18, 18)
                }
            });

            naver.maps.Event.addListener(marker, 'click', () => {
                setFocusedPlace(place);
                setIsExpanded(true);
                (map as any).panTo(new naver.maps.LatLng(place.lat, place.lng));
            });

            return marker;
        });

        // 4. Initialize MarkerClustering
        if (newMarkers.length > 0) {
            const clusterColor = activeCategory === 'CAMPING' ? '#10B981' : '#2563EB';
            try {
                const clusterer = new (MarkerClustering as any)({
                    minClusterSize: 2,
                    maxZoom: 13,
                    map: map,
                    markers: newMarkers,
                    disableClickZoom: false,
                    gridSize: 120,
                    icons: [
                        {
                            content: `<div style="cursor:pointer;width:40px;height:40px;line-height:40px;font-size:14px;color:white;text-align:center;font-weight:bold;background:${clusterColor};border-radius:50%;border:2px solid white;z-index:9999;box-shadow:0 2px 5px rgba(0,0,0,0.3);">\${count}</div>`,
                            size: new (naver.maps as any).Size(40, 40),
                            anchor: new (naver.maps as any).Point(20, 20)
                        },
                        {
                            content: `<div style="cursor:pointer;width:50px;height:50px;line-height:50px;font-size:16px;color:white;text-align:center;font-weight:bold;background:${clusterColor};border-radius:50%;border:3px solid white;z-index:9999;box-shadow:0 2px 5px rgba(0,0,0,0.3);">\${count}</div>`,
                            size: new (naver.maps as any).Size(50, 50),
                            anchor: new (naver.maps as any).Point(25, 25)
                        },
                        {
                            content: `<div style="cursor:pointer;width:60px;height:60px;line-height:60px;font-size:18px;color:white;text-align:center;font-weight:bold;background:${clusterColor};border-radius:50%;border:4px solid white;z-index:9999;box-shadow:0 2px 5px rgba(0,0,0,0.3);">\${count}</div>`,
                            size: new (naver.maps as any).Size(60, 60),
                            anchor: new (naver.maps as any).Point(30, 30)
                        }
                    ]
                });
                mapObjectsRef.current.clusterer = clusterer;
            } catch (err) {
                console.error("MarkerClustering initialization failed:", err);
            }
        }

        // Shop Markers (Render valid nearby shops)
        const newShopMarkers: naver.maps.Marker[] = [];
        nearbyShops.forEach(shop => {
            const shopMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(shop.lat, shop.lng),
                map: map,
                title: shop.name,
                icon: {
                    content: `<div style="background:#F59E0B;width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;font-size:14px;">🛒</div>`,
                    anchor: new naver.maps.Point(12, 12)
                }
            });

            naver.maps.Event.addListener(shopMarker, 'click', () => {
                alert(`${shop.name} (${shop.distance?.toFixed(1)}km)\n${shop.address || ''}\n${shop.phone || ''}`);
            });
            newShopMarkers.push(shopMarker);
        });

        // Amenities Markers
        nearbyAmenities.forEach(amenity => {
            const amMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(amenity.lat, amenity.lng),
                map: map,
                title: amenity.name,
                icon: {
                    content: `<div style="background:#10B981;width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;font-size:14px;">🏪</div>`,
                    anchor: new naver.maps.Point(12, 12)
                }
            });

            naver.maps.Event.addListener(amMarker, 'click', () => {
                alert(`${amenity.name} (${amenity.distance?.toFixed(1)}km)\n${amenity.address || ''}\n${amenity.phone || ''}`);
            });
            newShopMarkers.push(amMarker);
        });

        mapObjectsRef.current.shopMarkers = newShopMarkers;


    }, [activeCategory, map, places, focusedPlace, nearbyShops, nearbyAmenities]); // Added nearbyAmenities dependency

    const getCurrentLocationCoords = (): Promise<Coordinates> => {
        return new Promise((resolve) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
                    },
                    (error) => {
                        console.error('Geolocation error:', error);
                        resolve({ lat: 37.5665, lng: 126.9780 }); // Fallback
                    }
                );
            } else {
                resolve({ lat: 37.5665, lng: 126.9780 });
            }
        });
    };

    // Frontend Geocoding Helper (Bypassing Server 401)
    const geocodeFrontend = (address: string): Promise<{ lat: number, lng: number } | null> => {
        return new Promise((resolve) => {
            if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
                console.warn("Naver Maps Service not available");
                resolve(null);
                return;
            }
            window.naver.maps.Service.geocode({ query: address }, (status: any, response: any) => {
                if (status !== window.naver.maps.Service.Status.OK) {
                    console.warn(`Geocode failed for: ${address}`);
                    resolve(null);
                } else {
                    const item = response.v2.addresses[0];
                    if (item) {
                        resolve({ lat: parseFloat(item.y), lng: parseFloat(item.x) });
                    } else {
                        resolve(null);
                    }
                }
            });
        });
    };

    const resolveCoordinates = async (address: string): Promise<Coordinates> => {
        if (address === '내 위치') {
            return getCurrentLocationCoords();
        }

        // Check Predefined Places FIRST for instant match using state
        const predefined = places.find(p => p.name === address);
        if (predefined) {
            return { lat: predefined.lat, lng: predefined.lng };
        }

        const coords = await geocodeAddress(address);
        return coords;
    };

    const clearMapObjects = () => {
        const objs = mapObjectsRef.current;
        if (objs.startMarker) objs.startMarker.setMap(null);
        if (objs.goalMarker) objs.goalMarker.setMap(null);
        objs.waypointMarkers.forEach(m => m.setMap(null));
        if (objs.polyline) objs.polyline.setMap(null);
        // Note: We DO NOT clear categoryMarkers here, they are independent

        mapObjectsRef.current.startMarker = undefined;
        mapObjectsRef.current.goalMarker = undefined;
        mapObjectsRef.current.waypointMarkers = [];
        mapObjectsRef.current.polyline = undefined;
    };

    // Stage 1: Analyze Intent and Show Options
    const handleSearch = async () => {
        if (!map || !goalLocation.trim()) return;

        setIsSearching(true);
        setRouteSummary(null);
        setTripResult(null);
        setSelectedSpots([]);
        setSelectedChecklistItems(new Set()); // Reset checklist
        clearMapObjects();

        try {
            // 0. Check Predefined Match using state
            const predefined = places.find(p => p.name.includes(goalLocation) || goalLocation.includes(p.name));
            if (predefined) {
                // Optimization: If user types "Eulwangri", map it to the predefined spot name
                console.log("Matched Predefined Spot:", predefined.name);
                // We still allow AI analysis for checklist, but we hint the destination
            } else {
                // 0-1. Real-time AI Search & Cache (If no predefined match)
                console.log("No local match found. Triggering Real-time AI Search...");

                // [NEW] Direct Supabase Query for Partial Matches
                const { data: dbMatches } = await supabase
                    .from('places')
                    .select('*')
                    .or(`name.ilike.%${goalLocation}%,address.ilike.%${goalLocation}%`)
                    .limit(5);

                let mergedPlaces = [...places];

                if (dbMatches && dbMatches.length > 0) {
                    console.log(`[Supabase] Found ${dbMatches.length} matches from DB`);
                    // Merge DB results
                    const newFromDB = dbMatches.map(p => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        address: p.address,
                        lat: p.location?.coordinates?.[1] || p.lat, // Handle GeoJSON or flat columns
                        lng: p.location?.coordinates?.[0] || p.lng,
                        description: p.description,
                        image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200'
                    })) as Place[];

                    // Filter duplicates
                    const uniqueNew = newFromDB.filter(n => !mergedPlaces.find(e => e.name === n.name));
                    mergedPlaces = [...mergedPlaces, ...uniqueNew];
                    setPlaces(mergedPlaces);

                    // Check if one of them matches the goal
                    const dbDirectMatch = uniqueNew.find(p => p.name.includes(goalLocation));
                    if (dbDirectMatch) {
                        console.log("Matched DB Spot:", dbDirectMatch.name);
                        // Use this matched spot for navigation target if user confirms immediately
                        // For now just ensuring it's in the list
                    }
                }

                // UI Feedback?
                const aiPlaces = await searchPlacesWithGemini(goalLocation);
                if (aiPlaces.length > 0) {
                    console.log(`AI found ${aiPlaces.length} new places. Geocoding & Saving...`);
                    const newCachedPlaces: Place[] = [];

                    for (const aiPlace of aiPlaces) {
                        const coords = await geocodeFrontend(aiPlace.address);
                        if (coords) {
                            console.log(`✅ Geocoded: ${aiPlace.name} ->`, coords);
                            // Upsert to DB
                            const { data: saved, error } = await supabase
                                .from('places')
                                .upsert({
                                    name: aiPlace.name,
                                    type: aiPlace.type,
                                    address: aiPlace.address,
                                    description: aiPlace.description,
                                    location: { type: 'Point', coordinates: [coords.lng, coords.lat] },
                                    lat: coords.lat, // Redundant but useful for simple select
                                    lng: coords.lng
                                }, { onConflict: 'name' })
                                .select()
                                .single(); // Single might fail if not returned, usually select() returns array. .select().single() works for one.

                            if (!error && saved) {
                                // Add to local state immediately
                                newCachedPlaces.push({
                                    id: saved.id,
                                    name: saved.name,
                                    type: saved.type,
                                    lat: coords.lat,
                                    lng: coords.lng,
                                    address: saved.address,
                                    image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200', // Default
                                    desc: saved.description
                                });
                            }
                        }
                    }

                    if (newCachedPlaces.length > 0) {
                        // Merge again
                        setPlaces(prev => {
                            // Dedup against prev
                            const all = [...prev, ...newCachedPlaces];
                            return all.filter((v, i, a) => a.findIndex(v2 => (v2.name === v.name)) === i);
                        });

                        // If one of them matches the goal, use it
                        const directMatch = newCachedPlaces.find(p => p.name.includes(goalLocation));
                        if (directMatch) {
                            console.log("Matched newly cached spot:", directMatch.name);
                        }
                    }
                }
            }

            // 1. AI Analysis
            const analysis = await analyzeTripIntent(goalLocation, startLocation, verifiedSpots);

            // 2. Enhanced Keyword Search using AI-extracted keywords
            if (analysis.searchKeywords && analysis.searchKeywords.length > 0) {
                console.log(`[Smart Search] Using AI keywords:`, analysis.searchKeywords);
                const keywordMatches = await searchPlacesByKeywords(analysis.searchKeywords);

                if (keywordMatches.length > 0) {
                    console.log(`[Smart Search] Found ${keywordMatches.length} matches from keywords`);

                    // Convert to Place format and merge
                    const newPlaces = keywordMatches.map(p => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        address: p.address,
                        lat: p.location?.coordinates?.[1] || p.lat,
                        lng: p.location?.coordinates?.[0] || p.lng,
                        description: p.description,
                        image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200'
                    })) as Place[];

                    // Merge with existing places (dedup)
                    setPlaces(prev => {
                        const all = [...prev, ...newPlaces];
                        return all.filter((v, i, a) => a.findIndex(v2 => v2.name === v.name) === i);
                    });

                    // If top match has high score, update destination
                    const topMatch = keywordMatches[0];
                    if (topMatch.matchScore >= 2 && !analysis.destinationId) {
                        console.log(`[Smart Search] High confidence match: ${topMatch.name}`);
                        analysis.destination = topMatch.name;
                        analysis.destinationCoords = { lat: topMatch.lat, lng: topMatch.lng };
                    }
                }
            }

            setTripResult(analysis);

            if (analysis.recommendedSpots) {
                const initialSet = new Set<string>();
                analysis.recommendedSpots.forEach(s => initialSet.add(s.name));
                if (analysis.recommendedStopovers) {
                    analysis.recommendedStopovers.forEach(s => initialSet.add(s.name));
                }
                setSelectedSpots(Array.from(initialSet));
            }
            setIsExpanded(true);

        } catch (error) {
            console.error(error);
            alert("여행 분석 중 오류가 발생했습니다. 일반 검색으로 진행합니다.");
            handleStartRealNavigation(goalLocation);
        } finally {
            setIsSearching(false);
        }
    };

    // Stage 2: User Confirmed Selection -> Start Navigation
    const handleConfirmTrip = async () => {
        if (!tripResult) return;
        await handleStartRealNavigation(tripResult.destination);
    };

    // Core Navigation Logic
    const handleStartRealNavigation = async (finalDestination: string, targetCoordsOverride?: Coordinates) => {
        setIsSearching(true);
        try {
            // 1. Resolve Start/Goal
            const startCoords = await resolveCoordinates(startLocation);

            let goalCoords: Coordinates;

            // PRIORITY 1: Explicit Coordinates (from Map Click / DB)
            if (targetCoordsOverride) {
                console.log("Using Explicit Target Coordinates:", targetCoordsOverride);
                goalCoords = targetCoordsOverride;
            }
            // PRIORITY 2: Validated AI Result Coords (Hybrid Search)
            else if (tripResult?.destinationId && tripResult.destinationCoords && tripResult.destination === finalDestination) {
                console.log("Using Verified DB Coordinates for Goal:", tripResult.destinationCoords);
                goalCoords = tripResult.destinationCoords;
            }
            // PRIORITY 3: Geocoding Name (Fallback)
            else {
                console.log("Geocoding Goal Name:", finalDestination);
                goalCoords = await resolveCoordinates(finalDestination);
            }

            // 2. Resolve Manual Waypoints
            const manualWaypointPromises = waypoints
                .filter(wp => wp.value.trim() !== '')
                .map(wp => resolveCoordinates(wp.value));

            // 3. Resolve AI Selected Waypoints (Respect Order)
            const aiWaypointPromises = selectedSpots.map(name => {
                let spotObj = tripResult?.recommendedSpots?.find(s => s.name === name);
                if (!spotObj) {
                    spotObj = tripResult?.recommendedStopovers?.find(s => s.name === name);
                }
                // Also check inside checklist details for shops
                if (!spotObj && tripResult?.checklistDetails) {
                    for (const detail of tripResult.checklistDetails) {
                        const shop = detail.recommendedShops?.find(s => s.name === name);
                        if (shop) {
                            spotObj = { ...shop, type: 'SHOP' };
                            break;
                        }
                    }
                }

                const query = spotObj?.address || name;
                console.log(`Geocoding Spot: ${name} -> Query: ${query}`);
                return resolveCoordinates(query);
            });

            const allWaypointCoords = await Promise.all([...manualWaypointPromises, ...aiWaypointPromises]);

            // 4. Draw Markers (Start/Goal)
            const objs = mapObjectsRef.current;

            // Start
            objs.startMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(startCoords.lat, startCoords.lng),
                map: map!,
                title: '출발: ' + startLocation,
                icon: {
                    content: '<div style="background:#22C55E;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
                    anchor: new naver.maps.Point(8, 8)
                }
            });

            // Goal
            const isFishingParams = tripResult?.theme === 'FISHING';
            objs.goalMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(goalCoords.lat, goalCoords.lng),
                map: map!,
                title: '도착: ' + finalDestination,
                icon: {
                    content: isFishingParams
                        ? `<div style="background:#2563EB;width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">🎣</div>`
                        : `<div style="background:#EF4444;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
                    anchor: isFishingParams ? new naver.maps.Point(12, 12) : new naver.maps.Point(8, 8)
                }
            });

            // Waypoints
            objs.waypointMarkers = allWaypointCoords.map((coord, idx) => {
                return new naver.maps.Marker({
                    position: new naver.maps.LatLng(coord.lat, coord.lng),
                    map: map!,
                    title: `경유지 ${idx + 1}`,
                    icon: {
                        content: `<div style="background:#F59E0B;width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;">${idx + 1}</div>`,
                        anchor: new naver.maps.Point(10, 10)
                    }
                });
            });

            // 5. Get Route
            const routeResult = await getDrivingRoute(startCoords, goalCoords, allWaypointCoords);
            const route = routeResult.route?.trafast[0];

            if (!route) throw new Error("경로를 찾을 수 없습니다.");

            // 6. Draw Polyline
            const pathCoords = route.path.map(p => new naver.maps.LatLng(p[1], p[0]));
            objs.polyline = new naver.maps.Polyline({
                path: pathCoords,
                map: map!,
                strokeColor: '#4A6CF7',
                strokeWeight: 6,
                strokeOpacity: 0.9,
                strokeLineCap: 'round',
                strokeLineJoin: 'round'
            });

            setRouteSummary({
                distance: route.summary.distance,
                duration: route.summary.duration
            });

            // 7. Fit Bounds
            const bounds = new naver.maps.LatLngBounds(
                new naver.maps.LatLng(route.summary.bbox[0][1], route.summary.bbox[0][0]),
                new naver.maps.LatLng(route.summary.bbox[1][1], route.summary.bbox[1][0])
            );
            map!.fitBounds(bounds, { top: 100, bottom: 100, left: 50, right: 50 });

            setIsExpanded(false);

        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "경로 탐색 실패 (지도 서비스 오류)");
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddWaypoint = () => {
        if (waypoints.length >= 3) {
            alert("수동 경유지는 최대 3개까지만 가능합니다.");
            return;
        }
        setWaypoints([...waypoints, { id: crypto.randomUUID(), value: '' }]);
    };

    const handleRemoveWaypoint = (id: string) => {
        setWaypoints(waypoints.filter(wp => wp.id !== id));
    };

    const handleWaypointChange = (id: string, newVal: string) => {
        setWaypoints(waypoints.map(wp => wp.id === id ? { ...wp, value: newVal } : wp));
    };

    const toggleSpotSelection = (spotName: string) => {
        if (selectedSpots.includes(spotName)) {
            setSelectedSpots(selectedSpots.filter(s => s !== spotName));
        } else {
            setSelectedSpots([...selectedSpots, spotName]);
        }
    };

    const moveSpot = (index: number, direction: 'UP' | 'DOWN') => {
        if ((direction === 'UP' && index === 0) || (direction === 'DOWN' && index === selectedSpots.length - 1)) return;

        const newSpots = [...selectedSpots];
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;
        const temp = newSpots[index];
        newSpots[index] = newSpots[targetIndex];
        newSpots[targetIndex] = temp;
        setSelectedSpots(newSpots);
    };

    const toggleChecklistItem = (item: string) => {
        const newSet = new Set(selectedChecklistItems);
        if (newSet.has(item)) {
            newSet.delete(item);
        } else {
            newSet.add(item);
        }
        setSelectedChecklistItems(newSet);
    };

    const toggleChecklistExpand = (item: string) => {
        const newSet = new Set(expandedChecklistItems);
        if (newSet.has(item)) { newSet.delete(item); }
        else { newSet.add(item); }
        setExpandedChecklistItems(newSet);
    };

    const formatDistance = (meters: number) => {
        if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
        return `${meters}m`;
    };

    const formatDuration = (ms: number) => {
        const mins = Math.round(ms / 60000);
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            return `${hours}시간 ${mins % 60}분`;
        }
        return `${mins}분`;
    };

    return (
        <>
            {/* 1. Bottom Fixed Search/Nav Container */}
            <div
                className={`bottom-sheet-container ${isExpanded ? 'active' : ''}`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div className="sheet-handle-bar" onClick={() => setIsExpanded(!isExpanded)}></div>

                <div className="sheet-content-wrapper">
                    {/* Search Bar Floating */}
                    <div className="glass-search-bar-container">
                        <div className="glass-search-input-box">
                            <span className="search-icon">🔍</span>
                            {focusedPlace ? (
                                <div className="simple-input-text" style={{ fontWeight: 'bold', color: '#1E40AF', flex: 1 }}>
                                    {focusedPlace.name}
                                    <button onClick={(e) => { e.stopPropagation(); setFocusedPlace(null); }} style={{ marginLeft: '10px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666' }}>✕</button>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    className="glass-input"
                                    placeholder={tripResult ? `[${tripResult.theme}] ${tripResult.destination}` : "Around current location"}
                                    value={goalLocation}
                                    onChange={(e) => setGoalLocation(e.target.value)}
                                    // Stop propagation so clicking input doesn't toggle sheet if logic requires
                                    onClick={(e) => e.stopPropagation()}
                                    onFocus={() => !isExpanded && setIsExpanded(true)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            )}
                            <button className="glass-filter-btn">
                                <span style={{ fontSize: '18px' }}>⚙️</span>
                            </button>
                        </div>
                    </div>

                    {/* Expanded Content Area */}
                    <div className="bottom-sheet-content">

                        {/* AI Typing Indicator (Loading State) */}
                        {isSearching && !tripResult && (
                            <div className="ai-typing-indicator">
                                <span className="ai-avatar">🤖</span>
                                <span>AI가 분석 중이에요...</span>
                                <div className="typing-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        )}

                        {/* A. Popular Points (Horizontal Scroll) - Only show when NOT searching/planning yet */}
                        {!tripResult && !focusedPlace && !isSearching && (
                            <div className="popular-points-section">
                                <h3 className="section-title">🔥 요즘 뜨는 핫플레이스</h3>
                                <div className="horizontal-scroll-list">
                                    {POPULAR_POINTS.map(point => (
                                        <div key={point.id} className="point-card" onClick={async (e) => {
                                            e.stopPropagation();
                                            // Popular places need geocoding if coords not predefined, but for now we trust name. 
                                            // Better: resolveCoordinates will check 'places' state if we preload them.
                                            // Assuming POPULAR_POINTS names exist in 'places' or will be geocoded.
                                            handleStartRealNavigation(point.name);
                                        }}>
                                            <div className="card-thumb" style={{ backgroundImage: `url(${point.image})` }}></div>
                                            <div className="card-info">
                                                <span className="card-name">{point.name}</span>
                                                <span className="card-desc">{point.desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Category Badges */}
                                <div className="category-badges-row" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                                    <button className={`cat-badge ${activeCategory === 'FISHING' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onCategoryChange(activeCategory === 'FISHING' ? 'ALL' : 'FISHING'); }}>
                                        🎣 낚시
                                    </button>
                                    <button className={`cat-badge ${activeCategory === 'CAMPING' ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); onCategoryChange(activeCategory === 'CAMPING' ? 'ALL' : 'CAMPING'); }}>
                                        ⛺ 캠핑
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* B. Detail / Trip Result View */}
                        {(tripResult || focusedPlace) && (
                            <div className="detail-content-area">

                                {/* Trip Result */}
                                {tripResult && (
                                    <div className="ai-result-section">
                                        {/* AI Conversational Message */}
                                        {tripResult.aiMessage && (
                                            <div className="ai-message-bubble">
                                                <span className="ai-avatar">🤖</span>
                                                <div className="ai-message-content">
                                                    <p className="ai-message-text">{tripResult.aiMessage}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="result-header">
                                            <span className={`theme-badge ${tripResult.theme}`}>{tripResult.theme === 'FISHING' ? '낚시 여행' : tripResult.theme === 'CAMPING' ? '캠핑 여행' : '일반 여행'}</span>
                                            <h4>{tripResult.destination}</h4>
                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                            <button className="confirm-trip-btn" onClick={(e) => { e.stopPropagation(); handleConfirmTrip(); }} disabled={isSearching}>
                                                {isSearching ? '경로 탐색 중...' : '🚗 바로 안내 시작'}
                                            </button>
                                            <button className="confirm-trip-btn" style={{ background: '#F3F4F6', color: '#333' }} onClick={(e) => { e.stopPropagation(); setTripResult(null); setFocusedPlace(null); setRouteSummary(null); }}>
                                                취소
                                            </button>
                                        </div>

                                        {/* Checklist */}
                                        {tripResult.checklistDetails && (
                                            <div className="checklist-box">
                                                <div className="section-title-row">
                                                    <h5>✅ 챙길 것</h5>
                                                </div>
                                                <div className="checklist-grid">
                                                    {tripResult.checklistDetails.map(item => (
                                                        <div key={item.item} className={`check-item-container ${selectedChecklistItems.has(item.item) ? 'completed' : ''}`}>
                                                            <div className="check-item-header" onClick={(e) => { e.stopPropagation(); toggleChecklistItem(item.item); }}>
                                                                <div className={`check-circle ${selectedChecklistItems.has(item.item) ? 'checked' : ''}`}>
                                                                    {selectedChecklistItems.has(item.item) ? '✔' : ''}
                                                                </div>
                                                                <div className="label-group" style={{ marginLeft: '10px' }}>
                                                                    <span className="check-name">{item.item}</span>
                                                                    {/* @ts-ignore */}
                                                                    <span className="check-cate">{item.reason}</span>
                                                                </div>
                                                            </div>
                                                            {/* Recommendation Card */}
                                                            {item.recommendedShops && item.recommendedShops.length > 0 && selectedChecklistItems.has(item.item) && (
                                                                <div className="shop-recommendation-card">
                                                                    <div className="rec-badge">추천 구매처</div>
                                                                    {item.recommendedShops.map((shop, idx) => (
                                                                        <div key={idx} className="shop-row">
                                                                            <span className="shop-name">{shop.name}</span>
                                                                            <span className="shop-addr">{shop.address}</span>
                                                                            <button className="nav-btn-mini" onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                // Shops usually come from detail check, but we might not have lat/lng here if it's just from Gemini text.
                                                                                // If we have coords from 'places' match, we should use them.
                                                                                handleStartRealNavigation(shop.name, shop.lat && shop.lng ? { lat: shop.lat, lng: shop.lng } : undefined);
                                                                            }}>안내</button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Focused Place Detail */}
                                {focusedPlace && !tripResult && (
                                    <div className="place-detail-card">
                                        <div className="place-header">
                                            <div className="place-title-row">
                                                <h3>{focusedPlace.name}</h3>
                                                <span className={`type-tag ${focusedPlace.type}`}>{focusedPlace.type === 'FISHING' ? '낚시' : '캠핑'}</span>
                                            </div>
                                            <p className="place-addr">{focusedPlace.address}</p>
                                        </div>

                                        {/* Weather & Tide Widget */}
                                        <div className="weather-widget">
                                            <div className="info-row">
                                                <span className="info-icon">🌤</span>
                                                <span className="info-label">기상:</span>
                                                <span className="info-val">{currentWeather ? `${currentWeather.temp}°C / ${currentWeather.condition}` : '로딩중...'}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-icon">🌊</span>
                                                <span className="info-label">물때:</span>
                                                {/* @ts-ignore */}
                                                <span className="info-val">{currentTide ? `물때: ${currentTide.score}` : '로딩중...'}</span>
                                            </div>
                                        </div>

                                        {/* Fishing Species & Baits (Moved Here) */}
                                        {focusedPlace.type === 'FISHING' && (
                                            <div className="detail-section" style={{ marginTop: '16px', marginBottom: '16px' }}>

                                                {/* Major Species (Icons) */}
                                                <h5 style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 'bold' }}>🐟 주요 어종</h5>
                                                <div className="species-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                                                    {currentSpecies.length > 0 ? currentSpecies.map((s) => {
                                                        // Fish icon mapping
                                                        const getFishIcon = (name: string) => {
                                                            const n = name.toLowerCase();
                                                            if (n.includes('오징어') || n.includes('한치')) return '🦑';
                                                            if (n.includes('문어') || n.includes('쭈꾸미')) return '🐙';
                                                            if (n.includes('새우') || n.includes('대하')) return '🦐';
                                                            if (n.includes('게') || n.includes('꽃게')) return '🦀';
                                                            if (n.includes('조개') || n.includes('굴')) return '🦪';
                                                            if (n.includes('고래') || n.includes('돌고래')) return '🐳';
                                                            if (n.includes('상어')) return '🦈';
                                                            if (n.includes('복어')) return '🐡';
                                                            if (n.includes('열대') || n.includes('니모')) return '🐠';
                                                            return '🐟'; // Default fish
                                                        };
                                                        return (
                                                            <div key={s.id} className="species-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                <div className="sp-icon" style={{
                                                                    width: '48px',
                                                                    height: '48px',
                                                                    borderRadius: '12px',
                                                                    background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '24px',
                                                                    marginBottom: '4px',
                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                                }}>
                                                                    {getFishIcon(s.name)}
                                                                </div>
                                                                <span className="sp-name" style={{ fontSize: '11px', fontWeight: '500', color: '#374151', textAlign: 'center' }}>{s.name}</span>
                                                            </div>
                                                        );
                                                    }) : <span className="no-data" style={{ gridColumn: '1 / -1', color: '#9CA3AF', fontSize: '13px' }}>정보 없음</span>}
                                                </div>

                                                {/* Recommended Baits (Text) */}
                                                <h5 style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 'bold' }}>🪱 추천 미끼</h5>
                                                <div className="bait-list-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {currentBaits.length > 0 ? currentBaits.map(b => (
                                                        <span key={b.id} className="bait-tag" style={{
                                                            background: '#ECFDF5',
                                                            color: '#059669',
                                                            padding: '4px 10px',
                                                            borderRadius: '16px',
                                                            fontSize: '13px',
                                                            fontWeight: '500',
                                                            border: '1px solid #D1FAE5'
                                                        }}>
                                                            {b.name}
                                                        </span>
                                                    )) : <span className="no-data" style={{ color: '#9CA3AF', fontSize: '13px' }}>추천 미끼 없음</span>}
                                                </div>
                                            </div>
                                        )}
                                        {/* Camping Gear & Recipes (Moved Here - below weather) */}
                                        {focusedPlace.type === 'CAMPING' && (
                                            <div className="detail-section" style={{ marginTop: '16px', marginBottom: '16px' }}>

                                                {/* Recommended Gear (Icons) */}
                                                <h5 style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 'bold' }}>🎒 추천 장비</h5>
                                                <div className="gear-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                                                    {recommendedGear.length > 0 ? recommendedGear.map((g) => {
                                                        const getGearIcon = (name: string) => {
                                                            const n = name.toLowerCase();
                                                            if (n.includes('침낭') || n.includes('매트')) return '🛏️';
                                                            if (n.includes('난로') || n.includes('히터')) return '🔥';
                                                            if (n.includes('버너') || n.includes('화로')) return '🍳';
                                                            if (n.includes('타프') || n.includes('텐트')) return '⛺';
                                                            if (n.includes('릴선') || n.includes('전기')) return '🔌';
                                                            if (n.includes('팩') || n.includes('펙')) return '🔩';
                                                            if (n.includes('커튼') || n.includes('암막')) return '🪟';
                                                            if (n.includes('스크린') || n.includes('바람')) return '🌬️';
                                                            return '🎒';
                                                        };
                                                        return (
                                                            <div key={g.id} className="gear-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                <div className="gear-icon" style={{
                                                                    width: '48px', height: '48px', borderRadius: '12px',
                                                                    background: g.isEssentialForWinter ? 'linear-gradient(135deg, #DBEAFE, #BFDBFE)' : 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '4px',
                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', position: 'relative'
                                                                }}>
                                                                    {getGearIcon(g.name)}
                                                                    {g.isEssentialForWinter && <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '12px' }}>❄️</span>}
                                                                </div>
                                                                <span style={{ fontSize: '10px', fontWeight: '500', color: '#374151', textAlign: 'center', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                                                            </div>
                                                        );
                                                    }) : <span style={{ gridColumn: '1 / -1', color: '#9CA3AF', fontSize: '13px' }}>추천 장비 없음</span>}
                                                </div>

                                                {/* Camping Recipes (Icons) */}
                                                <h5 style={{ marginBottom: '8px', fontSize: '15px', fontWeight: 'bold' }}>🍳 추천 요리</h5>
                                                <div className="recipe-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                    {campingRecipes.length > 0 ? campingRecipes.map((r) => {
                                                        const getRecipeIcon = (name: string) => {
                                                            const n = name.toLowerCase();
                                                            if (n.includes('닭') || n.includes('꼬치')) return '🍗';
                                                            if (n.includes('삼겹') || n.includes('고기')) return '🥩';
                                                            if (n.includes('라면') || n.includes('면')) return '🍜';
                                                            if (n.includes('밥') || n.includes('덮밥')) return '🍚';
                                                            if (n.includes('찌개') || n.includes('탕')) return '🍲';
                                                            if (n.includes('구이')) return '🔥';
                                                            if (n.includes('어묵')) return '🍢';
                                                            return '🍳';
                                                        };
                                                        return (
                                                            <div key={r.id} className="recipe-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                <div style={{
                                                                    width: '48px', height: '48px', borderRadius: '12px',
                                                                    background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '4px',
                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                                }}>
                                                                    {getRecipeIcon(r.name)}
                                                                </div>
                                                                <span style={{ fontSize: '10px', fontWeight: '500', color: '#374151', textAlign: 'center', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                                            </div>
                                                        );
                                                    }) : <span style={{ gridColumn: '1 / -1', color: '#9CA3AF', fontSize: '13px' }}>추천 요리 없음</span>}
                                                </div>
                                            </div>
                                        )}

                                        {/* Cleanup & Review Section */}
                                        <CleanupReviewSection placeId={String(focusedPlace.id)} />

                                        {/* Actions */}
                                        <div className="action-row" style={{ marginTop: '20px' }}>
                                            <button className="confirm-trip-btn" onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartRealNavigation(focusedPlace.name, { lat: focusedPlace.lat, lng: focusedPlace.lng });
                                            }}>
                                                🚗 길안내 시작
                                            </button>
                                            {focusedPlace.type === 'FISHING' && (
                                                <button className="confirm-trip-btn" style={{ background: '#F59E0B' }} onClick={async (e) => {
                                                    e.stopPropagation();
                                                    // Find Bait Shop Logic
                                                    const shops = await fetchBaitShops(focusedPlace.lat, focusedPlace.lng);
                                                    setNearbyShops(shops);
                                                    alert(`${shops.length}개의 낚시점을 찾았습니다.`);
                                                }}>
                                                    🎣 낚시점 찾기
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Dummy items for scroll test (Recent Search) - Only visible when expanded and no result */}
                        {isExpanded && !tripResult && !focusedPlace && (
                            <div className="recent-search-section" style={{ padding: '0 10px' }}>
                                <h4 style={{ margin: '20px 0 15px', color: 'rgba(255,255,255,0.7)', fontSize: '13px', letterSpacing: '1px' }}>RECENT SEARCH</h4>
                                <div className="recent-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: 'white' }}>
                                    <div className="recent-icon" style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>🕒</div>
                                    <div className="recent-info">
                                        <div className="recent-title" style={{ fontWeight: 'bold', fontSize: '15px' }}>을왕리 해수욕장</div>
                                        <div className="recent-sub" style={{ fontSize: '12px', opacity: 0.7 }}>인천 중구</div>
                                    </div>
                                </div>
                                <div className="recent-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: 'white' }}>
                                    <div className="recent-icon" style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>🕒</div>
                                    <div className="recent-info">
                                        <div className="recent-title" style={{ fontWeight: 'bold', fontSize: '15px' }}>가평 자라섬</div>
                                        <div className="recent-sub" style={{ fontSize: '12px', opacity: 0.7 }}>경기 가평군</div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Bottom Navigation */}
                    {/* <div className="bottom-nav-bar">
                        <div className={`nav-item ${!activeCategory || activeCategory === 'ALL' ? 'active' : ''}`}>
                            <span className="nav-icon">🗺️</span>
                            <span className="nav-label">Explore</span>
                        </div>
                        <div className="nav-item">
                            <span className="nav-icon">🔖</span>
                            <span className="nav-label">List</span>
                        </div>
                        <div className="nav-item">
                            <span className="nav-icon">🔔</span>
                            <span className="nav-label">Inbox</span>
                            <span className="badge">2</span>
                        </div>
                        <div className="nav-item">
                            <span className="nav-icon">👤</span>
                            <span className="nav-label">Me</span>
                        </div>
                    </div> */}
                </div>
            </div>
        </>
    );
};

export default RouteSearchPanel;
