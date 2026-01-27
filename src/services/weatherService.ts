export interface WeatherData {
    temp: number;
    condition: string;
    windSpeed: number;
    waveHeight: number;
}

export interface TideData {
    highTide: string[];
    lowTide: string[];
    score: string; // e.g. "8-MUL"
}

// Mock Data Generator
export const fetchWeather = async (lat: number, lng: number): Promise<WeatherData> => {
    // In a real app, call OpenWeatherMap or KMA API provided by user
    // Returning mock data for now
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                temp: 18 + Math.floor(Math.random() * 5),
                condition: ['Sunny', 'Cloudy', 'Partly Cloudy'][Math.floor(Math.random() * 3)],
                windSpeed: parseFloat((Math.random() * 5).toFixed(1)),
                waveHeight: parseFloat((Math.random() * 1.5).toFixed(1))
            });
        }, 300);
    });
};

export const fetchTide = async (lat: number, lng: number, date: Date = new Date()): Promise<TideData> => {
    // Mock Tide Logic
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                highTide: ['09:30', '21:45'],
                lowTide: ['03:15', '15:30'],
                score: '8-MUL'
            });
        }, 300);
    });
};
