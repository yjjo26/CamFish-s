import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import profileIcon from '../assets/icons/profile.png';
import './AuthPage.css';

type AuthMode = 'login' | 'signup';

interface AuthPageProps {
    onClose?: () => void;
}

const AuthPage = ({ onClose }: AuthPageProps) => {
    const { signIn, signUp, signInWithGoogle } = useAuth();
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        // Validation
        if (!email || !password) {
            setError('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        if (mode === 'signup') {
            if (password !== confirmPassword) {
                setError('비밀번호가 일치하지 않습니다.');
                return;
            }
            if (password.length < 6) {
                setError('비밀번호는 6자 이상이어야 합니다.');
                return;
            }
        }

        setLoading(true);

        try {
            if (mode === 'login') {
                const result = await signIn(email, password);
                if (result.error) {
                    setError(result.error);
                } else {
                    // Login successful - close auth page
                    onClose?.();
                }
            } else {
                const result = await signUp(email, password);
                if (result.error) {
                    setError(result.error);
                } else {
                    setSuccessMessage('회원가입이 완료되었습니다! 이메일을 확인해주세요.');
                    setMode('login');
                    setPassword('');
                    setConfirmPassword('');
                }
            }
        } catch (err) {
            setError('오류가 발생했습니다. 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(mode === 'login' ? 'signup' : 'login');
        setError(null);
        setSuccessMessage(null);
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                {/* Close Button */}
                {onClose && (
                    <button className="auth-close-btn" onClick={onClose}>
                        ✕
                    </button>
                )}

                {/* Logo / Title */}
                {/* Logo / Title */}

                <div className="auth-header">
                    <div className="auth-icon-wrapper">
                        <img src={profileIcon} alt="Profile" className="auth-logo-3d" />
                    </div>
                    <h1 className="auth-title">CamFish</h1>
                    <p className="auth-subtitle">낚시 & 캠핑 여행의 시작</p>
                </div>

                {/* Mode Tabs */}
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => setMode('login')}
                    >
                        로그인
                    </button>
                    <button
                        className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                        onClick={() => setMode('signup')}
                    >
                        회원가입
                    </button>
                </div>

                {/* Form */}
                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="auth-message error">
                            <span>⚠️</span> {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="auth-message success">
                            <span>✅</span> {successMessage}
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="email">이메일</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">비밀번호</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="6자 이상 입력"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {mode === 'signup' && (
                        <div className="input-group">
                            <label htmlFor="confirmPassword">비밀번호 확인</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                placeholder="비밀번호 다시 입력"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="loading-spinner"></span>
                        ) : (
                            mode === 'login' ? '로그인' : '회원가입'
                        )}
                    </button>
                </form>

                {/* Social Login Divider */}
                <div className="auth-divider">
                    <span>또는</span>
                </div>

                {/* Google Login Button */}
                <button
                    className="google-login-btn"
                    onClick={async () => {
                        setError(null);
                        const result = await signInWithGoogle();
                        if (result.error) {
                            setError(result.error);
                        }
                    }}
                    disabled={loading}
                >
                    <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google로 계속하기
                </button>

                {/* Footer Link */}
                <div className="auth-footer">
                    <span>
                        {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
                    </span>
                    <button onClick={toggleMode} className="auth-link">
                        {mode === 'login' ? '회원가입' : '로그인'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
