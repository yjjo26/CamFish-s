import { useAuth } from '../contexts/AuthContext';
import './BottomNav.css';

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLoginClick?: () => void;
}

const CampingIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3L3 20h18L12 3z" />
        <path d="M12 3v17" />
        <path d="M9 14l3-3 3 3" />
    </svg>
);

const FishingIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v12" />
        <path d="M12 14a4 4 0 1 0 8 0v-2" />
        <path d="M7 8l5-3 5 3" />
        <circle cx="12" cy="18" r="1" />
    </svg>
);

const CleanupIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 6L18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M3 6h18" />
        <path d="M9 6V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#007AFF" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const BottomNav = ({ activeTab, onTabChange, onLoginClick }: BottomNavProps) => {
    const { user, signOut } = useAuth();

    const tabs = [
        { id: 'CAMPING', label: '캠핑', Icon: CampingIcon },
        { id: 'FISHING', label: '낚시', Icon: FishingIcon },
        { id: 'CLEANUP', label: '청소', Icon: CleanupIcon },
    ];

    const handleAuthClick = () => {
        if (user) {
            if (confirm('로그아웃 하시겠습니까?')) {
                signOut();
            }
        } else {
            onLoginClick?.();
        }
    };

    return (
        <nav className="bottom-nav">
            <div className="nav-blur-layer" />
            <div className="nav-content">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        <span className="nav-icon">
                            <tab.Icon active={activeTab === tab.id} />
                        </span>
                        <span className="nav-label">{tab.label}</span>
                    </button>
                ))}
                {/* Profile */}
                <button className={`nav-item profile ${user ? 'logged-in' : ''}`} onClick={handleAuthClick}>
                    <span className="nav-icon">
                        <ProfileIcon active={!!user} />
                    </span>
                    <span className="nav-label">
                        {user ? '마이페이지' : '로그인'}
                    </span>
                </button>
            </div>
        </nav>
    );
};

export default BottomNav;
