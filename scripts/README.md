# CamFish AI Data Collector

웹 검색을 통해 낚시/캠핑 정보를 자동으로 수집하고 Supabase에 저장하는 Python 스크립트입니다.

## 🛠️ 설치

1. **Python 가상환경 생성** (권장)
```bash
cd scripts
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux
```

2. **의존성 설치**
```bash
pip install -r requirements.txt
```

## 🚀 실행

```bash
cd scripts
python data_collector.py
```

## ⚙️ 환경 변수

프로젝트 루트의 `.env` 파일에서 자동으로 읽습니다:
- `VITE_GEMINI_API_KEY`: Gemini API 키
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_KEY`: Supabase anon key

## 📋 검색어 수정

`data_collector.py` 파일 상단의 `SEARCH_QUERIES` 리스트를 수정하여 검색할 키워드를 추가/변경할 수 있습니다.

```python
SEARCH_QUERIES = [
    "송정 해수욕장 낚시 포인트",
    "태안 몽산포 해변 낚시",
    # 원하는 검색어 추가...
]
```

## 🔄 동작 흐름

1. **웹 검색**: DuckDuckGo로 검색어 관련 URL 수집
2. **스크래핑**: 각 URL의 본문 텍스트 추출
3. **AI 분석**: Gemini가 장소명, 좌표, 어종, 미끼 정보 추출
4. **DB 저장**: Supabase `places`, `fish_species`, `location_species_map` 테이블에 저장

## ⚠️ 주의사항

- 웹 크롤링 시 서버 부하를 줄이기 위해 요청 간 딜레이가 있습니다.
- Gemini API 일일 할당량에 주의하세요.
- 이미 DB에 존재하는 장소는 자동으로 건너뜁니다.
