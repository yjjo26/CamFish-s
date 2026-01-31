import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { signIn, signUp, signOut, getCurrentUser, onAuthStateChange, signInWithGoogle } from '../services/authService';

// ==============================================================================
// Context Types
// ==============================================================================

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<{ error: string | null }>;
}

// ==============================================================================
// Context
// ==============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==============================================================================
// Provider Component
// ==============================================================================

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check initial auth state
        getCurrentUser().then((user) => {
            setUser(user);
            setLoading(false);
        });

        // Listen for auth changes
        const subscription = onAuthStateChange((user) => {
            setUser(user);
            setLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSignIn = async (email: string, password: string) => {
        const result = await signIn(email, password);
        if (result.error) {
            return { error: result.error.message };
        }
        return { error: null };
    };

    const handleSignUp = async (email: string, password: string) => {
        const result = await signUp(email, password);
        if (result.error) {
            return { error: result.error.message };
        }
        return { error: null };
    };

    const handleSignOut = async () => {
        await signOut();
        setUser(null);
    };

    const handleSignInWithGoogle = async () => {
        const result = await signInWithGoogle();
        if (result.error) {
            return { error: result.error.message };
        }
        return { error: null };
    };

    const value: AuthContextType = {
        user,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        signInWithGoogle: handleSignInWithGoogle,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// ==============================================================================
// Hook
// ==============================================================================

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
