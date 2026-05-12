
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

interface Profile {
    id: string;
    full_name: string;
    role: string;
    avatar_url: string;
    is_active: boolean;
    registration_location?: string;
    device_info?: string;
    browser_info?: string;
    registration_date?: string;
}

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    isRecoveryMode: boolean;
    mustChangePassword: boolean;
    signOut: () => Promise<void>;
    clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser]               = useState<User | null>(null);
    const [profile, setProfile]         = useState<Profile | null>(null);
    const [loading, setLoading]         = useState(true);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);

    // ─── Fetch profile from DB ────────────────────────────────────────────────
    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) { console.error('❌ fetchProfile error:', error.message); return; }
            if (data) setProfile(data);
        } catch (err) {
            console.error('💥 fetchProfile exception:', err);
        }
    };

    // ─── signOut ──────────────────────────────────────────────────────────────
    // Always redirect to '/' after signing out.
    // A full page reload is the safest way to clear ALL state (React + Supabase JS
    // localStorage cache) without race conditions.
    const signOut = async () => {
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('💥 signOut exception:', err);
        } finally {
            window.location.href = '/';
        }
    };

    // ─── Auth initialization — runs ONCE on mount ─────────────────────────────
    // IMPORTANT: this effect has [] dependency so it never re-runs.
    // Previously it had [user] which caused initAuth() to re-run on every user
    // change, creating a race condition where signOut was immediately undone by
    // initAuth() re-reading the stale localStorage token.
    useEffect(() => {
        let isMounted = true;

        const initAuth = async () => {
            try {
                // Fast path: read cached session from localStorage synchronously.
                // Unblocks the UI immediately for returning users without a network call.
                const cachedKey = Object.keys(localStorage).find(
                    k => k.startsWith('sb-') && k.endsWith('-auth-token')
                );
                if (cachedKey) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(cachedKey) || '{}');
                        if (cached?.user && cached?.expires_at && cached.expires_at * 1000 > Date.now()) {
                            if (isMounted) {
                                setUser(cached.user);
                                if (cached.user.user_metadata) {
                                    setProfile({
                                        id:         cached.user.id,
                                        full_name:  cached.user.user_metadata.full_name  || '',
                                        role:       cached.user.user_metadata.role       || 'Auditor',
                                        avatar_url: cached.user.user_metadata.avatar_url || '',
                                        is_active:  true,
                                    });
                                }
                                setLoading(false);
                            }
                            fetchProfile(cached.user.id).catch(console.warn);
                        }
                    } catch { /* ignore JSON parse errors */ }
                }

                // Confirm with Supabase (allows token refresh); 8s timeout for cold starts
                const timeoutFlag = setTimeout(() => {
                    if (isMounted) setLoading(false);
                }, 8000);

                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                clearTimeout(timeoutFlag);

                if (sessionError) throw sessionError;

                if (session) {
                    if (isMounted) setUser(session.user);
                    await fetchProfile(session.user.id);
                } else if (isMounted) {
                    // Supabase confirmed: no session — clear any stale cached user
                    setUser(null);
                    setProfile(null);
                }
            } catch (err) {
                console.error('💥 Auth initialization error:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initAuth();

        // Subscribe to Supabase auth events (token refresh, sign in/out, password recovery)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔔 Auth event:', event);

            if (event === 'PASSWORD_RECOVERY') {
                if (isMounted) {
                    setIsRecoveryMode(true);
                    if (session) setUser(session.user);
                    setLoading(false);
                }
                return;
            }

            if (session) {
                const u = session.user;
                if (isMounted) {
                    setUser(u);
                    if (u.user_metadata) {
                        setProfile(prev => ({
                            ...prev,
                            id:        u.id,
                            full_name: u.user_metadata.full_name || prev?.full_name || '',
                            role:      u.user_metadata.role      || prev?.role      || 'Auditor',
                            is_active: true,
                        } as Profile));
                    }
                }
                await fetchProfile(u.id);
            } else {
                // SIGNED_OUT or session expired
                if (isMounted) {
                    setUser(null);
                    setProfile(null);
                }
            }

            if (isMounted) setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []); // ← empty deps: runs only once on mount

    // ─── Inactivity auto-logout — separate effect, depends on user ────────────
    // Kept separate so it re-configures the timer when user changes without
    // re-running the auth initialization above.
    useEffect(() => {
        if (!user) return;

        let inactivityTimer: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                console.log('⏱️ Sesión expirada por inactividad. Cerrando sesión...');
                signOut();
            }, 10 * 60 * 1000); // 10 minutes
        };

        const events = ['mousemove', 'keypress', 'click', 'scroll'] as const;
        events.forEach(e => window.addEventListener(e, resetTimer));
        resetTimer();

        return () => {
            events.forEach(e => window.removeEventListener(e, resetTimer));
            clearTimeout(inactivityTimer);
        };
    }, [user]); // re-runs when user changes (login/logout)

    const mustChangePassword = !!(user?.user_metadata?.must_change_password);
    const clearRecoveryMode  = () => setIsRecoveryMode(false);

    return (
        <AuthContext.Provider value={{ user, profile, loading, isRecoveryMode, mustChangePassword, signOut, clearRecoveryMode }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
