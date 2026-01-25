export interface Bait {
    id: string;
    name: string;
    description: string;
    targetSpeciesIds: string[];
}

export interface FishSpecies {
    id: string;
    name: string;
    description: string;
    seasonMonths: number[]; // 1-12
    activeTime: 'Day' | 'Night' | 'All Day';
    recommendedBaitIds: string[];
    imageUrl?: string;
}

export interface WeatherInfo {
    temp: number;
    condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Windy' | 'Foggy';
    windSpeed: number; // m/s
    waveHeight: number; // m
    precipitationChance: number; // %
}

export interface TideInfo {
    highTide: string[]; // e.g., ["09:00", "21:30"]
    lowTide: string[];
    tideLevel: string; // e.g., "7물"
}

export interface BaitShop {
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string;
    phone?: string;
    sellingBaitIds: string[];
}


// --- Mock Data ---

export const BAITS: Bait[] = [
    { id: 'b1', name: '갯지렁이', description: '가장 보편적인 바다 낚시 미끼, 대부분의 어종이 좋아함', targetSpeciesIds: ['f1', 'f2', 'f3', 'f5'] },
    { id: 'b2', name: '크릴', description: '감성돔, 벵에돔 등 찌낚시에 효과적', targetSpeciesIds: ['f1', 'f4', 'f6'] },
    { id: 'b3', name: '오징어', description: '질겨서 오래 가고 대물 낚시나 우럭 낚시에 유리함', targetSpeciesIds: ['f2', 'f5'] },
    { id: 'b4', name: '미꾸라지', description: '살아있는 움직임으로 농어 등을 유인', targetSpeciesIds: ['f7'] },
];

export const FISH_SPECIES: FishSpecies[] = [
    {
        id: 'f1',
        name: '감성돔',
        description: '바다의 왕자, 가을~겨울철 대표 찌낚시 대상어',
        seasonMonths: [9, 10, 11, 12, 1, 2, 3],
        activeTime: 'All Day',
        recommendedBaitIds: ['b1', 'b2'],
    },
    {
        id: 'f2',
        name: '우럭(조피볼락)',
        description: '암초 지대에 서식, 국민 횟감',
        seasonMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // 사계절
        activeTime: 'Night',
        recommendedBaitIds: ['b1', 'b3'],
    },
    {
        id: 'f3',
        name: '넙치(광어)',
        description: '모래 바닥에 서식, 루어 낚시 인기 어종',
        seasonMonths: [4, 5, 6, 9, 10, 11, 12],
        activeTime: 'All Day',
        recommendedBaitIds: ['b1'], // 보통 웜(루어)을 쓰지만, 생미끼 예시로 갯지렁이 포함
    },
    {
        id: 'f4',
        name: '고등어',
        description: '가을철 손맛 낚시의 대명사, 떼지어 다님',
        seasonMonths: [8, 9, 10, 11],
        activeTime: 'Day',
        recommendedBaitIds: ['b2'],
    },
    {
        id: 'f5',
        name: '장어(붕장어)',
        description: '여름철 보양식, 밤낚시의 재미',
        seasonMonths: [5, 6, 7, 8, 9, 10],
        activeTime: 'Night',
        recommendedBaitIds: ['b1', 'b3'],
    },
    {
        id: 'f6',
        name: '벵에돔',
        description: '파도가 치는 갯바위 주변 서식, 예민함',
        seasonMonths: [6, 7, 8, 9], // 장마철 전후 등
        activeTime: 'Day',
        recommendedBaitIds: ['b2'],
    },
    {
        id: 'f7',
        name: '농어',
        description: '여름철 루어 낚시의 꽃, 파도를 좋아함',
        seasonMonths: [6, 7, 8, 9, 10],
        activeTime: 'Night',
        recommendedBaitIds: ['b1', 'b4'],
    }
];

export const MOCK_WEATHER: WeatherInfo = {
    temp: 22,
    condition: 'Sunny',
    windSpeed: 3.5,
    waveHeight: 0.5,
    precipitationChance: 10
};

export const MOCK_TIDE: TideInfo = {
    highTide: ["09:00", "21:30"],
    lowTide: ["03:00", "15:30"],
    tideLevel: "7물"
};

export const MOCK_SHOPS: BaitShop[] = [
    {
        id: 's1',
        name: '속초 대박 낚시',
        lat: 38.1905,
        lng: 128.6030,
        address: '강원도 속초시 청호해안길 12',
        sellingBaitIds: ['b1', 'b2', 'b3'],
        phone: '033-123-4567'
    },
    {
        id: 's2',
        name: '동해 24시 낚시 편의점',
        lat: 38.1850,
        lng: 128.5980,
        address: '강원도 속초시 조양동',
        sellingBaitIds: ['b1', 'b4'],
        phone: '033-987-6543'
    },
    {
        id: 's3',
        name: '해변 낚시 마트',
        lat: 38.1950,
        lng: 128.6050,
        address: '강원도 속초시 동해대로',
        sellingBaitIds: ['b2', 'b3'],
    }
];

