# -*- coding: utf-8 -*-
"""
CamFish AI Data Collector
=========================
웹 검색을 통해 낚시/캠핑 정보를 수집하고 Gemini로 분석하여 Supabase에 저장합니다.

사용법:
    python data_collector.py

환경 변수 (또는 .env 파일):
    - GEMINI_API_KEY: Google Gemini API 키
    - SUPABASE_URL: Supabase 프로젝트 URL
    - SUPABASE_KEY: Supabase anon/service key
"""

import os
import re
import json
import time
import uuid
from typing import List, Dict, Any, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Gemini & Supabase 라이브러리
import google.generativeai as genai
from supabase import create_client, Client

# DuckDuckGo 검색 (무료)
from duckduckgo_search import DDGS


# ==============================================================================
# 환경 설정
# ==============================================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_KEY") or os.getenv("SUPABASE_KEY")

if not GEMINI_API_KEY:
    raise EnvironmentError("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise EnvironmentError("SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않았습니다.")

# Gemini 설정
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# Supabase 클라이언트
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# HTTP 헤더 (크롤링 차단 방지)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
}


# ==============================================================================
# 검색어 목록
# ==============================================================================

SEARCH_QUERIES = [
    # 낚시 포인트
    "송정 해수욕장 낚시 포인트",
    "태안 몽산포 해변 낚시",
    "시화방조제 낚시 포인트",
    "을왕리 선녀바위 우럭 낚시",
    "궁평항 피싱피어 망둥어",
    "강릉 주문진 방파제 낚시",
    "부산 기장 갯바위 낚시",
    "여수 돌산도 감성돔",
    "제주 서귀포 낚시 포인트",
    "대천해수욕장 낚시",
    # 캠핑장
    "가평 자라섬 캠핑장",
    "태안 몽산포 캠핑",
    "강릉 경포대 오토캠핑",
    "속초 영랑호 캠핑",
    "양양 서피비치 캠핑",
]


# ==============================================================================
# 웹 검색 (DuckDuckGo)
# ==============================================================================

def search_web(query: str, max_results: int = 5) -> List[str]:
    """
    DuckDuckGo로 검색하여 상위 URL들을 반환합니다.
    """
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, region='kr-kr', max_results=max_results))
            urls = [r['href'] for r in results if 'href' in r]
            print(f"  🔍 '{query}' → {len(urls)}개 URL 발견")
            return urls
    except Exception as e:
        print(f"  ⚠️ 검색 실패: {e}")
        return []


# ==============================================================================
# 웹페이지 스크래핑
# ==============================================================================

def scrape_page(url: str, timeout: int = 10) -> Optional[str]:
    """
    URL에서 본문 텍스트를 추출합니다.
    """
    try:
        response = requests.get(url, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
        response.encoding = 'utf-8'
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 스크립트, 스타일 태그 제거
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
            tag.decompose()
        
        # 본문 텍스트 추출 (article 또는 main 태그 우선)
        main_content = soup.find('article') or soup.find('main') or soup.find('div', class_=re.compile(r'content|post|entry'))
        if main_content:
            text = main_content.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)
        
        # 텍스트 정리 (너무 긴 경우 자르기)
        text = re.sub(r'\n{3,}', '\n\n', text)  # 과도한 줄바꿈 제거
        text = text[:8000]  # Gemini 컨텍스트 제한 고려
        
        return text if len(text) > 100 else None
        
    except Exception as e:
        print(f"    ⚠️ 스크래핑 실패 ({url[:50]}...): {e}")
        return None


# ==============================================================================
# Gemini AI 분석
# ==============================================================================

EXTRACTION_PROMPT = """
당신은 한국의 낚시/캠핑 정보를 분석하는 전문가입니다.
아래 텍스트에서 다음 정보를 추출하여 **JSON 형식**으로 반환해주세요.

추출할 정보:
1. place_name: 장소명 (예: "을왕리 선녀바위", "몽산포 해수욕장")
2. place_type: "FISHING" 또는 "CAMPING" (낚시 관련이면 FISHING, 캠핑 관련이면 CAMPING)
3. address: 주소 (없으면 빈 문자열)
4. lat: 추정 위도 (숫자, 없으면 null)
5. lng: 추정 경도 (숫자, 없으면 null)
6. description: 장소 설명 (50자 이내)
7. fish_species: 주요 어종 배열 (낚시인 경우만, 예: ["우럭", "광어", "노래미"])
8. recommended_baits: 추천 미끼 배열 (낚시인 경우만, 예: ["갯지렁이", "크릴새우"])
9. nearby_places: 주변 편의시설/낚시점 배열 [{name, type, address}] (type: "BAIT_SHOP", "RESTAURANT", "CONVENIENCE_STORE")

응답은 반드시 유효한 JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 반환해주세요.
텍스트에서 정보를 찾을 수 없으면 해당 필드를 빈 값 또는 null로 설정하세요.

텍스트:
---
{text}
---

JSON 응답:
"""

def analyze_with_gemini(text: str, query: str) -> Optional[Dict[str, Any]]:
    """
    Gemini를 사용하여 텍스트에서 낚시/캠핑 정보를 추출합니다.
    """
    try:
        prompt = EXTRACTION_PROMPT.format(text=text)
        response = model.generate_content(prompt)
        
        # JSON 파싱
        raw_text = response.text.strip()
        
        # 마크다운 코드블록 제거
        if raw_text.startswith('```'):
            raw_text = re.sub(r'^```(?:json)?\n?', '', raw_text)
            raw_text = re.sub(r'\n?```$', '', raw_text)
        
        data = json.loads(raw_text)
        
        # 필수 필드 검증
        if not data.get('place_name'):
            # 검색어에서 장소명 추출 시도
            data['place_name'] = query.split()[0] if query else None
        
        return data
        
    except json.JSONDecodeError as e:
        print(f"    ⚠️ JSON 파싱 실패: {e}")
        return None
    except Exception as e:
        print(f"    ⚠️ Gemini 분석 실패: {e}")
        return None


# ==============================================================================
# Supabase 저장
# ==============================================================================

def check_place_exists(place_name: str) -> bool:
    """
    DB에 해당 장소가 이미 존재하는지 확인합니다.
    """
    try:
        result = supabase.table('places').select('id').eq('name', place_name).execute()
        return len(result.data) > 0
    except Exception:
        return False


def save_to_database(data: Dict[str, Any]) -> bool:
    """
    추출된 데이터를 Supabase에 저장합니다.
    """
    place_name = data.get('place_name')
    if not place_name:
        print("    ⚠️ 장소명이 없어 저장을 건너뜁니다.")
        return False
    
    # 이미 존재하는지 확인
    if check_place_exists(place_name):
        print(f"    ℹ️ '{place_name}'은(는) 이미 DB에 존재합니다. 건너뜀.")
        return False
    
    try:
        # 1. places 테이블에 저장
        place_data = {
            'name': place_name,
            'type': data.get('place_type', 'FISHING'),
            'address': data.get('address', ''),
            'description': data.get('description', ''),
        }
        
        # 좌표가 있으면 PostGIS Point로 변환
        lat = data.get('lat')
        lng = data.get('lng')
        if lat and lng:
            place_data['location'] = f"SRID=4326;POINT({lng} {lat})"
        
        result = supabase.table('places').insert(place_data).execute()
        
        if not result.data:
            print(f"    ⚠️ places 저장 실패")
            return False
        
        place_id = result.data[0]['id']
        print(f"    ✅ '{place_name}' 저장 완료 (ID: {place_id[:8]}...)")
        
        # 2. 어종 정보 저장 (fish_species + location_species_map)
        fish_species = data.get('fish_species', [])
        for species_name in fish_species:
            save_fish_species(species_name, place_id)
        
        # 3. 주변 시설 저장
        nearby_places = data.get('nearby_places', [])
        for nearby in nearby_places:
            save_nearby_place(nearby, lat, lng)
        
        return True
        
    except Exception as e:
        print(f"    ⚠️ DB 저장 실패: {e}")
        return False


def save_fish_species(species_name: str, place_id: str):
    """
    어종을 fish_species 테이블에 저장하고 location_species_map에 연결합니다.
    """
    try:
        # 이미 존재하는지 확인
        result = supabase.table('fish_species').select('id').eq('korean_name', species_name).execute()
        
        if result.data:
            species_id = result.data[0]['id']
        else:
            # 새 어종 추가
            new_species = {
                'korean_name': species_name,
                'scientific_name': '',
                'habitat': 'SALTWATER',  # 기본값
                'active_months': [1,2,3,4,5,6,7,8,9,10,11,12],
            }
            insert_result = supabase.table('fish_species').insert(new_species).execute()
            if not insert_result.data:
                return
            species_id = insert_result.data[0]['id']
        
        # location_species_map에 연결
        mapping = {
            'place_id': place_id,
            'species_id': species_id,
            'season_specific': '연중',
        }
        supabase.table('location_species_map').upsert(mapping, on_conflict='place_id,species_id').execute()
        
    except Exception as e:
        print(f"      ⚠️ 어종 저장 실패 ({species_name}): {e}")


def save_nearby_place(nearby: Dict[str, Any], base_lat: float = None, base_lng: float = None):
    """
    주변 편의시설을 places 테이블에 저장합니다.
    """
    name = nearby.get('name')
    if not name or check_place_exists(name):
        return
    
    try:
        place_data = {
            'name': name,
            'type': 'AMENITY',
            'address': nearby.get('address', ''),
            'description': f"{nearby.get('type', '편의시설')}",
        }
        
        # 기준 좌표에서 약간 오프셋 (정확한 좌표 없을 때)
        if base_lat and base_lng:
            import random
            offset = random.uniform(-0.01, 0.01)
            place_data['location'] = f"SRID=4326;POINT({base_lng + offset} {base_lat + offset})"
        
        supabase.table('places').insert(place_data).execute()
        
    except Exception as e:
        print(f"      ⚠️ 주변시설 저장 실패 ({name}): {e}")


# ==============================================================================
# 메인 실행
# ==============================================================================

def process_query(query: str) -> int:
    """
    단일 검색어를 처리합니다.
    반환: 저장된 장소 수
    """
    print(f"\n{'='*60}")
    print(f"🔎 검색어: {query}")
    print('='*60)
    
    # 1. 웹 검색
    urls = search_web(query, max_results=5)
    if not urls:
        return 0
    
    # 2. 각 URL 스크래핑 및 분석
    saved_count = 0
    combined_text = ""
    
    for i, url in enumerate(urls[:3], 1):  # 상위 3개만 처리
        print(f"  [{i}] {url[:60]}...")
        text = scrape_page(url)
        if text:
            combined_text += f"\n\n---출처 {i}---\n{text}"
            time.sleep(1)  # 서버 부하 방지
    
    if not combined_text:
        print("  ⚠️ 유효한 텍스트를 추출하지 못했습니다.")
        return 0
    
    # 3. AI 분석
    print("  🤖 Gemini 분석 중...")
    data = analyze_with_gemini(combined_text, query)
    
    if data:
        # 4. DB 저장
        if save_to_database(data):
            saved_count += 1
    
    return saved_count


def main():
    """
    메인 실행 함수
    """
    print("="*60)
    print("🎣 CamFish AI Data Collector 시작")
    print("="*60)
    print(f"📋 검색어 수: {len(SEARCH_QUERIES)}개")
    print(f"🔗 Supabase: {SUPABASE_URL[:40]}...")
    
    total_saved = 0
    
    for query in SEARCH_QUERIES:
        try:
            saved = process_query(query)
            total_saved += saved
            time.sleep(2)  # API 속도 제한 방지
        except KeyboardInterrupt:
            print("\n\n⚠️ 사용자에 의해 중단됨")
            break
        except Exception as e:
            print(f"  ❌ 오류 발생: {e}")
            continue
    
    print("\n" + "="*60)
    print(f"✅ 완료! 총 {total_saved}개 장소가 새로 저장되었습니다.")
    print("="*60)


if __name__ == "__main__":
    main()
