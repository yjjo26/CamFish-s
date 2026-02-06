import { useAuth } from '../contexts/AuthContext';
import './BottomNav.css';

// Icons
import homeIcon from '../assets/icons/home.png';
import campingIcon from '../assets/icons/camping.png';
import fishingIcon from '../assets/icons/fishing.png';
import profileIcon from '../assets/icons/profile.png';

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLoginClick?: () => void;
}

const BottomNav = ({ activeTab, onTabChange, onLoginClick }: BottomNavProps) => {
    const { user, signOut } = useAuth();

    const tabs = [
        { id: 'ALL', label: '전체', icon: homeIcon },
        { id: 'CAMPING', label: '캠핑', icon: campingIcon },
        { id: 'FISHING', label: '낚시', icon: fishingIcon },
    ];

    const handleAuthClick = () => {
        if (user) {
            // Logged in - show logout confirmation
            if (confirm('로그아웃 하시겠습니까?')) {
                signOut();
            }
        } else {
            // Not logged in - show login page
            onLoginClick?.();
        }
    };

    return (
        <nav className="bottom-nav">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    <img src={tab.icon} className="nav-icon-img" alt={tab.label} />
                    <span className="nav-label">{tab.label}</span>
                </button>
            ))}
            {/* Login / My Page Button */}
            <button className="nav-item profile" onClick={handleAuthClick}>
                <img src={profileIcon} className="nav-icon-img profile" alt="Profile" />
                <span className="nav-label">
                    {user ? (user.email?.split('@')[0] || '마이페이지') : '로그인'}
                </span>
            </button>
        </nav>
    );
};

export default BottomNav;
