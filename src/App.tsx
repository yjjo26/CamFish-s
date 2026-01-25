import { useState } from 'react';
import Map from './components/Map';
import RouteSearchPanel from './components/RouteSearchPanel';
import BottomNav from './components/BottomNav';
import './App.css';

function App() {
    const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
    // Unified State: 'ALL' | 'CAMPING' | 'FISHING' | 'NONE'
    const [activeCategory, setActiveCategory] = useState<'ALL' | 'NONE' | 'FISHING' | 'CAMPING'>('ALL');

    return (
        <div className="app-container">
            <Map onMapLoad={setMapInstance} />
            <RouteSearchPanel
                map={mapInstance}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
            />
            <BottomNav
                activeTab={activeCategory}
                onTabChange={(tab) => {
                    setActiveCategory(tab as 'NONE' | 'FISHING' | 'CAMPING');
                }}
            />
        </div>
    );
}

export default App;
