import { useEffect, useRef } from 'react';

interface MapProps {
    onMapLoad?: (map: naver.maps.Map) => void;
}

const Map = ({ onMapLoad }: MapProps) => {
    const mapElement = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const { naver } = window;
        if (!mapElement.current || !naver) return;

        // Initialize map centered on Seoul City Hall as default
        const defaultLocation = new naver.maps.LatLng(37.5665, 126.9780);
        const mapOptions = {
            center: defaultLocation,
            zoom: 14,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT,
            },
            tileTransition: true, // Smooth tile fading
            disableKineticPan: false, // Enable inertia panning (smoothness)
            scrollWheel: true,
            draggable: true,
        };
        const map = new naver.maps.Map(mapElement.current, mapOptions);

        // Try to get user's current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const userLocation = new naver.maps.LatLng(lat, lng);

                    map.setCenter(userLocation);
                    map.setZoom(15, true); // Zoom to street level (Eup/Myeon/Dong)

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
    }, [onMapLoad]);

    return (
        <div
            ref={mapElement}
            style={{ width: '100%', height: '100vh' }}
        />
    );
};

export default Map;
