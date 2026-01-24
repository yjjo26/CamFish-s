export interface Coordinates {
    lat: number;
    lng: number;
}

export interface RouteSummary {
    distance: number; // meters
    duration: number; // milliseconds
    bbox: number[][]; // [[minX, minY], [maxX, maxY]]
    tollFare: number;
    taxiFare: number;
    fuelPrice: number;
}

export interface RouteResult {
    code: number;
    message?: string;
    route?: {
        trafast: {
            summary: RouteSummary;
            path: number[][]; // [lng, lat] arrays
        }[];
    };
}

/**
 * Fetches driving directions from Naver Maps Directions 5 API
 * @param start Start coordinates
 * @param goal Goal coordinates
 * @param waypoints Optional array of waypoint coordinates
 * @returns Promise with route data
 */
export const getDrivingRoute = async (
    start: Coordinates,
    goal: Coordinates,
    waypoints: Coordinates[] = []
): Promise<RouteResult> => {
    const startStr = `${start.lng},${start.lat}`;
    const goalStr = `${goal.lng},${goal.lat}`;

    let url = `/api/naver/map-direction/v1/driving?start=${startStr}&goal=${goalStr}&option=trafast`;

    if (waypoints.length > 0) {
        const waypointsStr = waypoints
            .map(wp => `${wp.lng},${wp.lat}`)
            .join('|');
        url += `&waypoints=${waypointsStr}`;
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // Try to parse the error body to get the specific Naver error message
            let errorMsg = `Navigation API Error: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.message) {
                    errorMsg += ` - ${errorData.error.message}`;
                } else if (errorData.message) {
                    errorMsg += ` - ${errorData.message}`;
                }
            } catch (e) {
                // Ignore json parse error
            }
            throw new Error(errorMsg);
        }

        const data: RouteResult = await response.json();

        if (data.code !== 0) {
            throw new Error(data.message || 'Unknown error from Navigation API');
        }

        return data;
    } catch (error) {
        console.error('Failed to fetch route:', error);
        throw error;
    }
};

/**
 * Geocodes an address string to coordinates using Naver Maps JS API
 * This avoids 401 errors from REST API if the Secret Key is missing/invalid
 * @param query Address to search
 * @returns Promise with coordinates
 */
export const geocodeAddress = async (query: string): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
        if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
            reject(new Error('Naver Maps API is not loaded'));
            return;
        }

        window.naver.maps.Service.geocode({
            query: query
        }, (status: any, response: any) => {
            if (status !== window.naver.maps.Service.Status.OK) {
                reject(new Error('Geocoding failed or address not found'));
                return;
            }

            const result = response.v2; // Response structure varies, v2 is standard for JS API
            const items = result.addresses;

            if (!items || items.length === 0) {
                reject(new Error(`주소를 찾을 수 없습니다: ${query}`));
                return;
            }

            // Standard JS API returns 'x' (lng) and 'y' (lat)
            const item = items[0];
            resolve({
                lat: Number(item.y),
                lng: Number(item.x)
            });
        });
    });
};

