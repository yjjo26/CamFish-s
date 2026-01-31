import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Map from './components/Map';
import RouteSearchPanel from './components/RouteSearchPanel';
import BottomNav from './components/BottomNav';
import AuthPage from './components/AuthPage';
import './App.css';

// Main App Content
function MainApp() {
    const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
    const [activeCategory, setActiveCategory] = useState<'ALL' | 'NONE' | 'FISHING' | 'CAMPING'>('ALL');
    const [isSheetExpanded, setIsSheetExpanded] = useState(false);
    const [showAuthPage, setShowAuthPage] = useState(false);

    return (
        <div className="app-container">
            <Map
                onMapLoad={setMapInstance}
                onMapClick={() => {
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
                onLoginClick={() => setShowAuthPage(true)}
            />

            {/* Auth Page Overlay */}
            {showAuthPage && (
                <AuthPage onClose={() => setShowAuthPage(false)} />
            )}
        </div>
    );
}

// App Router (No longer requires auth)
function AppRouter() {
    const { loading } = useAuth();

    // Show loading state briefly on initial load
    if (loading) {
        return (
            <div className="app-loading">
                <div className="loading-content">
                    <span className="loading-logo">🎣⛺</span>
                    <span className="loading-text">로딩 중...</span>
                </div>
            </div>
        );
    }

    // Always show main app (no login required)
    return <MainApp />;
}

// Root App with Provider
function App() {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    );
}

export default App;
