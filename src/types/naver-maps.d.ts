declare namespace naver {
    namespace maps {
        class Map {
            constructor(element: HTMLElement, options: any);
            setCenter(center: LatLng | LatLngLiteral): void;
            setZoom(zoom: number): void;
            fitBounds(bounds: any, options?: any): void;
        }
        class LatLng {
            constructor(lat: number, lng: number);
            lat(): number;
            lng(): number;
        }
        class LatLngBounds {
            constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
            extend(latlng: LatLng | LatLngLiteral): void;
        }
        class Point {
            constructor(x: number, y: number);
        }
        class Marker {
            constructor(options: any);
            setMap(map: Map | null): void;
            getPosition(): LatLng;
        }
        class Polyline {
            constructor(options: any);
            setMap(map: Map | null): void;
            setPath(path: Array<LatLng | LatLngLiteral>): void;
        }
        interface LatLngLiteral {
            lat: number;
            lng: number;
        }
        namespace Service {
            function geocode(options: any, callback: any): void;
            enum Status {
                OK,
                ERROR
            }
        }
        namespace Event {
            function addListener(target: any, eventName: string, listener: (e: any) => void): void;
        }
        namespace Position {
            const TOP_RIGHT: any;
        }
    }
}
