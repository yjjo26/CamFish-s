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
        const location = new naver.maps.LatLng(37.5665, 126.9780);
        const mapOptions = {
            center: location,
            zoom: 15,
            zoomControl: true,
            zoomControlOptions: {
                position: naver.maps.Position.TOP_RIGHT,
            },
        };
        const map = new naver.maps.Map(mapElement.current, mapOptions);

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
