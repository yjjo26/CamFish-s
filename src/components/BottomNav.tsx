import { useAuth } from '../contexts/AuthContext';
import './BottomNav.css';

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLoginClick?: () => void;
}

const BottomNav = ({ activeTab, onTabChange, onLoginClick }: BottomNavProps) => {
    const { user, signOut } = useAuth();

    const tabs = [
        { id: 'ALL', label: '전체', icon: '🏞️' },
        { id: 'CAMPING', label: '캠핑', icon: '⛺' },
        { id: 'FISHING', label: '낚시', icon: '🎣' },
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
                    <span className="nav-icon">{tab.icon}</span>
                    <span className="nav-label">{tab.label}</span>
                </button>
            ))}
            {/* Login / My Page Button */}
            <button className="nav-item profile" onClick={handleAuthClick}>
                <span className="nav-icon">{user ? '👤' : '🔑'}</span>
                <span className="nav-label">
                    {user ? (user.email?.split('@')[0] || '마이페이지') : '로그인'}
                </span>
            </button>
        </nav>
    );
};

export default BottomNav;
