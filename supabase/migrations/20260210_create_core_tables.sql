-- Migration: Create core tables for points, ecosystem, stores

-- 1. points table
CREATE TABLE IF NOT EXISTS public.points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('FISHING','CAMPING')),
  address TEXT,
  location GEOGRAPHY(POINT,4326) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS points_location_gist ON public.points USING GIST (location);

-- 2. ecosystem table (metadata per point)
CREATE TABLE IF NOT EXISTS public.ecosystem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id UUID REFERENCES public.points(id) ON DELETE CASCADE,
  season TEXT[],
  species TEXT[],
  gear TEXT[],
  baits TEXT[],
  stores JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. stores table
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id UUID REFERENCES public.points(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  category TEXT,
  rating NUMERIC(2,1),
  opening_hours TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
