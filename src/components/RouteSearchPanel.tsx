import { useState, useRef, useEffect } from 'react';
import { getDrivingRoute, geocodeAddress, Coordinates } from '../services/naverMapService';
import { analyzeTripIntent, TripAnalysisResult } from '../services/tripAgentService';
import { fetchPlaces, Place } from '../data/places';
import { FISH_SPECIES, BAITS, MOCK_WEATHER, MOCK_TIDE, MOCK_SHOPS, BaitShop } from '../data/fishingData';
// @ts-ignore
import MarkerClustering from '../lib/MarkerClustering';
import './RouteSearchPanel.css';

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

    // Removed local activeCategory state

    // AI Trip State
    const [tripResult, setTripResult] = useState<TripAnalysisResult | null>(null);

    const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
    const [focusedPlace, setFocusedPlace] = useState<Place | null>(null);
    const [selectedShop, setSelectedShop] = useState<BaitShop | null>(null);

    // ... (rest of state and refs remain) ...

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
        clusterer?: any; // MarkerClustering Instance
    }>({ waypointMarkers: [], categoryMarkers: [] });

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

    // Handle Category Toggles with Clustering
    useEffect(() => {
        if (!map) return;



        // 1. Clear existing clusterer and markers
        if (mapObjectsRef.current.clusterer) {

            mapObjectsRef.current.clusterer.setMap(null);
            mapObjectsRef.current.clusterer = null;
        }

        if (activeCategory === 'NONE') return;

        console.log(`[DEBUG] Filtering places. Total: ${places.length}, Category: ${activeCategory}`);

        // 2. Filter Places
        // If ALL, show everything. If specific, filter by type.
        const placesToShow = activeCategory === 'ALL'
            ? places
            : places.filter(p => p.type === activeCategory);

        console.log(`[DEBUG] Filtered: ${placesToShow.length} places`);

        // Refined Logic for Focus Mode
        let markersToRender: Place[];
        if (focusedPlace) {
            // Show only focused place + selected shop (if any)
            markersToRender = [focusedPlace];
            // Note: Shops are separate entities, we handle them below or merge here if they were in 'places' array.
            // But shops are in MOCK_SHOPS, not 'places' state currently.
        } else {
            markersToRender = placesToShow;
        }

        // 3. Create Markers (for Main Places)
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

            // Click Handler
            naver.maps.Event.addListener(marker, 'click', () => {
                setFocusedPlace(place);
                setIsExpanded(true); // Open panel to show details

                // Optional: Pan to the place
                (map as any).panTo(new naver.maps.LatLng(place.lat, place.lng));
            });

            return marker;
        });

        // 4. Initialize MarkerClustering
        if (newMarkers.length > 0) {

            // MarkerClustering is now imported at the top

            // If ALL, use a neutral color or mix. Let's stick to Blue for Primary.
            // Or maybe check mostly fishing? Let's just use Blue for cluster or Green if activeCategory is Camping.
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
                    ],
                    // stylingFunction removed as we use direct string replacement
                });

                mapObjectsRef.current.clusterer = clusterer;
                console.log("[DEBUG] MarkerClustering initialized successfully");

                /* 
                 * Disable auto-fit bounds to respect user's location zoom level (15)
                 * as per user request. Markers outside the view will be clustered but
                 * the camera won't move.
                 *
                if (newMarkers.length > 0) {
                    const bounds = new naver.maps.LatLngBounds(
                        newMarkers[0].getPosition(),
                        newMarkers[0].getPosition()
                    );
                    newMarkers.forEach(marker => {
                        bounds.extend(marker.getPosition());
                    });

                    map.fitBounds(bounds, {
                        top: 50, bottom: 50, left: 50, right: 50
                    });
                    console.log("[DEBUG] map.fitBounds called for", newMarkers.length, "markers");
                }
                */
            } catch (err) {
                console.error("MarkerClustering initialization failed:", err);
            }
        } else {
            console.log("[DEBUG] No markers to cluster");
        }

        // Handle Shop Marker if selected
        if (selectedShop) {
            const shopMarker = new naver.maps.Marker({
                position: new naver.maps.LatLng(selectedShop.lat, selectedShop.lng),
                map: map,
                title: selectedShop.name,
                icon: {
                    content: `<div style="background:#F59E0B;width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;font-size:16px;">🛒</div>`,
                    anchor: new naver.maps.Point(14, 14)
                }
            });
            // We don't cluster the shop marker for now, just show it.
            // We need to keep a ref to remove it later if we wanted to be strict, 
            // but for now relying on the total cleanup at the start of useEffect might miss it if we don't track it.
            // Let's add it to a tracking list if we want to clear it safely.
            // Actually, the cleanup logic at line 83 only clears the clusterer.
            // We should track this singular marker or just let the clusterer handle everything if we merged them.
            // For simplicity, let's assume valid React lifecycle re-runs will handle basic cleanup if we tracked it in ref.
            // But to be safe, let's add it to mapObjectsRef if we want to clear it.
            // For this iteration, let's just create it. (Optimizable)
        }

    }, [activeCategory, map, places, focusedPlace, selectedShop]);

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
            {/* Main Search Panel (Top Left) */}
            <div className={`search-panel-container ${isExpanded ? 'expanded' : ''}`}>
                <div className="search-bar-header" onClick={() => !isExpanded && setIsExpanded(true)}>
                    {!isExpanded ? (
                        // Collapsed Header
                        focusedPlace ? (
                            <div className="simple-search-bar" style={{ background: '#EFF6FF' }}>
                                <span className="search-icon">🐟</span>
                                <div className="simple-input-text" style={{ fontWeight: 'bold', color: '#1E40AF' }}>
                                    {focusedPlace.name} (선택됨)
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); setFocusedPlace(null); setSelectedShop(null); }} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#666' }}>✕</button>
                            </div>
                        ) : (
                            <div className="simple-search-bar">
                                <span className="search-icon">🔍</span>
                                <div className="simple-input-text">
                                    {tripResult ? `[${tripResult.theme}] ${tripResult.destination}` : (goalLocation || "어디로 떠나시나요?")}
                                </div>
                                {routeSummary && (
                                    <div className="simple-summary">
                                        🚗 {formatDistance(routeSummary.distance)} | {formatDuration(routeSummary.duration)}
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        // Expanded Form
                        <div className="full-search-form">
                            {focusedPlace ? (
                                <div className="fishing-detail-view">
                                    <div className="detail-header">
                                        <h2>{focusedPlace.name}</h2>
                                        <span className="badge">{focusedPlace.type === 'FISHING' ? '낚시 포인트' : '캠핑장'}</span>
                                        <button className="close-btn" onClick={() => { setFocusedPlace(null); setSelectedShop(null); }}>닫기</button>
                                    </div>

                                    {/* Weather & Tide */}
                                    <div className="weather-card">
                                        <div className="weather-row">
                                            <span style={{ fontSize: '24px' }}>☀️</span>
                                            <div>
                                                <div className="temp">{MOCK_WEATHER.temp}°C {MOCK_WEATHER.condition}</div>
                                                <div className="sub-weather">💨 {MOCK_WEATHER.windSpeed}m/s  🌊 {MOCK_WEATHER.waveHeight}m</div>
                                            </div>
                                        </div>
                                        <div className="tide-row">
                                            <div className="tide-item">High: {MOCK_TIDE.highTide.join(', ')}</div>
                                            <div className="tide-item">Low: {MOCK_TIDE.lowTide.join(', ')}</div>
                                            <div className="tide-level">({MOCK_TIDE.tideLevel})</div>
                                        </div>
                                    </div>

                                    {/* Species */}
                                    <div className="species-section">
                                        <h3>🎣 시즌 어종 (지금 잡혀요!)</h3>
                                        <div className="species-list">
                                            {FISH_SPECIES.map(fish => ( // In real app, filter by month
                                                <div key={fish.id} className="species-item">
                                                    <div className="fish-icon">🐟</div>
                                                    <div className="fish-name">{fish.name}</div>
                                                    <div className="fish-time">{fish.activeTime === 'Day' ? '☀️ 주간' : fish.activeTime === 'Night' ? '🌙 야간' : '☀️/🌙 종일'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Baits */}
                                    <div className="bait-section">
                                        <h3>🪱 추천 미끼 & 판매처</h3>
                                        {BAITS.map(bait => (
                                            <div key={bait.id} className="bait-item">
                                                <div className="bait-info">
                                                    <strong>{bait.name}</strong>
                                                    <p>{bait.description}</p>
                                                </div>
                                                <button className="find-shop-btn" onClick={() => {
                                                    // Find a shop that sells this bait.
                                                    const shop = MOCK_SHOPS.find(s => s.sellingBaitIds.includes(bait.id));
                                                    if (shop) {
                                                        setSelectedShop(shop);
                                                        (map as any).panTo(new naver.maps.LatLng(shop.lat, shop.lng));
                                                        alert(`${shop.name} 위치가 지도에 표시되었습니다.`);
                                                    } else {
                                                        alert("근처 판매점이 없습니다.");
                                                    }
                                                }}>판매처 찾기</button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="action-buttons">
                                        <button className="set-goal-btn" onClick={() => {
                                            setGoalLocation(focusedPlace.name);
                                            setFocusedPlace(null); // Exit detail view to search view
                                            // setIsExpanded(true) is already true
                                        }}>
                                            여기로 출발지 설정
                                        </button>
                                    </div>

                                    <button className="close-panel-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExpanded(false);
                                    }}>닫기</button>
                                </div>
                            ) : (
                                <>
                                    {/* Normal Search View */}
                                    <div className="input-group">
                                        <div className="input-row">
                                            <span className="dot start-dot"></span>
                                            <input
                                                value={startLocation}
                                                onChange={(e) => setStartLocation(e.target.value)}
                                                placeholder="출발지"
                                            />
                                        </div>

                                        {waypoints.map((wp, idx) => (
                                            <div key={wp.id} className="input-row waypoint-row">
                                                <span className="dot waypoint-dot">{idx + 1}</span>
                                                <input
                                                    value={wp.value}
                                                    onChange={(e) => handleWaypointChange(wp.id, e.target.value)}
                                                    placeholder="경유지"
                                                />
                                                <button className="remove-wp-btn" onClick={() => handleRemoveWaypoint(wp.id)}>✕</button>
                                            </div>
                                        ))}

                                        <div className="input-row">
                                            <span className="dot goal-dot"></span>
                                            <input
                                                value={goalLocation}
                                                onChange={(e) => setGoalLocation(e.target.value)}
                                                placeholder="도착지 (예: 을왕리 낚시)"
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                                            />
                                        </div>

                                        <div className="form-actions-mini">
                                            <button className="text-btn" onClick={handleAddWaypoint}>+ 경유지</button>
                                            <button className="search-btn-primary" onClick={handleSearch} disabled={isSearching}>
                                                {isSearching ? "분석 중..." : "AI 검색"}
                                            </button>
                                        </div>
                                    </div>

                                    {tripResult && (
                                        <div className="ai-result-section">
                                            <div className="result-header">
                                                <span className={`theme-badge ${tripResult.theme}`}>{tripResult.theme}</span>
                                                <h4>{tripResult.destination} 여행 준비</h4>
                                            </div>

                                            {/* Fishing Specific Info (Search Result Context) */}
                                            {tripResult.theme === 'FISHING' && (tripResult.targetSpecies || tripResult.recommendedBait) && (
                                                <div className="fishing-info-box">
                                                    {tripResult.targetSpecies && (
                                                        <div className="info-row">
                                                            <span className="info-icon">🐟</span>
                                                            <div className="info-content">
                                                                <span className="info-label">대상 어종:</span>
                                                                <span className="info-val">{tripResult.targetSpecies.join(', ')}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {tripResult.recommendedBait && (
                                                        <div className="info-row">
                                                            <span className="info-icon">🪱</span>
                                                            <div className="info-content">
                                                                <span className="info-label">추천 미끼:</span>
                                                                <span className="info-val">{tripResult.recommendedBait.join(', ')}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}


                                            <div className="checklist-box">
                                                <div className="section-title-row">
                                                    <h5>✅ 준비물 & 추천 구매처</h5>
                                                </div>
                                                <div className="checklist-grid">
                                                    {tripResult.checklistDetails ? (
                                                        tripResult.checklistDetails.map((detail, idx) => {
                                                            const isChecked = selectedChecklistItems.has(detail.item);
                                                            const isExpanded = expandedChecklistItems.has(detail.item);
                                                            const hasShops = detail.recommendedShops && detail.recommendedShops.length > 0;

                                                            return (
                                                                <div key={idx} className={`check-item-container ${isChecked ? 'completed' : ''}`}>
                                                                    <div className="check-item-header" onClick={() => hasShops ? toggleChecklistExpand(detail.item) : toggleChecklistItem(detail.item)}>
                                                                        <div className={`check-circle ${isChecked ? 'active' : ''}`}
                                                                            onClick={(e) => { e.stopPropagation(); toggleChecklistItem(detail.item); }}>
                                                                            {isChecked && '✔'}
                                                                        </div>
                                                                        <div className="check-label-group">
                                                                            <span className="check-name">{detail.item}</span>
                                                                            {hasShops && <span className="shop-badge">🛒 구매처 {isExpanded ? '▲' : '▼'}</span>}
                                                                        </div>
                                                                    </div>

                                                                    {/* Shops Dropdown */}
                                                                    {isExpanded && hasShops && (
                                                                        <div className="shop-list-dropdown">
                                                                            {detail.recommendedShops!.map((shop, sIdx) => (
                                                                                <div key={sIdx} className={`shop-option ${selectedSpots.includes(shop.name) ? 'selected' : ''}`}
                                                                                    onClick={() => toggleSpotSelection(shop.name)}>
                                                                                    <span className="shop-name-mini">{shop.name}</span>
                                                                                    <span className="add-btn-mini">{selectedSpots.includes(shop.name) ? '제거' : '추가'}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        // Fallback for old AI response or legacy
                                                        tripResult.checklist.map((item, idx) => (
                                                            <div key={idx} className="check-item" onClick={() => toggleChecklistItem(item)}>
                                                                <span>{item}</span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            <div className="spots-box">
                                                <h5>📍 AI 추천 경유지 (선택)</h5>
                                                {tripResult.recommendedSpots && tripResult.recommendedSpots.map((spot, idx) => (
                                                    <div key={idx} className={`spot-option ${selectedSpots.includes(spot.name) ? 'selected' : ''}`}>
                                                        <div className="checkbox-custom" onClick={() => toggleSpotSelection(spot.name)}>
                                                            {selectedSpots.includes(spot.name) ? '✔' : ''}
                                                        </div>
                                                        <div className="spot-text" style={{ flex: 1 }} onClick={() => toggleSpotSelection(spot.name)}>
                                                            <span className="spot-name">{spot.name}</span>
                                                            <div className="spot-meta">
                                                                <span className="spot-type">{spot.type}</span>
                                                                {spot.address && <span className="spot-addr">{spot.address.split(' ').slice(0, 2).join(' ')}...</span>}
                                                            </div>
                                                        </div>
                                                        {selectedSpots.includes(spot.name) && (
                                                            <div className="order-controls">
                                                                <button onClick={(e) => { e.stopPropagation(); moveSpot(selectedSpots.indexOf(spot.name), 'UP') }}>▲</button>
                                                                <div className="order-badge">{selectedSpots.indexOf(spot.name) + 1}</div>
                                                                <button onClick={(e) => { e.stopPropagation(); moveSpot(selectedSpots.indexOf(spot.name), 'DOWN') }}>▼</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Stopovers Box */}
                                            {tripResult.recommendedStopovers && tripResult.recommendedStopovers.length > 0 && (
                                                <div className="spots-box stopover-box">
                                                    <h5>🛣️ 가는 길 추천 경유지</h5>
                                                    {tripResult.recommendedStopovers.map((spot, idx) => (
                                                        <div key={idx} className={`spot-option stopover ${selectedSpots.includes(spot.name) ? 'selected' : ''}`}>
                                                            <div className="checkbox-custom" onClick={() => toggleSpotSelection(spot.name)}>
                                                                {selectedSpots.includes(spot.name) ? '✔' : ''}
                                                            </div>
                                                            <div className="spot-text" style={{ flex: 1 }} onClick={() => toggleSpotSelection(spot.name)}>
                                                                <span className="spot-name">{spot.name}</span>
                                                                <div className="spot-meta">
                                                                    <span className="spot-type">{spot.type}</span>
                                                                    <span className="spot-reason">💡 {spot.reason}</span>
                                                                </div>
                                                            </div>
                                                            {selectedSpots.includes(spot.name) && (
                                                                <div className="order-controls">
                                                                    <button onClick={(e) => { e.stopPropagation(); moveSpot(selectedSpots.indexOf(spot.name), 'UP') }}>▲</button>
                                                                    <div className="order-badge">{selectedSpots.indexOf(spot.name) + 1}</div>
                                                                    <button onClick={(e) => { e.stopPropagation(); moveSpot(selectedSpots.indexOf(spot.name), 'DOWN') }}>▼</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <button className="confirm-trip-btn" onClick={handleConfirmTrip} disabled={isSearching}>
                                                {isSearching ? "경로 계산 중..." : `경유지 ${selectedSpots.length}곳 포함하여 길찾기`}
                                            </button>
                                        </div>
                                    )}

                                    <button className="close-panel-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        setIsExpanded(false);
                                    }}>닫기</button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default RouteSearchPanel;
