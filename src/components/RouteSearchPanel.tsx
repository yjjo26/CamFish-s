import { useState, useRef, useEffect } from 'react';
import { getDrivingRoute, geocodeAddress, Coordinates } from '../services/naverMapService';
import { analyzeTripIntent, TripAnalysisResult, searchPlacesWithGemini, searchPlacesByKeywords } from '../services/tripAgentService';
import { supabase } from '../lib/supabase';
import { Place } from '../data/places';
import { fetchVerifiedSpots } from '../services/fishingService';
import { fetchVectorSpots } from '../services/vectorSpotService';
import { fetchSpots, fetchSpotDetail } from '../services/spotService'; // [NEW] Spot Service
import { Spot } from '../types/database.types';
import SpotBottomSheet from './SpotBottomSheet';
// import CleanupReviewSection from './CleanupReviewSection';

// @ts-ignore
import MarkerClustering from '../lib/MarkerClustering';
import './RouteSearchPanel.css';

const POPULAR_POINTS = [
    { id: 'p1', name: '을왕리 선녀바위', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&h=200&fit=crop', desc: '서울 근교 국민 포인트', lat: 37.4475, lng: 126.3727 },
    { id: 'p2', name: '궁평항 피싱피어', image: 'https://images.unsplash.com/photo-1516939884455-1445c8652f83?w=200&h=200&fit=crop', desc: '가족 낚시 추천', lat: 37.1158, lng: 126.6961 },
    { id: 'p3', name: '시화방조제', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=200&fit=crop', desc: '우럭/광어 손맛', lat: 37.3101, lng: 126.6027 },
    { id: 'p4', name: '가평 자라섬', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&h=200&fit=crop', desc: '캠핑 페스티벌', lat: 37.8188, lng: 127.5255 },
    { id: 'p5', name: '몽산포 캠핑장', image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=200&h=200&fit=crop', desc: '갯벌 체험 가능한 곳', lat: 36.6713, lng: 126.2844 }
];

interface RouteSearchPanelProps {
    map: naver.maps.Map | null;
    activeCategory: 'ALL' | 'NONE' | 'FISHING' | 'CAMPING' | 'CLEANUP';
    onCategoryChange: (category: 'ALL' | 'NONE' | 'FISHING' | 'CAMPING' | 'CLEANUP') => void;
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
    const [startLocation, _setStartLocation] = useState('내 위치');
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




    const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
    const [focusedPlace, setFocusedPlace] = useState<Place | null>(null);
    const [top5Spots, setTop5Spots] = useState<Place[]>([]); // [NEW] Top 5 Search Results
    const [clusterSelectedPlaces, setClusterSelectedPlaces] = useState<Place[]>([]); // [NEW] Stores spots for Cluster Click List
    // const [selectedChecklistItems, setSelectedChecklistItems] = useState<Set<string>>(new Set());
    // const [expandedChecklistItems, setExpandedChecklistItems] = useState<Set<string>>(new Set());

    // Panel Expansion State
    const [spotDetailRaw, setSpotDetailRaw] = useState<any>(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);

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

    const [_routeSummary, setRouteSummary] = useState<{ distance: number; duration: number } | null>(null);

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
            // [NEW] Fetch from lightweight 'spots' table
            const spots = await fetchSpots();

            const mappedSpots: Place[] = spots
                .filter(s => s.lat !== 0 && s.lng !== 0) // [NEW] 지도의 0,0 오류 방지
                .map(s => ({
                    id: s.id,
                    name: s.name,
                    type: s.spot_type, // 'CAMPING' | 'FISHING'
                    address: '주소 정보 없음', // 'spots' table doesn't have address, detail has it? or maybe we need geocoding if crucial
                    lat: s.lat,
                    lng: s.lng,
                    desc: '',
                    image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200'
                }));

            // [NEW] Ambient Vector Spots (Near default/current location)
            // Ideally we should wait for actual location, but for now fetch near Seoul or wait for map
            // We can leave this static fetch, and let map idle event trigger more
            setPlaces(mappedSpots);
        };
        loadPlaces();
    }, []);

    // [NEW] Fetch Vector Spots on Map Idle
    useEffect(() => {
        if (!map) return;

        let timeoutId: NodeJS.Timeout;
        const handleIdle = async () => {
            const center = (map as any).getCenter();
            // Fetch nearby vector spots (no query)
            const vSpots = await fetchVectorSpots(center.lat(), center.lng(), 10000);

            if (vSpots.length > 0) {
                const newFromVector = vSpots.map(p => ({
                    id: p.id,
                    name: p.name,
                    type: (p.metadata?.type as 'FISHING' | 'CAMPING') || 'FISHING',
                    address: p.metadata?.address || '주소 정보 없음',
                    lat: p.lat,
                    lng: p.lng,
                    description: p.metadata?.description,
                    image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200'
                })) as Place[];

                setPlaces(prev => {
                    // Costly dedup on every move? 
                    // Optimization: Check if we have enough spots or just add unique IDs
                    const all = [...prev, ...newFromVector];
                    return all.filter((v, i, a) => a.findIndex(v2 => v.id === v2.id) === i);
                });
            }
        };

        const listener = naver.maps.Event.addListener(map, 'idle', () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(handleIdle, 1000); // 1s debounce
        });

        // Initial call
        handleIdle();

        return () => {
            (naver.maps.Event as any).removeListener(listener);
            clearTimeout(timeoutId);
        };
    }, [map]);


    // Effect: Fetch Detail Data when focusedPlace changes
    useEffect(() => {
        if (!focusedPlace) {
            // Reset Detail State
            setSpotDetailRaw(null);
            return;
        }

        const loadDetailData = async () => {
            // [NEW] Fetch Detail from 'spot_details' table
            setIsDetailLoading(true);
            try {
                const detail = await fetchSpotDetail(focusedPlace.id, focusedPlace.name);
                setSpotDetailRaw(detail); // Save raw detail for Bottom Sheet

                if (!detail) {
                    console.log("No detail data found for spot:", focusedPlace.id);
                }
            } finally {
                setIsDetailLoading(false);
            }
        };

        loadDetailData();
    }, [focusedPlace]);

    // Handle Category Toggles with Clustering & Highlight Mode
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

        // 2. Filter Places (Always keep all markers of active category)
        const placesToShow = activeCategory === 'ALL'
            ? places
            : places.filter(p => p.type === activeCategory);

        // 3. Create Markers
        const newMarkers = placesToShow.map(place => {
            const isFishing = place.type === 'FISHING';
            const isTop5 = top5Spots.some(top => top.id === place.id);

            // Modern Premium Glassmorphism Style
            const size = isTop5 ? 60 : 44;
            const iconSize = isTop5 ? 28 : 20;
            const bgColorBase = isTop5
                ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.95), rgba(234, 88, 12, 0.85))'
                : (isFishing ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.95), rgba(8, 145, 178, 0.85))' : 'linear-gradient(135deg, rgba(52, 211, 153, 0.95), rgba(5, 150, 105, 0.85))');
            const shadowGlow = isTop5
                ? 'rgba(234, 88, 12, 0.6)'
                : (isFishing ? 'rgba(8, 145, 178, 0.6)' : 'rgba(5, 150, 105, 0.6)');
            const iconName = isFishing ? 'Phishing' : 'Camping';
            const animationClass = isTop5 ? 'marker-bounce marker-pulse-glow' : 'marker-hover-lift';

            const markerHtml = `
                <div class="${animationClass}" style="
                    background: ${bgColorBase};
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    width: ${size}px; height: ${size}px;
                    border-radius: 50%;
                    border: 1.5px solid rgba(255,255,255,0.7);
                    box-shadow: inset 0 2px 4px auto rgba(255,255,255,0.4), 0 8px 16px rgba(0,0,0,0.4), 0 0 20px ${shadowGlow};
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: white;
                    position: relative;
                    z-index: ${isTop5 ? 10 : 1};
                    cursor: pointer;
                    transform-origin: bottom center;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                ">
                    <span class="material-symbols-outlined" style="font-size: ${iconSize}px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); font-weight: 500;">${iconName}</span>
                    <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 6px; height: 6px; background: white; border-radius: 50%; box-shadow: 0 0 10px white;"></div>
                    <div style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%) rotateX(60deg); width: ${size * 0.8}px; height: 10px; background: radial-gradient(ellipse at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; z-index:-1;"></div>
                    
                    ${isTop5 ? `
                        <div style="position:absolute; top:-12px; right:-12px; background: linear-gradient(135deg, #ef4444, #b91c1c); padding:2px 8px; border-radius:12px; font-size:10px; font-weight:900; color:white; white-space:nowrap; border:1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 8px rgba(239,68,68,0.5); text-transform:uppercase; letter-spacing: 0.5px;">Top</div>
                    ` : ''}
                </div>
            `;

            const marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(place.lat, place.lng),
                title: place.name,
                zIndex: isTop5 ? 9999 : 100,
                icon: {
                    content: markerHtml,
                    anchor: new naver.maps.Point(size / 2, size / 2)
                }
            });

            // Pass place data so clusterer can read it
            (marker as any).placeData = place;

            naver.maps.Event.addListener(marker, 'click', () => {
                setFocusedPlace(place);
                setIsExpanded(false); // Close the side panel if it was open
                setIsBottomSheetVisible(true); // Open the modern Bottom Sheet
                (map as any).panTo(new naver.maps.LatLng(place.lat, place.lng));
            });

            return marker;
        });

        // 4. Initialize MarkerClustering
        if (newMarkers.length > 0) {
            const clusterColor = activeCategory === 'CAMPING' ? 'rgba(52,211,153,0.9)' : activeCategory === 'FISHING' ? 'rgba(34,211,238,0.9)' : 'rgba(99,102,241,0.9)';
            const clusterShadow = activeCategory === 'CAMPING' ? 'rgba(52,211,153,0.5)' : activeCategory === 'FISHING' ? 'rgba(34,211,238,0.5)' : 'rgba(99,102,241,0.5)';
            try {
                const clusterer = new (MarkerClustering as any)({
                    minClusterSize: 2,
                    maxZoom: 13,
                    map: map,
                    markers: newMarkers,
                    disableClickZoom: true,
                    onClusterClick: (clusterMarkers: any[]) => {
                        const placesInCluster = clusterMarkers.map(m => m.placeData).filter(Boolean);
                        setClusterSelectedPlaces(placesInCluster);
                        setIsExpanded(false); // Close other search panels
                    },
                    gridSize: 120,
                    icons: [
                        { // Size 1 (Small Cluster)
                            content: `
                                <div class="cluster-marker" style="
                                    cursor:pointer; width:52px; height:52px;
                                    display:flex; justify-content:center; align-items:center;
                                    font-size:16px; color:white; font-weight:800;
                                    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 60%), ${clusterColor};
                                    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                                    border-radius: 50%;
                                    border: 1.5px solid rgba(255,255,255,0.8);
                                    box-shadow: inset -4px -4px 10px rgba(0,0,0,0.3), inset 4px 4px 10px rgba(255,255,255,0.5), 0 8px 16px rgba(0,0,0,0.4), 0 0 20px ${clusterShadow};
                                    z-index:9999;
                                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                                ">\${count}</div>`,
                            size: new (naver.maps as any).Size(52, 52),
                            anchor: new (naver.maps as any).Point(26, 26)
                        },
                        { // Size 2 (Medium Cluster)
                            content: `
                                <div class="cluster-marker" style="
                                    cursor:pointer; width:64px; height:64px;
                                    display:flex; justify-content:center; align-items:center;
                                    font-size:18px; color:white; font-weight:900;
                                    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 60%), ${clusterColor};
                                    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
                                    border-radius: 50%;
                                    border: 2px solid rgba(255,255,255,0.85);
                                    box-shadow: inset -5px -5px 12px rgba(0,0,0,0.3), inset 5px 5px 12px rgba(255,255,255,0.5), 0 10px 20px rgba(0,0,0,0.5), 0 0 30px ${clusterShadow};
                                    z-index:9999;
                                    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                                ">\${count}</div>`,
                            size: new (naver.maps as any).Size(64, 64),
                            anchor: new (naver.maps as any).Point(32, 32)
                        },
                        { // Size 3 (Large Cluster)
                            content: `
                                <div class="cluster-marker" style="
                                    cursor:pointer; width:76px; height:76px;
                                    display:flex; justify-content:center; align-items:center;
                                    font-size:22px; color:white; font-weight:900;
                                    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent 60%), ${clusterColor};
                                    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
                                    border-radius: 50%;
                                    border: 2.5px solid rgba(255,255,255,0.9);
                                    box-shadow: inset -6px -6px 15px rgba(0,0,0,0.4), inset 6px 6px 15px rgba(255,255,255,0.6), 0 12px 24px rgba(0,0,0,0.6), 0 0 40px ${clusterShadow};
                                    z-index:9999;
                                    text-shadow: 0 2px 4px rgba(0,0,0,0.6);
                                ">\${count}</div>`,
                            size: new (naver.maps as any).Size(76, 76),
                            anchor: new (naver.maps as any).Point(38, 38)
                        }
                    ]
                });
                mapObjectsRef.current.clusterer = clusterer;
            } catch (err) {
                console.error("MarkerClustering initialization failed:", err);
            }
        }

    }, [activeCategory, map, places, focusedPlace]);

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
        setClusterSelectedPlaces([]);
        // setSelectedChecklistItems(new Set()); // Reset checklist
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

                // [NEW] Direct Supabase Query for Partial Matches (Spots table)
                const { data: dbMatches } = await supabase
                    .from('spots')
                    .select('*')
                    .ilike('name', `%${goalLocation}%`)
                    .limit(5);

                let mergedPlaces = [...places];

                if (dbMatches && dbMatches.length > 0) {
                    console.log(`[Supabase] Found ${dbMatches.length} matches from DB`);
                    // Merge DB results
                    const newFromDB = dbMatches.map(p => ({
                        id: p.id,
                        name: p.name,
                        type: p.spot_type,
                        address: '',
                        lat: p.lat,
                        lng: p.lng,
                        description: '',
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

                // [NEW] Vector Search (Natural Language)
                try {
                    console.log(`[Vector Search] Querying: ${goalLocation}`);
                    const center = map ? (map as any).getCenter() : null;
                    const lat = center ? center.lat() : 37.5665;
                    const lng = center ? center.lng() : 126.9780;

                    const vectorSpots = await fetchVectorSpots(lat, lng, 20000, goalLocation); // 20km radius

                    // Merge Vector Results
                    const newFromVector = vectorSpots.map(p => ({
                        id: p.id,
                        name: p.name,
                        type: (p.metadata?.type as 'FISHING' | 'CAMPING') || 'FISHING', // Default to FISHING if unknown
                        address: p.metadata?.address || '주소 정보 없음',
                        lat: p.lat,
                        lng: p.lng,
                        description: p.metadata?.description || `Vector Search Result (Dist: ${p.distance_meters?.toFixed(0)}m)`,
                        image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200'
                    })) as Place[];

                    if (newFromVector.length > 0) {
                        console.log(`[Vector Search] Found ${newFromVector.length} spots`);
                        setPlaces(prev => {
                            const all = [...prev, ...newFromVector];
                            return all.filter((v, i, a) => a.findIndex(v2 => v.id === v2.id || v.name === v2.name) === i);
                        });
                    }
                } catch (err) {
                    console.error("Vector search failed:", err);
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

                            // Mocking the saved object for the current session avoiding DB insert errors since 'places' is deprecated
                            const saved = {
                                id: crypto.randomUUID(),
                                name: aiPlace.name,
                                type: aiPlace.type,
                                address: aiPlace.address,
                                description: aiPlace.description
                            };

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
                const spotNames = Array.from(initialSet);
                setSelectedSpots(spotNames);

                // [NEW] Calculate Top 5 spots for highlighting
                // We find the full Place objects matching the names in selectedSpots
                // Use a functional state update to ensure we have the latest 'places'
                setPlaces(currentPlaces => {
                    const matchedPlaces = spotNames.map(name => currentPlaces.find(p => p.name === name)).filter(Boolean) as Place[];
                    const top5 = matchedPlaces.slice(0, 5);
                    setTop5Spots(top5);

                    // [NEW] Smooth Map Zoom & Pan to bounds of Top 5
                    if (top5.length > 0 && map) {
                        const bounds = new naver.maps.LatLngBounds(
                            new naver.maps.LatLng(top5[0].lat, top5[0].lng),
                            new naver.maps.LatLng(top5[0].lat, top5[0].lng)
                        );
                        top5.forEach(spot => {
                            bounds.extend(new naver.maps.LatLng(spot.lat, spot.lng));
                        });
                        // Expand bounds slightly for padding
                        (map as any).panToBounds(bounds, { duration: 800, margin: 50 });
                    }
                    return currentPlaces;
                });
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
    // const handleConfirmTrip = async () => {
    //     if (!tripResult) return;
    //     await handleStartRealNavigation(tripResult.destination);
    // };

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

            // Start (Premium Green/Teal Glass)
            objs.startMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(startCoords.lat, startCoords.lng),
                map: map!,
                title: '출발: ' + startLocation,
                icon: {
                    content: `
                        <div style="position:relative; width:48px; height:60px; display:flex; flex-direction:column; align-items:center;">
                            <div style="width:36px; height:36px; background:linear-gradient(135deg, rgba(16,185,129,0.95), rgba(4,120,87,0.85)); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border-radius:50%; border:2px solid rgba(255,255,255,0.9); box-shadow:inset 0 2px 4px rgba(255,255,255,0.5), 0 8px 16px rgba(0,0,0,0.5), 0 0 20px rgba(16,185,129,0.6); display:flex; justify-content:center; align-items:center; z-index:2; position:relative;">
                                <span class="material-symbols-outlined" style="color:white; font-size:20px; font-weight:bold; text-shadow:0 1px 2px rgba(0,0,0,0.5);">home_pin</span>
                                <div style="position:absolute; top:-6px; right:-20px; background:rgba(255,255,255,0.95); color:#047857; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:900; box-shadow:0 4px 8px rgba(0,0,0,0.3); border:1px solid rgba(16,185,129,0.5);">Start</div>
                            </div>
                            <!-- Pin Base/Triangle -->
                            <div style="width:0; height:0; border-left:10px solid transparent; border-right:10px solid transparent; border-top:16px solid rgba(4,120,87,0.85); margin-top:-6px; z-index:1; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.5));"></div>
                        </div>
                    `,
                    anchor: new naver.maps.Point(24, 60)
                }
            });

            // Goal (Premium Red/Purple Glass with icon)
            const isFishingParams = tripResult?.theme === 'FISHING';
            const goalGradient = isFishingParams ? 'linear-gradient(135deg, rgba(56,189,248,0.95), rgba(3,105,161,0.85))' : 'linear-gradient(135deg, rgba(244,63,94,0.95), rgba(190,18,60,0.85))';
            const goalShadow = isFishingParams ? 'rgba(56,189,248,0.7)' : 'rgba(244,63,94,0.7)';
            const goalIconName = isFishingParams ? 'Phishing' : 'flag';

            objs.goalMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(goalCoords.lat, goalCoords.lng),
                map: map!,
                title: '도착: ' + finalDestination,
                icon: {
                    content: `
                        <div style="position:relative; width:56px; height:70px; display:flex; flex-direction:column; align-items:center; animation: markerPulseGlow 2s infinite ease-in-out;">
                            <div style="width:44px; height:44px; background:${goalGradient}; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-radius:50%; border:2.5px solid rgba(255,255,255,0.95); box-shadow:inset 0 2px 5px rgba(255,255,255,0.6), 0 10px 20px rgba(0,0,0,0.6), 0 0 25px ${goalShadow}; display:flex; justify-content:center; align-items:center; z-index:2; position:relative;">
                                <span class="material-symbols-outlined" style="color:white; font-size:24px; font-weight:bold; text-shadow:0 2px 4px rgba(0,0,0,0.5);">${goalIconName}</span>
                                <div style="position:absolute; top:-8px; right:-24px; background:linear-gradient(135deg, #1e293b, #0f172a); color:#e2e8f0; padding:4px 10px; border-radius:12px; font-size:11px; font-weight:900; box-shadow:0 4px 10px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); letter-spacing:0.5px;">Goal</div>
                            </div>
                            <!-- Pin Base/Triangle -->
                            <div style="width:0; height:0; border-left:14px solid transparent; border-right:14px solid transparent; border-top:22px solid ${isFishingParams ? 'rgba(3,105,161,0.85)' : 'rgba(190,18,60,0.85)'}; margin-top:-8px; z-index:1; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));"></div>
                            <!-- Ground Shadow -->
                            <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) rotateX(60deg); width: 30px; height: 8px; background: radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; z-index:-1;"></div>
                        </div>
                    `,
                    anchor: new naver.maps.Point(28, 70)
                }
            });

            // Waypoints (Premium Amber Glass)
            objs.waypointMarkers = allWaypointCoords.map((coord, idx) => {
                return new naver.maps.Marker({
                    position: new naver.maps.LatLng(coord.lat, coord.lng),
                    map: map!,
                    title: `경유지 ${idx + 1}`,
                    icon: {
                        content: `
                            <div style="position:relative; width:36px; height:48px; display:flex; flex-direction:column; align-items:center; transform-origin:bottom center; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1) translateY(-4px)'" onmouseout="this.style.transform='scale(1) translateY(0)'">
                                <div style="width:28px; height:28px; background:linear-gradient(135deg, rgba(245,158,11,0.95), rgba(180,83,9,0.85)); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border-radius:50%; border:1.5px solid rgba(255,255,255,0.8); box-shadow:inset 0 2px 4px rgba(255,255,255,0.4), 0 6px 12px rgba(0,0,0,0.4), 0 0 15px rgba(245,158,11,0.5); display:flex; justify-content:center; align-items:center; z-index:2;">
                                    <span style="color:white; font-size:14px; font-weight:900; text-shadow:0 1px 2px rgba(0,0,0,0.4);">${idx + 1}</span>
                                </div>
                                <!-- Pin Base/Triangle -->
                                <div style="width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-top:14px solid rgba(180,83,9,0.85); margin-top:-4px; z-index:1; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));"></div>
                            </div>
                        `,
                        anchor: new naver.maps.Point(18, 48)
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

    // @ts-ignore
    const _handleAddWaypoint = () => {
        if (waypoints.length >= 3) {
            alert("수동 경유지는 최대 3개까지만 가능합니다.");
            return;
        }
        setWaypoints([...waypoints, { id: crypto.randomUUID(), value: '' }]);
    };

    // @ts-ignore
    const _handleRemoveWaypoint = (id: string) => {
        setWaypoints(waypoints.filter(wp => wp.id !== id));
    };

    // @ts-ignore
    const _handleWaypointChange = (id: string, newVal: string) => {
        setWaypoints(waypoints.map(wp => wp.id === id ? { ...wp, value: newVal } : wp));
    };

    // @ts-ignore
    const _toggleSpotSelection = (spotName: string) => {
        if (selectedSpots.includes(spotName)) {
            setSelectedSpots(selectedSpots.filter(s => s !== spotName));
        } else {
            setSelectedSpots([...selectedSpots, spotName]);
        }
    };

    // @ts-ignore
    const _moveSpot = (index: number, direction: 'UP' | 'DOWN') => {
        if ((direction === 'UP' && index === 0) || (direction === 'DOWN' && index === selectedSpots.length - 1)) return;

        const newSpots = [...selectedSpots];
        const targetIndex = direction === 'UP' ? index - 1 : index + 1;
        const temp = newSpots[index];
        newSpots[index] = newSpots[targetIndex];
        newSpots[targetIndex] = temp;
        setSelectedSpots(newSpots);
    };

    // const toggleChecklistItem = (item: string) => {
    //     const newSet = new Set(selectedChecklistItems);
    //     if (newSet.has(item)) {
    //         newSet.delete(item);
    //     } else {
    //         newSet.add(item);
    //     }
    //     setSelectedChecklistItems(newSet);
    // };

    // @ts-ignore
    // const _toggleChecklistExpand = (item: string) => {
    //     const newSet = new Set(expandedChecklistItems);
    //     if (newSet.has(item)) { newSet.delete(item); }
    //     else { newSet.add(item); }
    //     setExpandedChecklistItems(newSet);
    // };

    // @ts-ignore
    const _formatDistance = (meters: number) => {
        if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
        return `${meters}m`;
    };

    // @ts-ignore
    const _formatDuration = (ms: number) => {
        const mins = Math.round(ms / 60000);
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            return `${hours}시간 ${mins % 60}분`;
        }
        return `${mins}분`;
    };

    return (
        <>
            {/* Inject Global Styles for Modern Markers */}
            <style>{`
                @keyframes markerPulseGlow {
                    0% { box-shadow: inset 0 2px 4px auto rgba(255,255,255,0.4), 0 8px 16px rgba(0,0,0,0.4), 0 0 20px rgba(234, 88, 12, 0.6); transform: scale(1); }
                    50% { box-shadow: inset 0 2px 4px auto rgba(255,255,255,0.6), 0 12px 24px rgba(0,0,0,0.5), 0 0 40px rgba(251, 146, 60, 0.9); transform: scale(1.05); }
                    100% { box-shadow: inset 0 2px 4px auto rgba(255,255,255,0.4), 0 8px 16px rgba(0,0,0,0.4), 0 0 20px rgba(234, 88, 12, 0.6); transform: scale(1); }
                }
                .marker-pulse-glow {
                    animation: markerPulseGlow 2.5s infinite ease-in-out;
                }
                .marker-hover-lift:hover {
                    transform: translateY(-8px) scale(1.1) !important;
                    z-index: 1000 !important;
                }
                @keyframes clusterPulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.5); }
                    70% { box-shadow: 0 0 0 25px rgba(255, 255, 255, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
                }
            `}</style>
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
                                            // Use predefined coordinates to bypass geocoding
                                            handleStartRealNavigation(point.name, { lat: point.lat, lng: point.lng });
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

                                        {/* Action Buttons & Top 5 Carousel */}
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                                            <button className="confirm-trip-btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.2)' }} onClick={(e) => { e.stopPropagation(); setTripResult(null); setFocusedPlace(null); setTop5Spots([]); setRouteSummary(null); }}>
                                                검색 초기화
                                            </button>
                                        </div>

                                        {/* Top 5 Carousel */}
                                        {top5Spots.length > 0 && (
                                            <div className="top5-carousel-section">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                    <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: '16px' }}>Target</span>
                                                    <h5 style={{ margin: 0, color: '#1e293b', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Top 5 매칭 스팟</h5>
                                                </div>
                                                <div className="top5-carousel-container custom-scrollbar" style={{
                                                    display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '12px', scrollSnapType: 'x mandatory'
                                                }}>
                                                    {top5Spots.map((spot, idx) => (
                                                        <div key={spot.id} onClick={(e) => {
                                                            e.stopPropagation();
                                                            setFocusedPlace(spot);
                                                            setIsExpanded(false);
                                                            setIsBottomSheetVisible(true);
                                                            if (map) (map as any).panTo(new naver.maps.LatLng(spot.lat, spot.lng));
                                                        }} className="top5-card" style={{
                                                            scrollSnapAlign: 'start', minWidth: '220px', background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px',
                                                            cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px',
                                                            boxShadow: '0 4px 15px rgba(0,0,0,0.2)', transition: 'background 0.2s, transform 0.2s'
                                                        }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', background: '#F59E0B', color: '#fff' }}>{idx + 1}</div>
                                                                    <span style={{ color: '#1e293b', fontWeight: 700, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{spot.name}</span>
                                                                </div>
                                                                <span style={{ color: '#d97706', fontWeight: 900, fontSize: '13px' }}>{100 - (idx * 5)}%</span>
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginTop: '4px' }}>
                                                                {spot.desc || spot.address || 'AI 추천 장소'}
                                                            </div>
                                                            <div style={{ marginTop: '8px', color: '#0284c7', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                상세 정보 보기 <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Recent Search Block - only when nothing else is shown and search is focused */}
                        {isExpanded && !tripResult && !focusedPlace && (
                            <div className="recent-search-section" style={{ padding: '0 10px' }}>
                                <h4 style={{ margin: '20px 0 15px', color: '#94a3b8', fontSize: '13px', letterSpacing: '1px', fontWeight: '700' }}>RECENT SEARCH</h4>
                                <div className="recent-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: 'black' }}>
                                    <div className="recent-icon" style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>🕒</div>
                                    <div className="recent-info">
                                        <div className="recent-title" style={{ fontWeight: 'bold', fontSize: '15px' }}>을왕리 해수욕장</div>
                                        <div className="recent-sub" style={{ fontSize: '12px', opacity: 0.7 }}>인천 중구</div>
                                    </div>
                                </div>
                                <div className="recent-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', color: 'black' }}>
                                    <div className="recent-icon" style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>🕒</div>
                                    <div className="recent-info">
                                        <div className="recent-title" style={{ fontWeight: 'bold', fontSize: '15px' }}>가평 자라섬</div>
                                        <div className="recent-sub" style={{ fontSize: '12px', opacity: 0.7 }}>경기 가평군</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>{/* End of bottom-sheet-content */}
                </div>{/* End of sheet-content-wrapper */}
            </div>{/* End of bottom-sheet-container */}

            {/* Spot Bottom Sheet Modal */}
            <SpotBottomSheet
                spotName={focusedPlace?.name || 'Spot Detail'}
                spotDetail={spotDetailRaw}
                isLoading={isDetailLoading}
                isVisible={isBottomSheetVisible}
                onClose={() => setIsBottomSheetVisible(false)}
            />

            {/* Cluster List Bottom Sheet */}
            {clusterSelectedPlaces.length > 0 && (
                <div className="cluster-list-sheet" style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100,
                    background: 'rgba(255, 255, 255, 0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                    borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
                    padding: '16px 20px', color: '#1e293b', maxHeight: '65vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 -8px 32px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(255,255,255,0.6)'
                }}>
                    <div style={{ width: '40px', height: '4px', background: 'rgba(0,0,0,0.12)', borderRadius: '2px', margin: '0 auto 16px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>클러스터 목록 ({clusterSelectedPlaces.length})</h3>
                        <button onClick={() => setClusterSelectedPlaces([])} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {clusterSelectedPlaces.map((spot, idx) => (
                            <div key={idx}
                                onClick={() => {
                                    setFocusedPlace(spot);
                                    setClusterSelectedPlaces([]);
                                    setIsBottomSheetVisible(true);
                                    (map as any)?.panTo(new naver.maps.LatLng(spot.lat, spot.lng));
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', padding: '16px',
                                    background: 'rgba(255,255,255,0.6)', borderRadius: '16px',
                                    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.8)',
                                    transition: 'background 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.9)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.6)'}
                            >
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: spot.type === 'FISHING' ? 'rgba(2,132,199,0.08)' : 'rgba(5,150,105,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginRight: '16px', border: `1px solid ${spot.type === 'FISHING' ? 'rgba(2,132,199,0.2)' : 'rgba(5,150,105,0.2)'}`
                                }}>
                                    <span className="material-symbols-outlined" style={{
                                        color: spot.type === 'FISHING' ? '#0284c7' : '#059669', fontSize: '20px'
                                    }}>
                                        {spot.type === 'FISHING' ? 'phishing' : 'camping'}
                                    </span>
                                </div>
                                <span style={{ fontSize: '16px', fontWeight: 500, letterSpacing: '-0.3px', color: '#1e293b' }}>{spot.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default RouteSearchPanel;
