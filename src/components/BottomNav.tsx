import './BottomNav.css';

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
    const tabs = [
        { id: 'ALL', label: '전체', icon: '🏞️' },
        { id: 'CAMPING', label: '캠핑', icon: '⛺' }, // Updated icon for consistency
        { id: 'FISHING', label: '낚시', icon: '🎣' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    <span className="nav-icon">{tab.icon}</span>
                    <span className="nav-label">{tab.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default BottomNav;
