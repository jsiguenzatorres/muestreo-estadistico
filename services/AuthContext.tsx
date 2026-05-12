
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
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Auto-logout timer
        let inactivityTimer: NodeJS.Timeout;

        const resetTimer = () => {
            if (!user) return;
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                console.log("⏱️ Sesión expirada por inactividad. Cerrando sesión...");
                signOut();
            }, 10 * 60 * 1000); // 10 minutos
        };

        const setupActivityListeners = () => {
            window.addEventListener('mousemove', resetTimer);
            window.addEventListener('keypress', resetTimer);
            window.addEventListener('click', resetTimer);
            window.addEventListener('scroll', resetTimer);
        };

        const removeActivityListeners = () => {
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keypress', resetTimer);
            window.removeEventListener('click', resetTimer);
            window.removeEventListener('scroll', resetTimer);
        };

        const initAuth = async () => {
            try {
                // Fast path: read cached Supabase session from localStorage synchronously
                // so the UI unblocks immediately for returning users without waiting for the network
                const cachedKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                if (cachedKey) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(cachedKey) || '{}');
                        if (cached?.user && cached?.expires_at && cached.expires_at * 1000 > Date.now()) {
                            if (isMounted) {
                                setUser(cached.user);
                                // Build provisional profile from user_metadata so role-gated
                                // UI (e.g. Admin menu) appears instantly without waiting for DB
                                if (cached.user.user_metadata) {
                                    setProfile({
                                        id: cached.user.id,
                                        full_name: cached.user.user_metadata.full_name || '',
                                        role: cached.user.user_metadata.role || 'Auditor',
                                        avatar_url: cached.user.user_metadata.avatar_url || '',
                                        is_active: true,
                                    });
                                }
                                setLoading(false); // unblock UI immediately
                            }
                            fetchProfile(cached.user.id).catch(console.warn);
                        }
                    } catch { /* ignore parse errors */ }
                }

                // Reduced to 8s — if Supabase doesn't respond (cold start), don't block the app
                const timeoutFlag = setTimeout(() => {
                    if (isMounted) {
                        console.warn("⚠️ Auth initialization timeout after 8s. Proceeding.");
                        setLoading(false);
                    }
                }, 8000);

                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                clearTimeout(timeoutFlag);

                if (sessionError) throw sessionError;

                if (session) {
                    if (isMounted) setUser(session.user);
                    await fetchProfile(session.user.id);
                    setupActivityListeners();
                    resetTimer();
                } else if (isMounted) {
                    // No session — clear any stale cached user
                    setUser(null);
                    setProfile(null);
                }
            } catch (err) {
                console.error("💥 Error during auth initialization:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log("🔔 Auth State Change:", event);
            if (session) {
                const sessionUser = session.user;
                if (isMounted) {
                    setUser(sessionUser);
                    // Sincronización inmediata con metadatos para evitar retrasos de RLS
                    if (sessionUser.user_metadata) {
                        setProfile(prev => ({
                            ...prev,
                            id: sessionUser.id,
                            full_name: sessionUser.user_metadata.full_name || prev?.full_name || '',
                            role: sessionUser.user_metadata.role || prev?.role || 'Auditor',
                            is_active: true // Si tiene sesión activa y metadata, asumimos activo temporalmente
                        } as Profile));
                    }
                    setupActivityListeners();
                    resetTimer();
                }
                await fetchProfile(sessionUser.id);
            } else {
                if (isMounted) {
                    setUser(null);
                    setProfile(null);
                    removeActivityListeners();
                    clearTimeout(inactivityTimer);
                }
            }
            if (isMounted) setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            removeActivityListeners();
            clearTimeout(inactivityTimer);
        };
    }, [user]); // Dependencia user para el resetTimer

    const fetchProfile = async (userId: string) => {
        try {
            console.log("🔄 Cargando perfil para:", userId);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error("❌ Error al cargar perfil:", error.message);
                // Si el error es que no existe, el trigger podría estar demorándose
                return;
            }

            if (data) {
                console.log("✅ Perfil cargado:", data.role);
                setProfile(data);
            }
        } catch (err) {
            console.error("💥 Excepción en fetchProfile:", err);
        }
    };

    const signOut = async () => {
        try {
            console.log("🚪 Iniciando cierre de sesión técnico...");
            // Limpieza inmediata del estado local para respuesta instantánea en UI
            setUser(null);
            setProfile(null);

            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error("⚠️ Error en signOut de Supabase:", error.message);
                // Forzamos recarga si el signOut falla para asegurar limpieza de cookies/sesión
                window.location.href = '/';
            }
        } catch (err) {
            console.error("💥 Excepción en signOut:", err);
            window.location.href = '/';
        }
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, signOut }}>
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
