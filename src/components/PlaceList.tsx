// src/components/PlaceList.tsx

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // Supabase 클라이언트 임포트

interface Place {
  id: string;
  name: string;
  type: 'FISHING' | 'CAMPING' | 'AMENITY' | 'TOURIST_SPOT';
  address?: string;
  description?: string;
  lat?: number;
  lng?: number;
  desc?: string;
}

const PlaceList: React.FC = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        const { data, error } = await supabase
          .from('spots')
          .select('id, name, spot_type, address, lat, lng'); // 스키마에 있는 컬럼만 선택

        if (error) {
          throw error;
        }

        // 데이터 매핑
        const mappedPlaces: Place[] = (data || []).map((spot: any) => ({
          id: spot.id,
          name: spot.name,
          type: spot.spot_type as Place['type'], // spot_type을 Place의 type으로 매핑
          address: spot.address || '',
          lat: spot.lat || 0,
          lng: spot.lng || 0,
          desc: '', // 현재는 빈 문자열로 초기화, 필요시 DB에서 가져오도록 수정
          image_url: undefined // 현재는 undefined로 초기화, 필요시 DB에서 가져오도록 수정
        }));

        setPlaces(mappedPlaces);
      } catch (err: any) {
        console.error('Error fetching places:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaces();
  }, []);

  if (loading) {
    return <div>로딩 중...</div>;
  }

  if (error) {
    return <div>오류 발생: {error}</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>장소 목록 ({places.length}개)</h2>
      {places.length === 0 ? (
        <p>표시할 장소가 없습니다. Supabase 'spots' 테이블에 데이터를 추가해 보세요!</p>
      ) : (
        <ul>
          {places.map((place) => (
            <li key={place.id}>
              <strong>{place.name}</strong> ({place.type}) - {place.address} (Lat: {place.lat}, Lng: {place.lng})
              {place.desc && <p>{place.desc}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlaceList;
