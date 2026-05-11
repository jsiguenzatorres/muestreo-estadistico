import React, { useState } from 'react';
import { AppView, AppState } from '../../types';
import { useAuth } from '../../services/AuthContext';

interface SidebarProps {
    currentView: AppView;
    onNavigate: (view: AppView) => void;
    appState: AppState;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, appState }) => {
    const { profile, user, signOut } = useAuth();
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Lógica de habilitación basada en el progreso
    const hasPopulation = !!appState.selectedPopulation;
    const hasMapping = !!appState.selectedPopulation?.column_mapping;
    const hasResults = !!appState.results;

    const menuItems = [
        { id: 'main_dashboard', label: 'Inicio', icon: 'fa-house', category: 'General', enabled: true },
        { id: 'population_manager', label: 'Mis Proyectos', icon: 'fa-folder-open', category: 'Auditoría', enabled: true },
        { id: 'data_upload', label: 'Conexiones (ETL)', icon: 'fa-database', category: 'Auditoría', enabled: true },

        // Fases de INTELIGENCIA (Bloqueo Progresivo)
        {
            id: 'discovery_analysis',
            label: 'Integridad (EDA)',
            icon: 'fa-shield-halved',
            category: 'Inteligencia',
            enabled: hasPopulation,
            lockedMsg: 'Requiere Población activa'
        },
        {
            id: 'risk_profiling',
            label: 'Perfilado Forense',
            icon: 'fa-fingerprint',
            category: 'Inteligencia',
            enabled: hasMapping,
            lockedMsg: 'Requiere Mapeo de Datos'
        },
        {
            id: 'sampling_config',
            label: 'Diseño de Muestreo',
            icon: 'fa-compass-drafting',
            category: 'Inteligencia',
            enabled: hasPopulation,
            lockedMsg: 'Requiere Configuración inicial'
        },
        {
            id: 'results',
            label: 'Ejecución Técnica',
            icon: 'fa-microscope',
            category: 'Inteligencia',
            enabled: hasResults,
            lockedMsg: 'Requiere Muestreo ejecutado'
        },

        { id: 'audit_expediente', label: 'Expediente Hallazgos', icon: 'fa-file-signature', category: 'Resultados', enabled: true },

        // ADMIN SECTION
        ...(profile?.role === 'Admin' ? [{ id: 'admin_user_management', label: 'Usuarios', icon: 'fa-user-shield', category: 'Seguridad', enabled: true }] : []),
    ];

    const displayUserName = profile?.full_name || user?.email?.split('@')[0] || "Auditor";

    return (
        <aside
            className={`h-screen bg-[#0A2540] text-slate-300 transition-all duration-300 flex flex-col shadow-2xl z-50 ${isCollapsed ? 'w-20' : 'w-72'}`}
        >
            {/* LOGO SECTION */}
            <div className="p-6 flex items-center gap-4 bg-[#081d33]">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                    <i className="fas fa-layer-group text-white text-xl"></i>
                </div>
                {!isCollapsed && (
                    <div className="overflow-hidden whitespace-nowrap">
                        <h1 className="text-white font-black text-lg tracking-tight leading-none mb-1">AuditFlow</h1>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Enterprise v3.0</p>
                    </div>
                )}
            </div>

            {/* NAVIGATION AREA */}
            <nav className="flex-1 px-4 py-8 overflow-y-auto space-y-8 scrollbar-hide">

                {['General', 'Auditoría', 'Inteligencia', 'Resultados', 'Seguridad'].map(cat => {
                    const items = menuItems.filter(i => i.category === cat);
                    if (items.length === 0) return null;
                    return (
                        <div key={cat} className="space-y-1">
                            {!isCollapsed && (
                                <h3 className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">
                                    {cat}
                                </h3>
                            )}
                            {items.map(item => {
                                const isActive = currentView === item.id;
                                const isEnabled = item.enabled;

                                return (
                                    <button
                                        key={item.id}
                                        disabled={!isEnabled}
                                        onClick={() => onNavigate(item.id as AppView)}
                                        className={`
                                            w-full flex items-center gap-4 p-3 rounded-xl transition-all group relative
                                            ${isActive
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                                : isEnabled
                                                    ? 'hover:bg-white/5 hover:text-white'
                                                    : 'opacity-30 cursor-not-allowed grayscale'
                                            }
                                        `}
                                    >
                                        <i className={`fas ${item.icon} text-lg w-6 flex justify-center ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`}></i>
                                        {!isCollapsed && (
                                            <div className="flex flex-col items-start translate-y-[1px]">
                                                <span className={`text-sm font-bold tracking-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                                    {item.label}
                                                </span>
                                                {!isEnabled && item.lockedMsg && (
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                                        <i className="fas fa-lock mr-1"></i> {item.lockedMsg}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* INDICADOR ACTIVO */}
                                        {isActive && (
                                            <div className="absolute right-2 w-1.5 h-6 bg-white rounded-full"></div>
                                        )}

                                        {/* TOOLTIP COLAPSADO */}
                                        {isCollapsed && (
                                            <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
                                                {item.label} {!isEnabled && ' (Bloqueado)'}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            {/* FOOTER SECTION */}
            <div className={`p-4 border-t border-white/5 bg-[#081d33]/50`}>
                <div className={`flex items-center gap-3 mb-4 p-2 rounded-xl transition-all bg-white/5 border border-white/5 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black shrink-0 relative">
                        {displayUserName.substring(0, 2).toUpperCase()}
                        {profile?.role === 'Admin' && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-[#081d33] flex items-center justify-center">
                                <i className="fas fa-star text-[6px] text-white"></i>
                            </span>
                        )}
                    </div>
                    {!isCollapsed && (
                        <div className="overflow-hidden flex-1">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black text-white truncate">{displayUserName}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="text-[8px] text-slate-500 hover:text-indigo-400 transition-colors"
                                    title="Refrescar Perfil"
                                >
                                    <i className="fas fa-sync-alt"></i>
                                </button>
                            </div>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">
                                {profile?.role === 'Admin' ? '🛡️ Administrador' : (profile?.role || 'Auditor Senior')}
                            </p>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all mb-2 cursor-pointer"
                >
                    <i className="fas fa-power-off text-lg w-6 flex justify-center"></i>
                    {!isCollapsed && <span className="text-sm font-bold">Cerrar Sesión</span>}
                </button>

                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-slate-500 hover:text-indigo-400 transition-all cursor-pointer"
                >
                    <i className={`fas ${isCollapsed ? 'fa-angles-right' : 'fa-angles-left'} text-lg w-6 flex justify-center`}></i>
                    {!isCollapsed && <span className="text-sm font-bold">Colapsar Menú</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
