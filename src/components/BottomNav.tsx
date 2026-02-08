import { useAuth } from '../contexts/AuthContext';
import './BottomNav.css';

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLoginClick?: () => void;
}

// 3D Style SVG Icons with gradients and depth
const HomeIcon = ({ active }: { active: boolean }) => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="homeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={active ? "#5AC8FA" : "#8E8E93"} />
                <stop offset="100%" stopColor={active ? "#007AFF" : "#636366"} />
            </linearGradient>
            <filter id="homeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor={active ? "#007AFF" : "#000"} floodOpacity={active ? "0.4" : "0.15"} />
            </filter>
            <linearGradient id="homeShine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
        </defs>
        <g filter="url(#homeShadow)">
            <path
                d="M4 11L13 4L22 11V21C22 21.5523 21.5523 22 21 22H16V16C16 15.4477 15.5523 15 15 15H11C10.4477 15 10 15.4477 10 16V22H5C4.44772 22 4 21.5523 4 21V11Z"
                fill="url(#homeGradient)"
                stroke="url(#homeGradient)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {active && <path d="M4 11L13 4L17 7" stroke="url(#homeShine)" strokeWidth="2" strokeLinecap="round" />}
        </g>
    </svg>
);

const CampingIcon = ({ active }: { active: boolean }) => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="campGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={active ? "#34C759" : "#8E8E93"} />
                <stop offset="100%" stopColor={active ? "#248A3D" : "#636366"} />
            </linearGradient>
            <filter id="campShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor={active ? "#34C759" : "#000"} floodOpacity={active ? "0.4" : "0.15"} />
            </filter>
            <linearGradient id="campShine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
        </defs>
        <g filter="url(#campShadow)">
            <path
                d="M13 3L3 22H23L13 3Z"
                fill="url(#campGradient)"
                stroke="url(#campGradient)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10 22L13 16L16 22"
                fill={active ? "#1C5E2B" : "#48484A"}
                stroke={active ? "#1C5E2B" : "#48484A"}
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {active && <path d="M6 16L13 3L15 6" stroke="url(#campShine)" strokeWidth="2" strokeLinecap="round" />}
        </g>
    </svg>
);

const FishingIcon = ({ active }: { active: boolean }) => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="fishGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={active ? "#FF9F0A" : "#8E8E93"} />
                <stop offset="100%" stopColor={active ? "#FF6B00" : "#636366"} />
            </linearGradient>
            <linearGradient id="fishBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={active ? "#FFB74D" : "#AEAEB2"} />
                <stop offset="100%" stopColor={active ? "#FF8C00" : "#8E8E93"} />
            </linearGradient>
            <filter id="fishShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor={active ? "#FF6B00" : "#000"} floodOpacity={active ? "0.4" : "0.15"} />
            </filter>
        </defs>
        <g filter="url(#fishShadow)">
            {/* Fish body */}
            <ellipse cx="11" cy="12" rx="7" ry="5" fill="url(#fishBodyGradient)" />
            {/* Fish tail */}
            <path d="M17 12L22 8V16L17 12Z" fill="url(#fishGradient)" />
            {/* Fish eye */}
            <circle cx="7" cy="11" r="1.5" fill="white" />
            <circle cx="7" cy="11" r="0.8" fill={active ? "#1C1C1E" : "#48484A"} />
            {/* Fishing line */}
            <path d="M3 2V6" stroke="url(#fishGradient)" strokeWidth="2" strokeLinecap="round" />
            <path d="M3 6Q3 9 6 10" stroke="url(#fishGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* Hook */}
            <circle cx="5" cy="7" r="1" fill="url(#fishGradient)" />
        </g>
    </svg>
);

const ProfileIcon = ({ active }: { active: boolean }) => (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="profileGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={active ? "#BF5AF2" : "#8E8E93"} />
                <stop offset="100%" stopColor={active ? "#9945D4" : "#636366"} />
            </linearGradient>
            <filter id="profileShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor={active ? "#BF5AF2" : "#000"} floodOpacity={active ? "0.4" : "0.15"} />
            </filter>
            <linearGradient id="profileShine" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
        </defs>
        <g filter="url(#profileShadow)">
            {/* Head */}
            <circle cx="13" cy="9" r="5" fill="url(#profileGradient)" />
            {active && <ellipse cx="11" cy="7" rx="2" ry="1.5" fill="url(#profileShine)" />}
            {/* Body */}
            <path
                d="M4 23C4 18.5817 8.02944 15 13 15C17.9706 15 22 18.5817 22 23"
                fill="url(#profileGradient)"
            />
            {active && <path d="M6 20C8 17 11 15 13 15" stroke="url(#profileShine)" strokeWidth="2" strokeLinecap="round" fill="none" />}
        </g>
    </svg>
);

const BottomNav = ({ activeTab, onTabChange, onLoginClick }: BottomNavProps) => {
    const { user, signOut } = useAuth();

    const tabs = [
        { id: 'ALL', label: '전체', Icon: HomeIcon },
        { id: 'CAMPING', label: '캠핑', Icon: CampingIcon },
        { id: 'FISHING', label: '낚시', Icon: FishingIcon },
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
                        {user?.email ? user.email.split('@')[0].slice(0, 6) : '로그인'}
                    </span>
                </button>
            </div>
        </nav>
    );
};

export default BottomNav;
