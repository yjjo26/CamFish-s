-- ==============================================================================
-- CamFish 통합 플랫폼 마스터 스키마 및 시드 데이터
-- 대상 시스템: Supabase (PostgreSQL 15+), PostGIS 확장 필수
-- 작성일: 2026-01-27
-- 설명: 낚시/캠핑 포인트 통합, 환경 데이터(기상/조석) 연동 구조, 메타데이터 정규화 포함
-- ==============================================================================

--  확장 모듈 활성화 (Extensions)
-- 지리 공간 연산을 위한 PostGIS 활성화
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA public;

-- [2] 테이블 정의 (Schema Definitions)

-- 2.1. 장소 테이블 (Places)
-- 낚시, 캠핑, 편의시설 등 모든 위치 데이터를 통합 관리
-- GEOGRAPHY 타입 사용으로 WGS84 좌표계 기반의 정밀 거리 계산 지원
CREATE TABLE IF NOT EXISTS public.places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 장소명
    type TEXT NOT NULL CHECK (type IN ('FISHING', 'CAMPING', 'AMENITY')), -- 장소 유형
    address TEXT, -- 주소
    location GEOGRAPHY(POINT, 4326) NOT NULL, -- 위경도 좌표 (Spatial Index 적용 대상)
    description TEXT, -- 설명 (어종, 캠핑장 특징 등)
    
    -- API 연동을 위한 사전 계산 필드 (Automation용)
    weather_grid_x INTEGER, -- 기상청 격자 X (n8n에서 계산 후 업데이트)
    weather_grid_y INTEGER, -- 기상청 격자 Y
    tide_station_code TEXT, -- 가장 가까운 조석 관측소 코드 (PostGIS KNN으로 매핑)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_place_name UNIQUE (name) -- 중복 방지
);

-- 공간 쿼리 성능 최적화를 위한 GIST 인덱스 생성
CREATE INDEX IF NOT EXISTS places_location_idx ON public.places USING GIST (location);

-- 2.2. 어종 정보 테이블 (Fish Species)
-- 생물학적 특성 및 시즌 정보 저장
CREATE TABLE IF NOT EXISTS public.fish_species (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    korean_name TEXT NOT NULL UNIQUE, -- 국문명 (예: 우럭, 광어)
    scientific_name TEXT, -- 학명
    habitat_description TEXT, -- 서식지 특성
    active_season TEXT[], -- 주요 출몰 월/계절 (예: ['9월', '10월', '11월'])
    cooking_recommendation TEXT, -- 추천 요리법
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3. 미끼 테이블 (Baits)
CREATE TABLE IF NOT EXISTS public.baits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 미끼명 (예: 갯지렁이, 크릴)
    category TEXT CHECK (category IN ('LIVE', 'LURE', 'POWDER', 'PRESERVED')), -- 생미끼, 루어 등
    target_depth TEXT, -- 공략 수심층 (상층, 바닥층)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4. 어종-미끼 매핑 테이블 (Species-Bait Map)
-- N:M 관계 해소: 어떤 물고기가 어떤 미끼를 좋아하는가?
CREATE TABLE IF NOT EXISTS public.species_bait_map (
    species_id UUID REFERENCES public.fish_species(id) ON DELETE CASCADE,
    bait_id UUID REFERENCES public.baits(id) ON DELETE CASCADE,
    effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5), -- 효과성 등급 (5가 최고)
    PRIMARY KEY (species_id, bait_id)
);

-- 2.5. 장소-어종 매핑 테이블 (Location-Species Map)
-- 장소별 출몰 어종 및 시즌 특이사항 기록
CREATE TABLE IF NOT EXISTS public.location_species_map (
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
    species_id UUID REFERENCES public.fish_species(id) ON DELETE CASCADE,
    season_specific TEXT, -- 해당 장소에서의 특정 시즌 (예: '가을 시즌 특수')
    PRIMARY KEY (place_id, species_id)
);

-- 2.6. 캠핑 장비 테이블 (Camping Gear)
CREATE TABLE IF NOT EXISTS public.camping_gear (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 장비명 (예: 등유 난로)
    category TEXT CHECK (category IN ('SLEEPING', 'KITCHEN', 'SHELTER', 'UTILITY')),
    is_essential_for_winter BOOLEAN DEFAULT FALSE, -- 동계 필수 여부
    description TEXT
);

-- 2.7. 캠핑 레시피 테이블 (Camping Recipes)
CREATE TABLE IF NOT EXISTS public.camping_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 요리명 (예: 캠핑 닭꼬치)
    ingredients TEXT[], -- 재료 목록 배열
    cooking_method TEXT, -- 조리법 요약
    difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
    best_season TEXT -- 추천 계절 (예: Winter)
);

-- 2.8. 편의시설 상세 테이블 (Amenity Details)
-- places 테이블의 확장: 낚시점, 식당, 주유소 등 상세 정보
CREATE TABLE IF NOT EXISTS public.amenity_details (
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE PRIMARY KEY,
    category TEXT CHECK (category IN ('BAIT_SHOP', 'RESTAURANT', 'GAS_STATION', 'CONVENIENCE_STORE', 'TOILET')),
    rating NUMERIC(2,1), -- 평점 (5.0 만점)
    operating_hours TEXT, -- 영업 시간
    signature_menu TEXT -- 대표 메뉴 또는 판매 품목
);

-- 2.9. 캠핑장 상세 테이블 (Camping Spot Details)
-- places 테이블의 확장: 캠핑장 전용 속성
CREATE TABLE IF NOT EXISTS public.camping_spot_details (
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE PRIMARY KEY,
    camp_type TEXT CHECK (camp_type IN ('AUTO_CAMPING', 'GLAMPING', 'CAR_CAMPING', 'BACKPACKING')),
    floor_type TEXT, -- 바닥 형태 (데크, 잔디, 파쇄석, 모래)
    has_electricity BOOLEAN DEFAULT FALSE, -- 전기 사용 가능 여부
    has_hot_water BOOLEAN DEFAULT FALSE, -- 온수 사용 가능 여부
    has_wifi BOOLEAN DEFAULT FALSE, -- 와이파이 유무
    is_pet_friendly BOOLEAN DEFAULT FALSE, -- 반려동물 동반 가능 여부
    base_fee INTEGER, -- 기본 요금
    check_in_time TIME,
    check_out_time TIME
);

-- 2.10. 장소별 장비 추천 테이블 (Spot Gear Recommendation)
-- 특정 장소의 환경(바람, 바닥 등)에 따른 장비 추천
CREATE TABLE IF NOT EXISTS public.spot_gear_recommendation (
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
    gear_id UUID REFERENCES public.camping_gear(id) ON DELETE CASCADE,
    reason TEXT, -- 추천 사유 (예: '강풍이 불어 팩 다운이 깊어야 함')
    PRIMARY KEY (place_id, gear_id)
);

-- ==============================================================================
-- [3] RLS 정책 (Row Level Security)
-- ==============================================================================

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for places" ON public.places FOR SELECT USING (true);

ALTER TABLE public.fish_species ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for fish_species" ON public.fish_species FOR SELECT USING (true);

ALTER TABLE public.baits ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for baits" ON public.baits FOR SELECT USING (true);

ALTER TABLE public.species_bait_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for species_bait_map" ON public.species_bait_map FOR SELECT USING (true);

ALTER TABLE public.location_species_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for location_species_map" ON public.location_species_map FOR SELECT USING (true);

ALTER TABLE public.camping_gear ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for camping_gear" ON public.camping_gear FOR SELECT USING (true);

ALTER TABLE public.camping_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for camping_recipes" ON public.camping_recipes FOR SELECT USING (true);

ALTER TABLE public.amenity_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for amenity_details" ON public.amenity_details FOR SELECT USING (true);

ALTER TABLE public.camping_spot_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for camping_spot_details" ON public.camping_spot_details FOR SELECT USING (true);

ALTER TABLE public.spot_gear_recommendation ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Public read access for spot_gear_recommendation" ON public.spot_gear_recommendation FOR SELECT USING (true);

-- ==============================================================================
-- END OF SCHEMA
-- ==============================================================================
