import { supabase } from '../lib/supabase';
import type { User, Session, AuthError } from '@supabase/supabase-js';

// ==============================================================================
// Types
// ==============================================================================

export interface AuthResult {
    user: User | null;
    session: Session | null;
    error: AuthError | null;
}

// ==============================================================================
// Authentication Functions
// ==============================================================================

/**
 * 이메일/비밀번호로 회원가입
 */
export const signUp = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    return {
        user: data.user,
        session: data.session,
        error,
    };
};

/**
 * 이메일/비밀번호로 로그인
 */
export const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    return {
        user: data.user,
        session: data.session,
        error,
    };
};

/**
 * 로그아웃
 */
export const signOut = async (): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

/**
 * 현재 세션 가져오기
 */
export const getSession = async (): Promise<Session | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
};

/**
 * 현재 유저 가져오기
 */
export const getCurrentUser = async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

/**
 * 인증 상태 변화 리스너
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user ?? null);
    });

    return subscription;
};

// ==============================================================================
// Social Login
// ==============================================================================

/**
 * Google OAuth 로그인
 */
export const signInWithGoogle = async (): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        },
    });

    return { error };
};
