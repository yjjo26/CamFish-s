import { useState } from 'react';
import Map from './components/Map';
import RouteSearchPanel from './components/RouteSearchPanel';
import BottomNav from './components/BottomNav';
import './App.css';

function App() {
    const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
    // Unified State: 'ALL' | 'CAMPING' | 'FISHING' | 'NONE'
    const [activeCategory, setActiveCategory] = useState<'ALL' | 'NONE' | 'FISHING' | 'CAMPING'>('ALL');

    // Bottom Sheet Expansion State
    const [isSheetExpanded, setIsSheetExpanded] = useState(false);

    return (
        <div className="app-container">
            <Map
                onMapLoad={setMapInstance}
                onMapClick={() => {
                    // If map is clicked while sheet is expanded, close it
                    if (isSheetExpanded) setIsSheetExpanded(false);
                }}
            />
            <RouteSearchPanel
                map={mapInstance}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                isExpanded={isSheetExpanded}
                onExpandChange={setIsSheetExpanded}
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
