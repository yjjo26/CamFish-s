import { useEffect, useRef } from 'react';

interface MapProps {
    onMapLoad?: (map: naver.maps.Map) => void;
    onMapClick?: () => void;
}

const Map = ({ onMapLoad, onMapClick }: MapProps) => {
    const mapElement = useRef<HTMLDivElement | null>(null);
    const mapInstance = useRef<naver.maps.Map | null>(null);
    const clickListenerRef = useRef<any>(null);

    // 1. Initialize Map (Run ONCE)
    useEffect(() => {
        const { naver } = window;
        if (!mapElement.current || !naver || mapInstance.current) return;

        // Initialize map centered on Seoul City Hall as default
        const defaultLocation = new naver.maps.LatLng(37.5665, 126.9780);
        const mapOptions = {
            center: defaultLocation,
            zoom: 10, // 시/군/구 레벨로 조정
            zoomControl: false, // 확대/축소 UI 숨김
            tileTransition: true, // Smooth tile fading
            disableKineticPan: false, // Enable inertia panning (smoothness)
            scrollWheel: true,
            draggable: true,
        };
        const map = new naver.maps.Map(mapElement.current, mapOptions);
        mapInstance.current = map;

        // Try to get user's current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const userLocation = new naver.maps.LatLng(lat, lng);

                    map.setCenter(userLocation);
                    map.setZoom(10, true); // 시/군/구 레벨로 조정

                    // Optional: Add a marker for "My Location"
                    new naver.maps.Marker({
                        position: userLocation,
                        map: map,
                        title: '내 위치',
                        icon: {
                            content: '<div style="width:14px;height:14px;background:#3B82F6;border:2px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59, 130, 246, 0.3);"></div>',
                            anchor: new naver.maps.Point(7, 7)
                        }
                    });
                },
                (error) => {
                    console.log("Geolocation failed or denied:", error);
                }
            );
        }

        if (onMapLoad) {
            onMapLoad(map);
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    // 2. Handle Click Listener Update independently
    useEffect(() => {
        if (!mapInstance.current || !onMapClick) return;

        // Remove previous listener if exists
        if (clickListenerRef.current) {
            // @ts-ignore
            naver.maps.Event.removeListener(clickListenerRef.current);
        }

        // Add new listener
        clickListenerRef.current = naver.maps.Event.addListener(mapInstance.current, 'click', () => {
            onMapClick();
        });

        // Cleanup on unmount or prop change
        return () => {
            if (clickListenerRef.current) {
                // @ts-ignore
                naver.maps.Event.removeListener(clickListenerRef.current);
            }
        };
    }, [onMapClick]);

    return (
        <div
            ref={mapElement}
            style={{ width: '100%', height: '100vh' }}
        />
    );
};

export default Map;
