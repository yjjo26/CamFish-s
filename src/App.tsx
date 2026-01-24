import { useState } from 'react';
import Map from './components/Map';
import RouteSearchPanel from './components/RouteSearchPanel';
import BottomNav from './components/BottomNav';
import './App.css';

function App() {
    const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
    const [activeTab, setActiveTab] = useState('explore');

    return (
        <div className="app-container">
            <Map onMapLoad={setMapInstance} />
            <RouteSearchPanel map={mapInstance} />
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );
}

export default App;
