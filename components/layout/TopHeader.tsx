import React, { useState, useEffect } from 'react';
import { useAuth } from '../../services/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { AppView } from '../../types';

interface TopHeaderProps {
    onNavigate: (view: AppView) => void;
}

const TopHeader: React.FC<TopHeaderProps> = ({ onNavigate }) => {
    const { profile, user, signOut } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [pendingUsersCount, setPendingUsersCount] = useState(0);

    const userName = profile?.full_name || user?.email?.split('@')[0] || "Auditor";
    const role = profile?.role || "Auditor Senior";

    useEffect(() => {
        if (profile?.role === 'Admin') {
            fetchPendingUsers();
        }
    }, [profile]);

    const fetchPendingUsers = async () => {
        try {
            const { count, error } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', false);

            if (!error && count !== null) {
                setPendingUsersCount(count);
            }
        } catch (err) {
            console.error("Error fetching notifications:", err);
        }
    };

    return (
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
            {/* LEFT: BREADCRUMBS & CONTEXT */}
            <div className="flex items-center gap-4">
                <div
                    onClick={() => onNavigate('main_dashboard')}
                    className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest gap-2 cursor-pointer hover:text-indigo-600 transition-colors"
                >
                    <i className="fas fa-house"></i>
                    <span>Inicio</span>
                    <i className="fas fa-chevron-right text-[8px]"></i>
                    <span className="text-slate-900">Dashboard Principal</span>
                </div>
            </div>

            {/* CENTER: SEARCH BAR */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
                <i className="fas fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                    type="text"
                    placeholder="Buscar auditorías, archivos, transacciones..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all shadow-sm"
                />
            </div>

            {/* RIGHT: ACTIONS & PROFILE */}
            <div className="flex items-center gap-6">
                {/* NOTIFICATIONS */}
                <button
                    onClick={() => {
                        if (profile?.role === 'Admin') onNavigate('admin_user_management');
                    }}
                    disabled={profile?.role !== 'Admin'}
                    className={`relative p-2 text-slate-400 hover:text-indigo-600 transition-colors ${profile?.role !== 'Admin' ? 'opacity-20 cursor-default' : ''}`}
                    title={pendingUsersCount > 0 ? `${pendingUsersCount} usuarios pendientes de aprobación` : 'No hay notificaciones'}
                >
                    <i className="fas fa-bell text-xl"></i>
                    {pendingUsersCount > 0 && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
                    )}
                </button>

                {/* DIVIDER */}
                <div className="w-px h-8 bg-slate-200"></div>

                {/* USER PROFILE */}
                <div
                    className="relative"
                >
                    <div
                        className="flex items-center gap-4 cursor-pointer group"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">{userName}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{role}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:bg-indigo-50 transition-colors">
                            {userName.substring(0, 2).toUpperCase()}
                        </div>
                        <i className={`fas fa-chevron-down text-[10px] text-slate-400 group-hover:text-indigo-600 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}></i>
                    </div>

                    {/* DROPDOWN MENU */}
                    {isMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                            <div className="absolute right-0 mt-4 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-20 animate-fade-in-up">
                                <div className="px-4 py-3 border-b border-slate-50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cuenta</p>
                                    <p className="text-xs font-bold text-slate-700 truncate">{user?.email}</p>
                                </div>
                                <div className="py-2">
                                    <button
                                        onClick={() => { onNavigate('main_dashboard'); setIsMenuOpen(false); }}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                    >
                                        <i className="fas fa-user-circle text-slate-400"></i> Mi Perfil
                                    </button>
                                    <button
                                        onClick={() => { onNavigate('main_dashboard'); setIsMenuOpen(false); }}
                                        className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                    >
                                        <i className="fas fa-gear text-slate-400"></i> Configuración
                                    </button>
                                </div>
                                <div className="border-t border-slate-50 pt-2">
                                    <button
                                        onClick={() => signOut()}
                                        className="w-full text-left px-4 py-3 text-xs font-black text-rose-500 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                                    >
                                        <i className="fas fa-power-off"></i> Cerrar Sesión
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopHeader;
