import { useState, useRef, useEffect } from 'react';
import { getDrivingRoute, geocodeAddress, Coordinates } from '../services/naverMapService';
import { analyzeTripIntent, TripAnalysisResult } from '../services/tripAgentService';
import { fetchPlaces, Place } from '../data/places';
import { fetchFishSpecies, fetchBaits, fetchBaitShops, FishSpecies, Bait, BaitShop, getCurrentSeason } from '../services/fishingService';
import { fetchCampingDetails, fetchRecommendedGear, fetchCampingRecipes, fetchNearbyAmenities, CampingSpotDetail, CampingGear, CampingRecipe, CampAmenity } from '../services/campingService';
import { fetchWeather, fetchTide, WeatherData, TideData } from '../services/weatherService';

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
}

interface Waypoint {
    id: string;
    value: string;
}

const RouteSearchPanel = ({ map, activeCategory, onCategoryChange }: RouteSearchPanelProps) => {
    // Inputs (Keep existing)
    const [startLocation, setStartLocation] = useState('내 위치');
    const [goalLocation, setGoalLocation] = useState('');
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

    // Data State (Keep existing)
    const [places, setPlaces] = useState<Place[]>([]);

    // UI State
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // AI Trip State
    const [tripResult, setTripResult] = useState<TripAnalysisResult | null>(null);


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
                const species = await fetchFishSpecies(String(focusedPlace.id));
                setCurrentSpecies(species);

                // Fetch Baits for these species
                const speciesIds = species.map(s => s.id);
                const baits = await fetchBaits(speciesIds);
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
                    content: `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;font-size:18px;">
                                ${iconChar}
                              </div>`,
                    anchor: new naver.maps.Point(16, 16)
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
            }

            // 1. AI Analysis
            const analysis = await analyzeTripIntent(goalLocation, startLocation);
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
    const handleStartRealNavigation = async (finalDestination: string) => {
        setIsSearching(true);
        try {
            // 1. Resolve Start/Goal
            const startCoords = await resolveCoordinates(startLocation);
            const goalCoords = await resolveCoordinates(finalDestination);

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
            {/* --- NEW BOTTOM SHEET LAYOUT --- */}

            {/* 1. Bottom Fixed Search/Nav Container */}
            <div className={`bottom-sheet-container ${isExpanded ? 'active' : ''}`}>

                {/* Scroll Wrapper for Sheet Animation */}
                <div className="sheet-scroll-view" onClick={() => !isExpanded && setIsExpanded(true)}>

                    {/* Search Bar Floating - Moves UP when active */}
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
                                    placeholder={tripResult ? `[${tripResult.theme}] ${tripResult.destination}` : "어디로 떠나시나요?"}
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

                        {/* A. Popular Points (Horizontal Scroll) - Only show when NOT searching/planning yet */}
                        {!tripResult && !focusedPlace && (
                            <div className="popular-points-section">
                                <h3 className="section-title">🔥 요즘 뜨는 핫플레이스</h3>
                                <div className="horizontal-scroll-list">
                                    {POPULAR_POINTS.map(point => (
                                        <div key={point.id} className="point-card" onClick={(e) => { e.stopPropagation(); handleStartRealNavigation(point.name); }}>
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
                                                                <div className="check-label-group" style={{ marginLeft: '10px' }}>
                                                                    <span className="check-name">{item.item}</span>
                                                                    {/* @ts-ignore */}
                                                                    {item.reason && <span style={{ fontSize: '11px', color: '#999' }}>{item.reason}</span>}
                                                                </div>
                                                                {item.recommendedShops && item.recommendedShops.length > 0 && (
                                                                    <button style={{ padding: '4px', fontSize: '16px' }} onClick={(e) => { e.stopPropagation(); toggleChecklistExpand(item.item); }}>
                                                                        {expandedChecklistItems.has(item.item) ? '🔼' : '🔽'}
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Expanded Shop List */}
                                                            {expandedChecklistItems.has(item.item) && item.recommendedShops && (
                                                                <div className="shop-list-dropdown">
                                                                    {item.recommendedShops.map((shop, sIdx) => (
                                                                        <div key={sIdx} className={`shop-option ${selectedSpots.includes(shop.name) ? 'selected' : ''}`} onClick={(e) => { e.stopPropagation(); toggleSpotSelection(shop.name); }}>
                                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                <span className="shop-name-mini">{shop.name}</span>
                                                                                <span style={{ fontSize: '10px', color: '#999' }}>{shop.address}</span>
                                                                            </div>
                                                                            <span className="add-btn-mini">{selectedSpots.includes(shop.name) ? '포함됨' : '+ 경유'}</span>
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

                                {/* Spot Detail View (When clicked from map) */}
                                {focusedPlace && !tripResult && (
                                    <div className="ai-result-section">
                                        <div className="result-header">
                                            <span className="theme-badge" style={{ background: focusedPlace.type === 'FISHING' ? '#2563EB' : '#10B981' }}>
                                                {focusedPlace.type === 'FISHING' ? '낚시 포인트' : '캠핑장'}
                                            </span>
                                            <h4>{focusedPlace.name}</h4>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#666', margin: '5px 0' }}>{focusedPlace.address}</p>
                                        <p style={{ fontSize: '13px', color: '#444' }}>{focusedPlace.desc}</p>

                                        {/* Weather & Tide (If Fishing) */}
                                        {focusedPlace.type === 'FISHING' && (
                                            <div className="fishing-info-box">
                                                <div className="info-row">
                                                    <span className="info-icon">🌤️</span>
                                                    <span className="info-label">날씨:</span>
                                                    <span className="info-val">{currentWeather ? `${currentWeather.temp}°C, 풍속 ${currentWeather.windSpeed}m/s` : '로딩중...'}</span>
                                                </div>
                                                <div className="info-row">
                                                    <span className="info-icon">🌊</span>
                                                    <span className="info-label">물때:</span>
                                                    {/* @ts-ignore */}
                                                    <span className="info-val">{currentTide ? `물때: ${currentTide.score}` : '로딩중...'}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Camping Details */}
                                        {focusedPlace.type === 'CAMPING' && (
                                            <div className="camping-section">
                                                {/* Spot Details */}
                                                {campingDetails && (
                                                    <div className="spot-details" style={{ marginBottom: '20px', padding: '10px', background: '#ECFDF5', borderRadius: '8px', fontSize: '13px' }}>
                                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '4px' }}>
                                                            <span style={{ fontWeight: 'bold' }}>🏕️ {campingDetails.campType}</span>
                                                            <span>바닥: {campingDetails.floorType}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                            {campingDetails.facilities.electricity && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: '4px' }}>⚡ 전기</span>}
                                                            {campingDetails.facilities.hotWater && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: '4px' }}>💧 온수</span>}
                                                            {campingDetails.facilities.wifi && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: '4px' }}>📶 WiFi</span>}
                                                            {campingDetails.facilities.petFriendly && <span style={{ background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: '4px' }}>🐶 반려동물</span>}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="gear-section">
                                                    <h3>⛺ 필수/추천 장비</h3>
                                                    {recommendedGear.length > 0 ? recommendedGear.map(gear => (
                                                        <div key={gear.id} className="gear-item">
                                                            <span className="gear-icon">{gear.category === 'SLEEPING' ? '🛌' : gear.category === 'KITCHEN' ? '🍳' : '🔨'}</span>
                                                            <div className="gear-info">
                                                                <span className="gear-name">{gear.name}</span>
                                                                <span className="gear-reason">{gear.reason}</span>
                                                            </div>
                                                        </div>
                                                    )) : <p style={{ fontSize: '12px', color: '#999' }}>추천 장비 정보가 없습니다.</p>}
                                                </div>

                                                <div className="recipe-section" style={{ marginTop: '15px' }}>
                                                    <h3>🍳 추천 캠핑 요리</h3>
                                                    <div className="recipe-list">
                                                        {campingRecipes.length > 0 ? campingRecipes.map(recipe => (
                                                            <div key={recipe.id} className="recipe-card">
                                                                <div className="recipe-header">
                                                                    <span className="recipe-name">{recipe.name}</span>
                                                                    {/* @ts-ignore */}
                                                                    <span className="recipe-diff">{'⭐'.repeat(recipe.difficulty)}</span>
                                                                </div>
                                                                {/* @ts-ignore */}
                                                                <p className="recipe-method">{recipe.method || recipe.cookingMethod}</p>
                                                            </div>
                                                        )) : <p style={{ fontSize: '12px', color: '#999' }}>추천 요리 정보가 없습니다.</p>}
                                                    </div>
                                                </div>

                                                <button className="confirm-trip-btn" style={{ marginTop: '15px', background: '#10B981' }} onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const amenities = await fetchNearbyAmenities(focusedPlace.lat, focusedPlace.lng);
                                                    setNearbyAmenities(amenities);
                                                    alert(`${amenities.length}개의 편의시설을 찾았습니다.\n지도를 확대하여 확인하세요.`);
                                                    if (amenities.length > 0) {
                                                        (map as any).panTo(new naver.maps.LatLng(amenities[0].lat, amenities[0].lng));
                                                    }
                                                }}>
                                                    🏪 근처 편의시설 찾기
                                                </button>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                            <button className="confirm-trip-btn" onClick={(e) => { e.stopPropagation(); handleStartRealNavigation(focusedPlace.name); }}>
                                                🚗 출발지로 설정
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
                    </div>
                </div>

                {/* Bottom Navigation */}
                <div className="bottom-nav-bar">
                    <div className="nav-item active">
                        <span className="nav-icon">🗺️</span>
                        <span className="nav-label">Explore</span>
                    </div>
                    <div className="nav-item">
                        <span className="nav-icon">📋</span>
                        <span className="nav-label">List</span>
                    </div>
                    <div className="nav-item">
                        <span className="nav-icon">📨</span>
                        <span className="nav-label">Inbox</span>
                        <span className="nav-badge">2</span>
                    </div>
                    <div className="nav-item">
                        <span className="nav-icon">👤</span>
                        <span className="nav-label">Me</span>
                    </div>
                </div>

            </div>
        </>
    );
};

export default RouteSearchPanel;
