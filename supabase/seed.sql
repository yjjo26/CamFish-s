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
    active_season TEXT, -- 주요 출몰 월/계절 (예: ['9월', '10월', '11월'])
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
    ingredients TEXT, -- 재료 목록 배열
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

-- [3] 데이터 삽입 (Data Seed) - 제공된 파일 데이터 통합

-- 3.1 낚시 포인트 (Fishing Spots) - 중복 제거 및 공간 데이터 변환 포함
INSERT INTO public.places (name, type, address, location, description) VALUES
('을왕리 선녀바위', 'FISHING', '인천광역시 중구 을왕동 678-188', ST_SetSRID(ST_MakePoint(126.3725, 37.4562), 4326), '우럭, 광어, 숭어 (갯바위/원투)'),
('궁평항 피싱피어', 'FISHING', '경기도 화성시 서신면 궁평항로 1049-24', ST_SetSRID(ST_MakePoint(126.6957, 37.1148), 4326), '망둥어, 숭어, 우럭 (가족 낚시)'),
('시화방조제', 'FISHING', '경기도 시흥시 정왕동', ST_SetSRID(ST_MakePoint(126.6394, 37.3055), 4326), '우럭, 삼치, 광어 (국민 포인트)'),
('오이도 빨강등대', 'FISHING', '경기 시흥시 오이도로 175', ST_SetSRID(ST_MakePoint(126.6874, 37.3456), 4326), '망둥어, 숭어 (생활 낚시)'),
('무의도 광명항', 'FISHING', '인천 중구 무의동', ST_SetSRID(ST_MakePoint(126.4294, 37.3739), 4326), '갑오징어, 쭈꾸미, 광어'),
('화성 전곡항', 'FISHING', '경기 화성시 서신면 전곡항로', ST_SetSRID(ST_MakePoint(126.6473, 37.1916), 4326), '망둥어, 숭어, 우럭'),
('인천 남항부두', 'FISHING', '인천 중구 축항대로', ST_SetSRID(ST_MakePoint(126.6190, 37.4423), 4326), '배낚시 출조 전문 항구'),
('당진 왜목마을', 'FISHING', '충남 당진시 석문면 교로리 844-4', ST_SetSRID(ST_MakePoint(126.4172, 37.0097), 4326), '도다리, 우럭, 쭈꾸미'),
('태안 만리포 방파제', 'FISHING', '충남 태안군 소원면 모항리', ST_SetSRID(ST_MakePoint(126.1428, 36.7877), 4326), '학꽁치, 고등어, 우럭'),
('서산 삼길포항', 'FISHING', '충남 서산시 대산읍 화곡리', ST_SetSRID(ST_MakePoint(126.4522, 37.0089), 4326), '우럭, 고등어, 삼치 (좌대 낚시)'),
('안면도 영목항', 'FISHING', '충남 태안군 고남면 고남리', ST_SetSRID(ST_MakePoint(126.4243, 36.3986), 4326), '갑오징어, 쭈꾸미 워킹'),
('보령 대천항', 'FISHING', '충남 보령시 신흑동', ST_SetSRID(ST_MakePoint(126.4975, 36.3243), 4326), '보령 쭈꾸미/갑오징어 메카'),
('홍성 남당항', 'FISHING', '충남 홍성군 서부면 남당리', ST_SetSRID(ST_MakePoint(126.4655, 36.5684), 4326), '대하 제철 생활낚시'),
('서천 홍원항', 'FISHING', '충남 서천군 서면 도둔리', ST_SetSRID(ST_MakePoint(126.4883, 36.1965), 4326), '광어 다운샷 출조지'),
('군산 비응항', 'FISHING', '전북 군산시 비응도동', ST_SetSRID(ST_MakePoint(126.5163, 35.9288), 4326), '서해권 생활낚시 & 우럭'),
('부안 격포항', 'FISHING', '전북 부안군 변산면 격포리', ST_SetSRID(ST_MakePoint(126.5298, 35.6174), 4326), '감성돔, 숭어 (위도 배낚시)'),
('목포 북항', 'FISHING', '전남 목포시 죽교동', ST_SetSRID(ST_MakePoint(126.3770, 34.8087), 4326), '갈치 풀치 낚시 명소'),
('진도 팽목항', 'FISHING', '전남 진도군 임회면', ST_SetSRID(ST_MakePoint(126.1264, 34.3642), 4326), '감성돔, 붕장어 원투'),
('주문진항 방파제', 'FISHING', '강원도 강릉시 주문진읍 해안로 1730', ST_SetSRID(ST_MakePoint(128.8288, 37.8926), 4326), '감성돔, 뱅에돔, 고등어'),
('속초 아야진항', 'FISHING', '강원도 고성군 토성면 아야진리', ST_SetSRID(ST_MakePoint(128.5539, 38.2721), 4326), '임연수, 학꽁치, 감성돔'),
('삼척 장호항', 'FISHING', '강원 삼척시 근덕면 장호리', ST_SetSRID(ST_MakePoint(129.3175, 37.2847), 4326), '무늬오징어, 감성돔'),
('양양 수산항', 'FISHING', '강원 양양군 손양면 수산리', ST_SetSRID(ST_MakePoint(128.6667, 38.0833), 4326), '가자미, 학꽁치 (요트 마리나)'),
('고성 공현진항', 'FISHING', '강원 고성군 죽왕면', ST_SetSRID(ST_MakePoint(128.5133, 38.3541), 4326), '어구가자미 배낚시'),
('강릉 안목항', 'FISHING', '강원 강릉시 견소동', ST_SetSRID(ST_MakePoint(128.9482, 37.7713), 4326), '테트라포드 구멍치기, 루어'),
('울진 후포항', 'FISHING', '경북 울진군 후포면 울진대게로', ST_SetSRID(ST_MakePoint(129.4516, 36.6787), 4326), '대물 감성돔, 벵에돔'),
('포항 영일만항', 'FISHING', '경북 포항시 북구 흥해읍', ST_SetSRID(ST_MakePoint(129.4239, 36.1118), 4326), '삼치, 방어, 고등어 루어'),
('경주 감포항', 'FISHING', '경북 경주시 감포읍', ST_SetSRID(ST_MakePoint(129.5160, 35.8037), 4326), '고등어, 전갱이 생활낚시'),
('영덕 축산항', 'FISHING', '경북 영덕군 축산면', ST_SetSRID(ST_MakePoint(129.4312, 36.5056), 4326), '뱅에돔, 감성돔 포인트'),
('부산 기장 죽성성당', 'FISHING', '부산 기장군 기장읍 죽성리', ST_SetSRID(ST_MakePoint(129.2505, 35.2427), 4326), '농어, 무늬오징어'),
('여수 국동항', 'FISHING', '전남 여수시 어항단지로', ST_SetSRID(ST_MakePoint(127.7169, 34.7247), 4326), '갑오징어, 쭈꾸미 성지'),
('통영 척포방파제', 'FISHING', '경남 통영시 산양읍 미남리', ST_SetSRID(ST_MakePoint(128.4067, 34.7792), 4326), '볼락, 전갱이 (밤낚시)'),
('거제 지세포항', 'FISHING', '경남 거제시 일운면 지세포리', ST_SetSRID(ST_MakePoint(128.6947, 34.8475), 4326), '참돔, 감성돔, 무늬오징어'),
('남해 미조항', 'FISHING', '경남 남해군 미조면 미조리', ST_SetSRID(ST_MakePoint(128.0289, 34.7172), 4326), '감성돔, 볼락 성지'),
('창원 진해 해양공원', 'FISHING', '경남 창원시 진해구 명동', ST_SetSRID(ST_MakePoint(128.7180, 35.1090), 4326), '갈치, 호래기 루어'),
('제주 차귀도 포구', 'FISHING', '제주 제주시 한경면 고산리', ST_SetSRID(ST_MakePoint(126.1611, 33.3086), 4326), '자바리(다금바리), 돌돔, 고등어'),
('서귀포 위미항', 'FISHING', '제주 서귀포시 남원읍 위미리', ST_SetSRID(ST_MakePoint(126.6622, 33.2652), 4326), '벵에돔, 무늬오징어'),
('제주 도두항', 'FISHING', '제주 제주시 도두1동', ST_SetSRID(ST_MakePoint(126.4674, 33.5089), 4326), '한치, 갈치 배낚시'),
('예당저수지', 'FISHING', '충남 예산군 응봉면', ST_SetSRID(ST_MakePoint(126.7975, 36.6347), 4326), '토종붕어 (국내 최대 좌대)'),
('충주호', 'FISHING', '충북 충주시', ST_SetSRID(ST_MakePoint(127.8911, 37.0163), 4326), '장어, 쏘가리, 대물 붕어'),
('춘천 의암호', 'FISHING', '강원 춘천시', ST_SetSRID(ST_MakePoint(127.6917, 37.8944), 4326), '배스, 블루길 보팅'),
('안동호', 'FISHING', '경북 안동시', ST_SetSRID(ST_MakePoint(128.8242, 36.6439), 4326), '국제 배스 낚시 대회장'),
('인천 시도 수기해변', 'FISHING', '인천 옹진군 북도면', ST_SetSRID(ST_MakePoint(126.4288, 37.5387), 4326), '풀하우스 촬영지, 망둥어'),
('화성 제부도 피싱피어', 'FISHING', '경기 화성시 서신면', ST_SetSRID(ST_MakePoint(126.6188, 37.1587), 4326), '모세의 기적, 가족 낚시'),
('안산 탄도항', 'FISHING', '경기 안산시 단원구', ST_SetSRID(ST_MakePoint(126.6388, 37.1887), 4326), '누에섬, 망둥어'),
('평택 평택호 관광단지', 'FISHING', '경기 평택시 현덕면', ST_SetSRID(ST_MakePoint(126.9688, 36.9387), 4326), '붕어, 잉어 대낚시'),
('당진 장고항', 'FISHING', '충남 당진시 석문면', ST_SetSRID(ST_MakePoint(126.5188, 37.0787), 4326), '실치축제, 우럭, 놀래미'),
('서천 춘장대 해수욕장', 'FISHING', '충남 서천군 서면', ST_SetSRID(ST_MakePoint(126.5488, 36.1787), 4326), '광어, 도다리 원투'),
('군산 신시도', 'FISHING', '전북 군산시 옥도면', ST_SetSRID(ST_MakePoint(126.4588, 35.8187), 4326), '고군산군도 낚시 포인트'),
('부안 위도', 'FISHING', '전북 부안군 위도면', ST_SetSRID(ST_MakePoint(126.2988, 35.6087), 4326), '갯바위 낚시 천국'),
('고창 구시포', 'FISHING', '전북 고창군 상하면', ST_SetSRID(ST_MakePoint(126.4588, 35.4287), 4326), '농어, 숭어 루어'),
('영광 계마항', 'FISHING', '전남 영광군 홍농읍', ST_SetSRID(ST_MakePoint(126.3988, 35.3987), 4326), '감성돔, 농어'),
('신안 암태도', 'FISHING', '전남 신안군 암태면', ST_SetSRID(ST_MakePoint(126.1188, 34.8287), 4326), '천사대교, 감성돔'),
('완도 완도항', 'FISHING', '전남 완도군 완도읍', ST_SetSRID(ST_MakePoint(126.7588, 34.3187), 4326), '전복 양식장 주변 낚시'),
('고흥 녹동항', 'FISHING', '전남 고흥군 도양읍', ST_SetSRID(ST_MakePoint(127.1488, 34.5087), 4326), '소록도, 문어, 갑오징어'),
('여수 돌산도 방죽포', 'FISHING', '전남 여수시 돌산읍', ST_SetSRID(ST_MakePoint(127.7988, 34.6087), 4326), '감성돔, 벵에돔'),
('남해 창선도', 'FISHING', '경남 남해군 창선면', ST_SetSRID(ST_MakePoint(128.0288, 34.8787), 4326), '죽방멸치, 볼락'),
('사천 삼천포항', 'FISHING', '경남 사천시 서금동', ST_SetSRID(ST_MakePoint(128.0788, 34.9287), 4326), '문어, 쭈꾸미 선상'),
('고성 맥전포항', 'FISHING', '경남 고성군 하일면', ST_SetSRID(ST_MakePoint(128.2188, 34.9087), 4326), '갈치, 볼락, 호래기'),
('거제 구조라항', 'FISHING', '경남 거제시 일운면', ST_SetSRID(ST_MakePoint(128.6788, 34.8087), 4326), '벵에돔, 참돔 메카'),
('부산 다대포', 'FISHING', '부산 사하구 다대동', ST_SetSRID(ST_MakePoint(128.9688, 35.0487), 4326), '몰운대, 감성돔, 농어'),
('부산 송정해수욕장', 'FISHING', '부산 해운대구 송정동', ST_SetSRID(ST_MakePoint(129.2088, 35.1787), 4326), '농어, 광어 루어'),
('울산 간절곶', 'FISHING', '울산 울주군 서생면', ST_SetSRID(ST_MakePoint(129.3588, 35.3587), 4326), '대형 무늬오징어, 벵에돔'),
('양양 남애항', 'FISHING', '강원 양양군 현남면', ST_SetSRID(ST_MakePoint(128.7888, 37.9487), 4326), '강원도의 3대 미항'),
('강릉 정동진', 'FISHING', '강원 강릉시 강동면', ST_SetSRID(ST_MakePoint(129.0388, 37.6987), 4326), '가자미, 황어'),
('삼척 임원항', 'FISHING', '강원 삼척시 원덕읍', ST_SetSRID(ST_MakePoint(129.3488, 37.2387), 4326), '회센터, 대구 배낚시'),
('속초 동명항', 'FISHING', '강원 속초시 동명동', ST_SetSRID(ST_MakePoint(128.6088, 38.2187), 4326), '양미리, 도루묵 통발'),
('고성 거진항', 'FISHING', '강원 고성군 거진읍', ST_SetSRID(ST_MakePoint(128.4688, 38.4487), 4326), '명태의 고향, 문어'),
('경주 양남 주상절리', 'FISHING', '경북 경주시 양남면', ST_SetSRID(ST_MakePoint(129.4788, 35.6887), 4326), '농어, 무늬오징어 갯바위'),
('울릉도 저동항', 'FISHING', '경북 울릉군 울릉읍', ST_SetSRID(ST_MakePoint(130.9088, 37.4987), 4326), '오징어, 부시리, 방어'),
('제주 성산일출봉', 'FISHING', '제주 서귀포시 성산읍', ST_SetSRID(ST_MakePoint(126.9388, 33.4587), 4326), '광어, 농어, 무늬오징어'),
('제주 애월항', 'FISHING', '제주 제주시 애월읍', ST_SetSRID(ST_MakePoint(126.3188, 33.4687), 4326), '한치, 무늬오징어'),
('제주 모슬포항', 'FISHING', '제주 서귀포시 대정읍', ST_SetSRID(ST_MakePoint(126.2488, 33.2187), 4326), '방어 축제, 부시리')
ON CONFLICT (name) DO NOTHING;

-- 3.2 캠핑 포인트 (Camping Spots)
INSERT INTO public.places (name, type, address, location, description) VALUES
('가평 자라섬 캠핑장', 'CAMPING', '경기 가평군 가평읍 자라섬로 60', ST_SetSRID(ST_MakePoint(127.5147, 37.8172), 4326), '국제 재즈 페스티벌 개최지'),
('여주 금은모래 캠핑장', 'CAMPING', '경기 여주시 강변유원지로', ST_SetSRID(ST_MakePoint(127.6601, 37.2891), 4326), '남한강변 자전거길 연결'),
('연천 재인폭포 오토캠핑장', 'CAMPING', '경기 연천군 연천읍 고문리', ST_SetSRID(ST_MakePoint(127.1337, 38.0839), 4326), '폭포 절경 감상 카라반'),
('포천 백운계곡 캠핑장', 'CAMPING', '경기 포천시 이동면', ST_SetSRID(ST_MakePoint(127.4208, 38.0538), 4326), '여름철 물놀이와 이동갈비'),
('인천 송도 스포츠파크', 'CAMPING', '인천 연수구 인천신항대로', ST_SetSRID(ST_MakePoint(126.5912, 37.3516), 4326), '체육시설 완비, 쾌적함'),
('강화 함허동천 야영장', 'CAMPING', '인천 강화군 화도면', ST_SetSRID(ST_MakePoint(126.4528, 37.6108), 4326), '마니산 등산과 캠핑'),
('가평 호명산 잣나무숲', 'CAMPING', '경기 가평군 청평면', ST_SetSRID(ST_MakePoint(127.4667, 37.7667), 4326), '백패킹 성지, 피톤치드'),
('동해 망상 오토캠핑장', 'CAMPING', '강원 동해시 동해대로 6370', ST_SetSRID(ST_MakePoint(129.0911, 37.5937), 4326), '국내 최초 자동차 전용 캠핑장'),
('양양 죽도 오토캠핑장', 'CAMPING', '강원 양양군 현남면', ST_SetSRID(ST_MakePoint(128.7611, 37.9708), 4326), '서핑 비치 바로 앞'),
('영월 솔밭 캠핑장', 'CAMPING', '강원 영월군 무릉도원면', ST_SetSRID(ST_MakePoint(128.2619, 37.2458), 4326), '법흥계곡 1급수 물놀이'),
('평창 흥정계곡 캠핑장', 'CAMPING', '강원 평창군 봉평면', ST_SetSRID(ST_MakePoint(128.3188, 37.6322), 4326), '한여름에도 시원한 계곡'),
('태안 몽산포 캠핑장', 'CAMPING', '충남 태안군 남면 신장리', ST_SetSRID(ST_MakePoint(126.2872, 36.6669), 4326), '끝없는 소나무숲, 맛조개 잡기'),
('태안 학암포 오토캠핑장', 'CAMPING', '충남 태안군 원북면', ST_SetSRID(ST_MakePoint(126.2166, 36.9038), 4326), '국립공원 운영, 깔끔한 시설'),
('제천 닷돈재 야영장', 'CAMPING', '충북 제천시 한수면', ST_SetSRID(ST_MakePoint(128.0694, 36.8522), 4326), '월악산 국립공원 풀옵션 캠핑'),
('해남 땅끝 오토캠핑장', 'CAMPING', '전남 해남군 송지면', ST_SetSRID(ST_MakePoint(126.5132, 34.3005), 4326), '한반도 최남단 캠핑'),
('경주 오류 고아라해변', 'CAMPING', '경북 경주시 감포읍', ST_SetSRID(ST_MakePoint(129.5147, 35.7925), 4326), '아름다운 솔밭과 해변'),
('제주 모구리 야영장', 'CAMPING', '제주 서귀포시 성산읍', ST_SetSRID(ST_MakePoint(126.7915, 33.3958), 4326), '풍력발전기 뷰, 오름 산책'),
('청송 사과공원 캠핑장', 'CAMPING', '경북 청송군 주왕산면', ST_SetSRID(ST_MakePoint(129.0833, 36.4172), 4326), '주왕산 기암절벽 조망'),
('포천 산정호수 (명성산)', 'CAMPING', '경기 포천시 영북면', ST_SetSRID(ST_MakePoint(127.2882, 38.0772), 4326), '명성산 억새밭과 호수 산책'),
('가평 용추계곡', 'CAMPING', '경기 가평군 가평읍 승안리', ST_SetSRID(ST_MakePoint(127.4878, 37.8687), 4326), '시원한 계곡물과 숲속 힐링'),
('양평 중미산 자연휴양림', 'CAMPING', '경기 양평군 옥천면', ST_SetSRID(ST_MakePoint(127.4647, 37.5935), 4326), '밤하늘 별보기 좋은 곳'),
('파주 임진각 평화누리', 'CAMPING', '경기 파주시 문산읍', ST_SetSRID(ST_MakePoint(126.7410, 37.8887), 4326), '평화누리공원 산책과 캠핑'),
('남양주 팔현계곡', 'CAMPING', '경기 남양주시 오남읍', ST_SetSRID(ST_MakePoint(127.2458, 37.7335), 4326), '울창한 숲과 계곡'),
('강화 동막해변', 'CAMPING', '인천 강화군 화도면', ST_SetSRID(ST_MakePoint(126.4187, 37.5912), 4326), '세계 5대 갯벌 체험'),
('옹진 장봉도', 'CAMPING', '인천 옹진군 북도면', ST_SetSRID(ST_MakePoint(126.3358, 37.5332), 4326), '해안 트레킹과 노지 캠핑'),
('춘천 용화산 자연휴양림', 'CAMPING', '강원 춘천시 사북면', ST_SetSRID(ST_MakePoint(127.7288, 38.0067), 4326), '기암괴석과 소나무숲'),
('홍천 모곡밤벌유원지', 'CAMPING', '강원 홍천군 서면', ST_SetSRID(ST_MakePoint(127.5818, 37.6978), 4326), '홍천강변 무료 차박 성지'),
('인제 자작나무숲', 'CAMPING', '강원 인제군 인제읍', ST_SetSRID(ST_MakePoint(128.1889, 38.0567), 4326), '이국적인 자작나무 숲 풍경'),
('정선 동강 전망 자연휴양림', 'CAMPING', '강원 정선군 신동읍', ST_SetSRID(ST_MakePoint(128.6189, 37.2887), 4326), '동강이 내려다보이는 구름 위 캠핑'),
('태안 신두리 해안사구', 'CAMPING', '충남 태안군 원북면', ST_SetSRID(ST_MakePoint(126.1982, 36.8335), 4326), '한국의 사막 기행'),
('충주 비내섬', 'CAMPING', '충북 충주시 앙성면', ST_SetSRID(ST_MakePoint(127.7888, 37.1187), 4326), '사랑의 불시착 촬영지'),
('단양 소선암 오토캠핑장', 'CAMPING', '충북 단양군 단성면', ST_SetSRID(ST_MakePoint(128.3188, 36.9387), 4326), '선암계곡의 아름다운 풍광'),
('무주 덕유대 야영장', 'CAMPING', '전북 무주군 설천면', ST_SetSRID(ST_MakePoint(127.7410, 35.8887), 4326), '덕유산 국립공원 내 대단위 야영장'),
('부안 고사포 야영장', 'CAMPING', '전북 부안군 변산면', ST_SetSRID(ST_MakePoint(126.5410, 35.6487), 4326), '송림과 해변의 조화'),
('순천 와온해변', 'CAMPING', '전남 순천시 해룡면', ST_SetSRID(ST_MakePoint(127.5189, 34.8887), 4326), '일몰이 아름다운 노지 차박'),
('고흥 나로도 우주발사전망대', 'CAMPING', '전남 고흥군 영남면', ST_SetSRID(ST_MakePoint(127.4688, 34.6187), 4326), '남해 다도해 조망'),
('통영 달아공원', 'CAMPING', '경남 통영시 산양읍', ST_SetSRID(ST_MakePoint(128.4189, 34.7887), 4326), '한려해상 국립공원 일몰'),
('남해 상주은모래비치', 'CAMPING', '경남 남해군 상주면', ST_SetSRID(ST_MakePoint(127.9988, 34.7387), 4326), '은빛 백사장과 송림'),
('밀양 표충사 야영장', 'CAMPING', '경남 밀양시 단장면', ST_SetSRID(ST_MakePoint(128.8410, 35.4887), 4326), '재약산 계곡 물놀이'),
('거제 학동 몽돌해변', 'CAMPING', '경남 거제시 동부면', ST_SetSRID(ST_MakePoint(128.6488, 34.8187), 4326), '파도 소리가 아름다운 몽돌해변'),
('포항 이가리 닻 전망대', 'CAMPING', '경북 포항시 북구 청하면', ST_SetSRID(ST_MakePoint(129.3988, 36.1987), 4326), '동해안 차박 명소'),
('울진 불영계곡', 'CAMPING', '경북 울진군 금강송면', ST_SetSRID(ST_MakePoint(129.2889, 36.9587), 4326), '한국의 그랜드캐년'),
('제주 함덕 서우봉 해변', 'CAMPING', '제주 제주시 조천읍', ST_SetSRID(ST_MakePoint(126.6698, 33.5432), 4326), '에메랄드빛 바다와 오름'),
('제주 표선 해비치 야영장', 'CAMPING', '제주 서귀포시 표선면', ST_SetSRID(ST_MakePoint(126.8311, 33.3255), 4326), '넓은 백사장과 잔디밭'),
('서귀포 쇠소깍', 'CAMPING', '제주 서귀포시 하효동', ST_SetSRID(ST_MakePoint(126.6233, 33.2512), 4326), '계곡과 바다가 만나는 곳'),
('부산 삼락생태공원', 'CAMPING', '부산 사상구 삼락동', ST_SetSRID(ST_MakePoint(128.9688, 35.1687), 4326), '낙동강변 넓은 잔디밭')
ON CONFLICT (name) DO NOTHING;

-- 3.3 어종 정보 (Fish Species)
INSERT INTO public.fish_species (korean_name, habitat_description, active_season) VALUES
('우럭', '서해안 대표 어종. 락피쉬(Rockfish)로 불리며 암초 지대 바닥층에 서식. 연중 낚시 가능하나 봄/가을 피크.', ARRAY['4월', '5월', '6월', '9월', '10월', '11월']),
('광어', '여름철 루어 다운샷의 주 대상어. 모래 바닥에 서식하며 웜(Worm) 루어에 반응이 좋음.', ARRAY['5월', '6월', '7월', '8월', '9월', '10월']),
('쭈꾸미', '가을(9~11월) 서해안 최고의 인기 어종. 에기(Egi)를 이용한 선상/워킹 낚시.', ARRAY['9월', '10월', '11월']),
('감성돔', '바다 낚시의 제왕. 경계심이 강하며 가을철 남해/서해 갯바위에서 크릴 미끼로 공략.', ARRAY['9월', '10월', '11월', '12월', '1월']),
('학꽁치', '가을/겨울철 방파제 표층을 회유. 입이 작아 작은 바늘과 곤쟁이 미끼 사용.', ARRAY['9월', '10월', '11월', '12월']),
('고등어', '가을철 회유성 어종. 카드 채비나 크릴을 이용해 마릿수 조과 가능.', ARRAY['8월', '9월', '10월', '11월']),
('갈치', '가을철 목포/여수 밤낚시의 꽃. 루어(지그헤드)나 생미끼(꽁치살) 사용.', ARRAY['8월', '9월', '10월', '11월']),
('방어', '겨울철 대물 루어낚시 대상어. 기장/제주에서 지깅으로 공략.', ARRAY['11월', '12월', '1월', '2월']),
('참돔', '바다의 여왕. 암초 지대.', ARRAY['5월', '6월', '7월', '9월', '10월']),
('농어', '파도를 타는 사냥꾼.', ARRAY['6월', '7월', '8월']),
('볼락', '밤의 제왕. 암초 지대.', ARRAY['12월', '1월', '2월', '3월', '4월']),
('무늬오징어', '에깅 낚시의 꽃.', ARRAY['8월', '9월', '10월']),
('갑오징어', '봄/가을 시즌.', ARRAY['4월', '5월', '9월', '10월', '11월']),
('붕장어', '원투 낚시. 야행성.', ARRAY['6월', '7월', '8월']),
('도다리', '봄 도다리. 원투 낚시.', ARRAY['3월', '4월', '5월']),
('삼치', '가을철 스피드 사냥꾼. 메탈지그.', ARRAY['9월', '10월', '11월']),
('망둥어', '가을철 생활 낚시.', ARRAY['9월', '10월', '11월']),
('한치', '여름철 제주 배낚시.', ARRAY['6월', '7월', '8월']),
('돌돔', '갯바위의 폭군.', ARRAY['6월', '7월', '8월', '9월']),
('쏘가리', '민물 루어의 제왕.', ARRAY['5월', '6월', '9월', '10월']),
('배스', '민물 루어 스포츠.', ARRAY['3월', '4월', '5월', '6월', '9월', '10월']),
('토종붕어', '민물 찌낚시.', ARRAY['3월', '4월', '5월', '9월', '10월'])
ON CONFLICT (korean_name) DO NOTHING;

-- 3.4 미끼 정보 (Baits)
INSERT INTO public.baits (name, category) VALUES
('갯지렁이 (청개비)', 'LIVE'),
('참갯지렁이 (혼무시)', 'LIVE'),
('크릴 (Krill)', 'LIVE'),
('오징어 살', 'LIVE'),
('미꾸라지', 'LIVE'),
('다운샷 웜 (Downshot Worm)', 'LURE'),
('그럽 웜 (Grub)', 'LURE'),
('메탈지그 (Metal Jig)', 'LURE'),
('에기 (Egi)', 'LURE'),
('에자 (Eja)', 'LURE'),
('카드채비 (Sabiki)', 'LURE'),
('곤쟁이', 'LIVE'),
('미노우 (Minnow)', 'LURE'),
('지그헤드 (Jighead)', 'LURE'),
('바이브레이션 (Vibration)', 'LURE')
ON CONFLICT (name) DO NOTHING;

-- 3.5 편의시설 및 낚시점 (Amenities)
INSERT INTO public.places (name, type, address, location, description) VALUES
('옥당 (몽산포)', 'AMENITY', '충남 태안군 몽산포 인근', ST_SetSRID(ST_MakePoint(126.2890, 36.6680), 4326), '연잎밥 맛집, 평점 4.8'),
('왕서방 중화요리', 'AMENITY', '충남 태안군 몽산포 인근', ST_SetSRID(ST_MakePoint(126.2860, 36.6650), 4326), '짜장면/짬뽕, 평점 4.5'),
('몽산포 주유소', 'AMENITY', '충남 태안군 남면 신장리', ST_SetSRID(ST_MakePoint(126.2900, 36.6700), 4326), '주유소 - 등유 판매'),
('선녀바위 낚시프라자', 'AMENITY', '인천 중구 을왕동 678-188', ST_SetSRID(ST_MakePoint(126.3730, 37.4565), 4326), '낚시 미끼/장비 판매'),
('가평 주유소', 'AMENITY', '경기 가평군 가평읍 가화로', ST_SetSRID(ST_MakePoint(127.5100, 37.8200), 4326), '24시 운영, 세차 가능'),
('가평 자라섬 편의점', 'AMENITY', '경기 가평군 가평읍 자라섬로', ST_SetSRID(ST_MakePoint(127.5150, 37.8175), 4326), '캠핑장 내 편의점, 장작 판매'),
('가평역 마트', 'AMENITY', '경기 가평군 가평읍 문화로', ST_SetSRID(ST_MakePoint(127.5110, 37.8140), 4326), '대형 마트, 고기/채소 판매'),
('몽산포 24시 편의점', 'AMENITY', '충남 태안군 남면 몽산포길', ST_SetSRID(ST_MakePoint(126.2880, 36.6675), 4326), '폭죽, 갯벌 체험 도구 판매'),
('태안 로컬푸드 직매장', 'AMENITY', '충남 태안군 남면', ST_SetSRID(ST_MakePoint(126.2950, 36.6600), 4326), '신선한 해산물과 채소')
ON CONFLICT (name) DO NOTHING;

-- 3.6 캠핑 장비 및 레시피 (Gear & Recipes)
INSERT INTO public.camping_gear (name, category, is_essential_for_winter) VALUES
('평탄화 매트', 'SLEEPING', FALSE),
('차량용 암막 커튼', 'SLEEPING', FALSE),
('동계 침낭 (-15도)', 'SLEEPING', TRUE),
('등유 난로 (파세코)', 'UTILITY', TRUE),
('구이바다 (가스버너)', 'KITCHEN', FALSE),
('화로대', 'KITCHEN', FALSE),
('타프', 'SHELTER', FALSE),
('릴선', 'UTILITY', FALSE),
('샌드 팩 (Sand Peg)', 'SHELTER', FALSE),
('윈드 스크린', 'SHELTER', TRUE);

INSERT INTO public.camping_recipes (name, ingredients, cooking_method, difficulty_level, best_season) VALUES
('캠핑 닭꼬치', ARRAY['닭다리살', '대파', '데리야끼소스'], '숯불이나 구이바다에 천천히 굽기', 2, 'Summer'),
('낙곱새 밀키트', ARRAY['낙지', '곱창', '새우', '양념장'], '그리들에 재료 넣고 끓이기', 1, 'Autumn'),
('어묵탕', ARRAY['꼬치어묵', '무', '국간장', '청양고추'], '추운 날씨에 난로 위에서 끓여 먹기', 1, 'Winter'),
('밀푀유나베', ARRAY['알배추', '깻잎', '소고기', '육수'], '냄비에 겹겹이 쌓아 끓임', 3, 'Winter');

-- [4] 관계 데이터 매핑 (Linking & Enrichment)

-- 4.1 편의시설 상세 정보 연결
INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'BAIT_SHOP', 4.5, '05:00 - 22:00', '청개비, 크릴, 묶음추' FROM public.places WHERE name = '선녀바위 낚시프라자'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'RESTAURANT', 4.8, '11:00 - 20:00', '연잎밥 정식' FROM public.places WHERE name = '옥당 (몽산포)'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'RESTAURANT', 4.5, '10:00 - 21:00', '해물짬뽕' FROM public.places WHERE name = '왕서방 중화요리'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'GAS_STATION', 4.0, '06:00 - 23:00', '등유 판매' FROM public.places WHERE name = '몽산포 주유소'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'GAS_STATION', 4.2, '24시간', '자동세차' FROM public.places WHERE name = '가평 주유소'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'CONVENIENCE_STORE', 3.8, '07:00 - 24:00', '장작, 얼음' FROM public.places WHERE name = '가평 자라섬 편의점'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'CONVENIENCE_STORE', 4.5, '09:00 - 22:00', '바베큐 고기 세트' FROM public.places WHERE name = '가평역 마트'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'CONVENIENCE_STORE', 4.0, '24시간', '갯벌 호미, 폭죽' FROM public.places WHERE name = '몽산포 24시 편의점'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.amenity_details (place_id, category, rating, operating_hours, signature_menu)
SELECT id, 'CONVENIENCE_STORE', 4.7, '09:00 - 19:00', '서해안 꽃게' FROM public.places WHERE name = '태안 로컬푸드 직매장'
ON CONFLICT (place_id) DO NOTHING;

-- 4.2 캠핑장 상세 정보 매핑
INSERT INTO public.camping_spot_details 
(place_id, camp_type, floor_type, has_electricity, has_hot_water, has_wifi, is_pet_friendly, base_fee, check_in_time, check_out_time)
SELECT id, 'AUTO_CAMPING', 'GRASS', TRUE, TRUE, FALSE, TRUE, 35000, '14:00', '11:00' FROM public.places WHERE name = '가평 자라섬 캠핑장'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.camping_spot_details 
(place_id, camp_type, floor_type, has_electricity, has_hot_water, has_wifi, is_pet_friendly, base_fee, check_in_time, check_out_time)
SELECT id, 'AUTO_CAMPING', 'SAND', TRUE, TRUE, FALSE, TRUE, 30000, '13:00', '12:00' FROM public.places WHERE name = '태안 몽산포 캠핑장'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.camping_spot_details 
(place_id, camp_type, floor_type, has_electricity, has_hot_water, has_wifi, is_pet_friendly, base_fee, check_in_time, check_out_time)
SELECT id, 'CAR_CAMPING', 'CRUSHED_STONE', FALSE, FALSE, FALSE, TRUE, 0, '00:00', '00:00' FROM public.places WHERE name = '홍천 모곡밤벌유원지'
ON CONFLICT (place_id) DO NOTHING;

INSERT INTO public.camping_spot_details 
(place_id, camp_type, floor_type, has_electricity, has_hot_water, has_wifi, is_pet_friendly, base_fee, check_in_time, check_out_time)
SELECT id, 'GLAMPING', 'DECK', TRUE, TRUE, TRUE, FALSE, 150000, '15:00', '11:00' FROM public.places WHERE name = '제천 닷돈재 야영장'
ON CONFLICT (place_id) DO NOTHING;

-- 4.3 장소별 장비 추천 매핑
-- 자라섬 (강변/겨울)
INSERT INTO public.spot_gear_recommendation (place_id, gear_id, reason)
SELECT p.id, g.id, '강변이라 밤 기온이 급격히 떨어집니다.'
FROM public.places p, public.camping_gear g
WHERE p.name = '가평 자라섬 캠핑장' AND g.name = '동계 침낭 (-15도)'
ON CONFLICT (place_id, gear_id) DO NOTHING;

INSERT INTO public.spot_gear_recommendation (place_id, gear_id, reason)
SELECT p.id, g.id, '전기 사용이 가능하므로 팬히터나 난로 사용 권장.'
FROM public.places p, public.camping_gear g
WHERE p.name = '가평 자라섬 캠핑장' AND g.name = '등유 난로 (파세코)'
ON CONFLICT (place_id, gear_id) DO NOTHING;

-- 몽산포 (모래사장/바람)
INSERT INTO public.spot_gear_recommendation (place_id, gear_id, reason)
SELECT p.id, g.id, '그늘이 부족할 수 있어 타프가 필수입니다.'
FROM public.places p, public.camping_gear g
WHERE p.name = '태안 몽산포 캠핑장' AND g.name = '타프'
ON CONFLICT (place_id, gear_id) DO NOTHING;

INSERT INTO public.spot_gear_recommendation (place_id, gear_id, reason)
SELECT p.id, g.id, '모래 지형이므로 30cm 이상의 샌드팩 사용 권장.'
FROM public.places p, public.camping_gear g
WHERE p.name = '태안 몽산포 캠핑장' AND g.name = '샌드 팩 (Sand Peg)'
ON CONFLICT (place_id, gear_id) DO NOTHING;

-- 모곡밤벌 (자갈/노지)
INSERT INTO public.spot_gear_recommendation (place_id, gear_id, reason)
SELECT p.id, g.id, '바닥이 자갈이라 화로대 사용하기 좋습니다.'
FROM public.places p, public.camping_gear g
WHERE p.name = '홍천 모곡밤벌유원지' AND g.name = '화로대'
ON CONFLICT (place_id, gear_id) DO NOTHING;

-- 4.4 어종별 추천 미끼 매핑 (Samples)
-- 우럭: 갯지렁이, 오징어살
INSERT INTO public.species_bait_map (species_id, bait_id, effectiveness_rating)
SELECT s.id, b.id, 5
FROM public.fish_species s, public.baits b
WHERE s.korean_name = '우럭' AND b.name IN ('갯지렁이 (청개비)', '오징어 살')
ON CONFLICT DO NOTHING;

-- 쭈꾸미: 에기, 에자
INSERT INTO public.species_bait_map (species_id, bait_id, effectiveness_rating)
SELECT s.id, b.id, 5
FROM public.fish_species s, public.baits b
WHERE s.korean_name = '쭈꾸미' AND b.name IN ('에기 (Egi)', '에자 (Eja)')
ON CONFLICT DO NOTHING;

-- 광어: 다운샷 웜
INSERT INTO public.species_bait_map (species_id, bait_id, effectiveness_rating)
SELECT s.id, b.id, 5
FROM public.fish_species s, public.baits b
WHERE s.korean_name = '광어' AND b.name = '다운샷 웜 (Downshot Worm)'
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- [5] 장소-어종 매핑 (Location-Species Mapping)
-- 낚시 포인트에서 잡을 수 있는 어종 연결
-- ==============================================================================

-- 을왕리 선녀바위
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '연중 (봄/가을 피크)'
FROM public.places p, public.fish_species s
WHERE p.name = '을왕리 선녀바위' AND s.korean_name = '우럭'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '여름철'
FROM public.places p, public.fish_species s
WHERE p.name = '을왕리 선녀바위' AND s.korean_name = '광어'
ON CONFLICT DO NOTHING;

-- 궁평항 피싱피어
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철 (9-11월)'
FROM public.places p, public.fish_species s
WHERE p.name = '궁평항 피싱피어' AND s.korean_name = '망둥어'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '연중'
FROM public.places p, public.fish_species s
WHERE p.name = '궁평항 피싱피어' AND s.korean_name = '우럭'
ON CONFLICT DO NOTHING;

-- 시화방조제
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '연중'
FROM public.places p, public.fish_species s
WHERE p.name = '시화방조제' AND s.korean_name = '우럭'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철'
FROM public.places p, public.fish_species s
WHERE p.name = '시화방조제' AND s.korean_name = '삼치'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '여름철'
FROM public.places p, public.fish_species s
WHERE p.name = '시화방조제' AND s.korean_name = '광어'
ON CONFLICT DO NOTHING;

-- 무의도 광명항
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '봄/가을'
FROM public.places p, public.fish_species s
WHERE p.name = '무의도 광명항' AND s.korean_name = '갑오징어'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철 (9-11월)'
FROM public.places p, public.fish_species s
WHERE p.name = '무의도 광명항' AND s.korean_name = '쭈꾸미'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '여름철'
FROM public.places p, public.fish_species s
WHERE p.name = '무의도 광명항' AND s.korean_name = '광어'
ON CONFLICT DO NOTHING;

-- 보령 대천항
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철 메카 (9-11월)'
FROM public.places p, public.fish_species s
WHERE p.name = '보령 대천항' AND s.korean_name = '쭈꾸미'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '봄/가을'
FROM public.places p, public.fish_species s
WHERE p.name = '보령 대천항' AND s.korean_name = '갑오징어'
ON CONFLICT DO NOTHING;

-- 주문진항 방파제
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을/겨울철'
FROM public.places p, public.fish_species s
WHERE p.name = '주문진항 방파제' AND s.korean_name = '감성돔'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철'
FROM public.places p, public.fish_species s
WHERE p.name = '주문진항 방파제' AND s.korean_name = '고등어'
ON CONFLICT DO NOTHING;

-- 목포 북항
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철 밤낚시'
FROM public.places p, public.fish_species s
WHERE p.name = '목포 북항' AND s.korean_name = '갈치'
ON CONFLICT DO NOTHING;

-- 부산 기장 죽성성당
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '여름철'
FROM public.places p, public.fish_species s
WHERE p.name = '부산 기장 죽성성당' AND s.korean_name = '농어'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철'
FROM public.places p, public.fish_species s
WHERE p.name = '부산 기장 죽성성당' AND s.korean_name = '무늬오징어'
ON CONFLICT DO NOTHING;

-- 여수 국동항
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '봄/가을 성지'
FROM public.places p, public.fish_species s
WHERE p.name = '여수 국동항' AND s.korean_name = '갑오징어'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철'
FROM public.places p, public.fish_species s
WHERE p.name = '여수 국동항' AND s.korean_name = '쭈꾸미'
ON CONFLICT DO NOTHING;

-- 제주 차귀도 포구
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '여름철'
FROM public.places p, public.fish_species s
WHERE p.name = '제주 차귀도 포구' AND s.korean_name = '돌돔'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철'
FROM public.places p, public.fish_species s
WHERE p.name = '제주 차귀도 포구' AND s.korean_name = '고등어'
ON CONFLICT DO NOTHING;

-- 통영 척포방파제
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '겨울~봄 밤낚시'
FROM public.places p, public.fish_species s
WHERE p.name = '통영 척포방파제' AND s.korean_name = '볼락'
ON CONFLICT DO NOTHING;

-- 거제 지세포항
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '봄~가을'
FROM public.places p, public.fish_species s
WHERE p.name = '거제 지세포항' AND s.korean_name = '참돔'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을/겨울'
FROM public.places p, public.fish_species s
WHERE p.name = '거제 지세포항' AND s.korean_name = '감성돔'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을철'
FROM public.places p, public.fish_species s
WHERE p.name = '거제 지세포항' AND s.korean_name = '무늬오징어'
ON CONFLICT DO NOTHING;

-- 남해 미조항
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '가을/겨울 성지'
FROM public.places p, public.fish_species s
WHERE p.name = '남해 미조항' AND s.korean_name = '감성돔'
ON CONFLICT DO NOTHING;

INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '겨울~봄'
FROM public.places p, public.fish_species s
WHERE p.name = '남해 미조항' AND s.korean_name = '볼락'
ON CONFLICT DO NOTHING;

-- 예당저수지 (민물)
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '봄/가을'
FROM public.places p, public.fish_species s
WHERE p.name = '예당저수지' AND s.korean_name = '토종붕어'
ON CONFLICT DO NOTHING;

-- 안동호 (민물)
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '봄~가을'
FROM public.places p, public.fish_species s
WHERE p.name = '안동호' AND s.korean_name = '배스'
ON CONFLICT DO NOTHING;

-- 춘천 의암호 (민물)
INSERT INTO public.location_species_map (place_id, species_id, season_specific)
SELECT p.id, s.id, '봄~가을'
FROM public.places p, public.fish_species s
WHERE p.name = '춘천 의암호' AND s.korean_name = '배스'
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- END OF SCRIPT
-- ==============================================================================