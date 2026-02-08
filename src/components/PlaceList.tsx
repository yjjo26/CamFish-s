// src/components/PlaceList.tsx

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // Supabase 클라이언트 임포트

interface Place {
  id: string;
  name: string;
  type: 'FISHING' | 'CAMPING' | 'AMENITY' | 'TOURIST_SPOT';
  address?: string;
  description?: string;
}

const PlaceList: React.FC = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        const { data, error } = await supabase
          .from('places')
          .select('id, name, type, address, description'); // 스키마에 있는 컬럼만 선택

        if (error) {
          throw error;
        }
        setPlaces(data || []);
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
        <p>표시할 장소가 없습니다. Supabase 'places' 테이블에 데이터를 추가해 보세요!</p>
      ) : (
        <ul>
          {places.map((place) => (
            <li key={place.id}>
              <strong>{place.name}</strong> ({place.type}) {place.address && `- ${place.address}`}
              {place.description && <p>{place.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlaceList;
