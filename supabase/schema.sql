-- =====================================================
-- CamFish Database Schema for Supabase
-- Based on: 낚시 캠핑 앱 데이터베이스 설계.md
-- =====================================================

-- ===================
-- 0. CLEANUP (DROP EXISTING)
-- ===================
DROP VIEW IF EXISTS public.v_place_overview;
DROP TABLE IF EXISTS public.amenity_details;
DROP TABLE IF EXISTS public.route_waypoints;
DROP TABLE IF EXISTS public.user_routes;
DROP TABLE IF EXISTS public.spot_gear_recommendation;
DROP TABLE IF EXISTS public.camping_spot_details;
DROP TABLE IF EXISTS public.camping_recipes;
DROP TABLE IF EXISTS public.camping_gear;
DROP TABLE IF EXISTS public.spot_species_season;
DROP TABLE IF EXISTS public.fishing_spot_details;
DROP TABLE IF EXISTS public.species_bait_map;
DROP TABLE IF EXISTS public.baits;
DROP TABLE IF EXISTS public.fish_species;
DROP TABLE IF EXISTS public.places CASCADE;

DROP TYPE IF EXISTS place_type;
DROP TYPE IF EXISTS fishing_spot_type;
DROP TYPE IF EXISTS camping_spot_type;
DROP TYPE IF EXISTS amenity_type;
DROP TYPE IF EXISTS tide_scale_enum;
DROP TYPE IF EXISTS season_enum;

-- ===================
-- 1. EXTENSIONS
-- ===================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ===================
-- 2. ENUM TYPES
-- ===================

-- 장소의 대분류
CREATE TYPE place_type AS ENUM ('FISHING', 'CAMPING', 'AMENITY', 'TOURIST_SPOT');

-- 낚시 포인트 상세 유형
CREATE TYPE fishing_spot_type AS ENUM ('BREAKWATER', 'BOAT', 'ROCKS', 'RESERVOIR', 'WHARF', 'SEASIDE');

-- 캠핑 포인트 상세 유형
CREATE TYPE camping_spot_type AS ENUM ('AUTO_CAMPING', 'CAR_CAMPING', 'BACKPACKING', 'GLAMPING', 'CARAVAN');

-- 편의시설 유형
CREATE TYPE amenity_type AS ENUM ('GAS_STATION', 'RESTAURANT', 'CONVENIENCE_STORE', 'BAIT_SHOP', 'TOILET');

-- 물때(Tide) 스케일
CREATE TYPE tide_scale_enum AS ENUM ('1-MUL', '2-MUL', '3-MUL', '4-MUL', '5-MUL', '6-MUL', '7-MUL', '8-MUL', '9-MUL', '10-MUL', '11-MUL', '12-MUL', '13-MUL', '14-MUL', 'JOGEUM', 'MUSI');

-- 계절 분류
CREATE TYPE season_enum AS ENUM ('SPRING', 'SUMMER', 'AUTUMN', 'WINTER');

-- ===================
-- 3. CORE TABLES
-- ===================

-- 통합 장소(Places) 슈퍼 테이블
CREATE TABLE public.places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type place_type NOT NULL,
    address TEXT,
    description TEXT,
    
    -- 공간 데이터: WGS 84 좌표계 사용
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    
    -- 편의를 위한 위경도 자동 생성 컬럼
    lat DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
    lng DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
    
    thumbnail_url TEXT,
    contact_phone TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 공간 검색 성능을 위한 GiST 인덱스
CREATE INDEX idx_places_location ON public.places USING GIST (location);
-- 이름 검색을 위한 Trigram 인덱스
CREATE INDEX idx_places_name ON public.places USING GIST (name gist_trgm_ops);
-- 타입 필터링을 위한 B-Tree 인덱스
CREATE INDEX idx_places_type ON public.places (type);

-- ===================
-- 4. FISHING DOMAIN
-- ===================

-- 어종 정보 테이블
CREATE TABLE public.fish_species (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    korean_name TEXT NOT NULL UNIQUE,
    scientific_name TEXT,
    habitat_description TEXT,
    image_url TEXT
);

-- 미끼 정보 테이블
CREATE TABLE public.baits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT -- 'LIVE', 'LURE', 'POWDER'
);

-- 어종-미끼 관계 테이블 (다대다)
CREATE TABLE public.species_bait_map (
    species_id UUID REFERENCES public.fish_species(id) ON DELETE CASCADE,
    bait_id UUID REFERENCES public.baits(id) ON DELETE CASCADE,
    effectiveness_score INTEGER DEFAULT 5,
    PRIMARY KEY (species_id, bait_id)
);

-- 낚시 포인트 상세 정보
CREATE TABLE public.fishing_spot_details (
    place_id UUID PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
    spot_type fishing_spot_type NOT NULL,
    
    average_depth_m DECIMAL(4,1),
    is_night_fishing_allowed BOOLEAN DEFAULT TRUE,
    is_toilet_available BOOLEAN DEFAULT FALSE,
    is_parking_available BOOLEAN DEFAULT TRUE,
    
    recommended_tides tide_scale_enum[],
    legal_restrictions TEXT
);

-- 포인트별 출몰 어종 및 시즌 매핑
CREATE TABLE public.spot_species_season (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
    species_id UUID REFERENCES public.fish_species(id) ON DELETE CASCADE,
    season season_enum NOT NULL,
    fishing_tip TEXT,
    
    UNIQUE(place_id, species_id, season)
);

-- ===================
-- 5. CAMPING DOMAIN
-- ===================

-- 캠핑 장비 마스터
CREATE TABLE public.camping_gear (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT, -- 'SHELTER', 'SLEEPING', 'KITCHEN', 'UTILITY'
    is_essential_for_winter BOOLEAN DEFAULT FALSE
);

-- 캠핑 요리 레시피
CREATE TABLE public.camping_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ingredients TEXT[],
    cooking_method TEXT,
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5)
);

-- 캠핑 포인트 상세 정보
CREATE TABLE public.camping_spot_details (
    place_id UUID PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
    camp_type camping_spot_type NOT NULL,
    
    floor_type TEXT, -- 'DECK', 'CRUSHED_STONE', 'GRASS', 'SAND'
    
    has_electricity BOOLEAN DEFAULT FALSE,
    has_hot_water BOOLEAN DEFAULT FALSE,
    has_wifi BOOLEAN DEFAULT FALSE,
    is_pet_friendly BOOLEAN DEFAULT FALSE,
    
    base_fee INTEGER,
    check_in_time TIME,
    check_out_time TIME
);

-- 포인트별 필수/추천 장비 매핑
CREATE TABLE public.spot_gear_recommendation (
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
    gear_id UUID REFERENCES public.camping_gear(id) ON DELETE CASCADE,
    reason TEXT,
    PRIMARY KEY (place_id, gear_id)
);

-- ===================
-- 6. ROUTE & AMENITY
-- ===================

-- 주변 편의시설 상세
CREATE TABLE public.amenity_details (
    place_id UUID PRIMARY KEY REFERENCES public.places(id) ON DELETE CASCADE,
    category amenity_type NOT NULL,
    
    rating DECIMAL(2,1),
    operating_hours TEXT,
    signature_menu TEXT
);

-- 사용자 경로 (나만의 코스)
CREATE TABLE public.user_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID DEFAULT auth.uid(), -- If auth is enabled later
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 경로 경유지
CREATE TABLE public.route_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES public.user_routes(id) ON DELETE CASCADE,
    place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
    order_index INTEGER NOT NULL,
    memo TEXT
);

-- ===================
-- 7. DATABASE VIEW
-- ===================

CREATE OR REPLACE VIEW public.v_place_overview AS
SELECT 
    p.id,
    p.name,
    p.type,
    p.lat,
    p.lng,
    p.description,
    fsd.spot_type AS fishing_type,
    (
        SELECT string_agg(fs.korean_name, ', ')
        FROM public.spot_species_season sss
        JOIN public.fish_species fs ON sss.species_id = fs.id
        WHERE sss.place_id = p.id
    ) AS target_species,
    csd.camp_type,
    csd.has_electricity,
    csd.is_pet_friendly
FROM 
    public.places p
LEFT JOIN 
    public.fishing_spot_details fsd ON p.id = fsd.place_id
LEFT JOIN 
    public.camping_spot_details csd ON p.id = csd.place_id;

-- ===================
-- 8. SECURITY (RLS)
-- ===================

-- Places: Public Read
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for places" ON public.places FOR SELECT USING (true);

-- Fish Species: Public Read
ALTER TABLE public.fish_species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for fish_species" ON public.fish_species FOR SELECT USING (true);

-- Baits: Public Read
ALTER TABLE public.baits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for baits" ON public.baits FOR SELECT USING (true);

-- Species-Bait Map: Public Read
ALTER TABLE public.species_bait_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for species_bait_map" ON public.species_bait_map FOR SELECT USING (true);

-- Fishing Spot Details: Public Read
ALTER TABLE public.fishing_spot_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for fishing_spot_details" ON public.fishing_spot_details FOR SELECT USING (true);

-- Spot Species Season: Public Read
ALTER TABLE public.spot_species_season ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for spot_species_season" ON public.spot_species_season FOR SELECT USING (true);

-- Camping Gear: Public Read
ALTER TABLE public.camping_gear ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for camping_gear" ON public.camping_gear FOR SELECT USING (true);

-- Camping Recipes: Public Read
ALTER TABLE public.camping_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for camping_recipes" ON public.camping_recipes FOR SELECT USING (true);

-- Camping Spot Details: Public Read
ALTER TABLE public.camping_spot_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for camping_spot_details" ON public.camping_spot_details FOR SELECT USING (true);

-- Spot Gear Recommendation: Public Read
ALTER TABLE public.spot_gear_recommendation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for spot_gear_recommendation" ON public.spot_gear_recommendation FOR SELECT USING (true);

-- Amenity Details: Public Read
ALTER TABLE public.amenity_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for amenity_details" ON public.amenity_details FOR SELECT USING (true);

-- Note: user_routes and route_waypoints should be private (authenticated user only), 
-- but for now leaving as-is or default deny if RLS enabled.
-- Let's enable RLS for them but no policy yet (or auth policy if we had auth set up).
-- Assuming anon for now for simplicity in this dev phase, let's allow all for dev.
ALTER TABLE public.user_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write access for user_routes for dev" ON public.user_routes USING (true);

ALTER TABLE public.route_waypoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read/write access for route_waypoints for dev" ON public.route_waypoints USING (true);

