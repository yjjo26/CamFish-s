-- 1. 장소 테이블 (낚시/캠핑 스팟)
CREATE TABLE IF NOT EXISTS spots (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  geom geometry(POINT,4326) NOT NULL,
  point_type TEXT NOT NULL,          -- "fishing" | "camping"
  season TEXT,
  species TEXT[],
  gear TEXT[],
  bait TEXT[],
  campsite_area NUMERIC,
  food_places TEXT[],
  activity TEXT[],
  cleaning_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
