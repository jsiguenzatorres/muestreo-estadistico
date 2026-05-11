import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';

interface UserProfile {
    id: string;
    full_name: string;
    role: string;
    is_active: boolean;
    registration_date: string;
    registration_location: string;
    device_info: string;
    browser_info: string;
}

const AdminUserManagementView: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchUsers = async () => {
            if (!isMounted) return;
            
            try {
                setLoading(true);
                setError(null);
                console.log("Admin: Iniciando carga de usuarios vía proxy...");

                // Usar el proxy con timeout y manejo de errores mejorado
                const { users: data } = await samplingProxyFetch('get_users');
                console.log("AdminView: Datos recibidos:", data);

                if (isMounted) {
                    setUsers(data || []);
                }
            } catch (err: any) {
                console.error("Error fetching users:", err);
                
                if (isMounted) {
                    let errorMessage = "Error al cargar usuarios";
                    
                    if (err instanceof FetchTimeoutError) {
                        errorMessage = "Timeout: La carga tardó demasiado tiempo. Verifique su conexión.";
                    } else if (err instanceof FetchNetworkError) {
                        errorMessage = "Error de conexión: " + err.message;
                    } else {
                        errorMessage += ": " + (err.message || "Error desconocido");
                    }
                    
                    setError(errorMessage);
                    setUsers([]);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchUsers();
        return () => { isMounted = false; };
    }, []);

    const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
        try {
            setActionLoading(userId);

            // Usar el proxy con timeout para actualizar estado
            await samplingProxyFetch('toggle_user_status', {
                user_id: userId,
                status: !currentStatus
            }, { method: 'POST' });

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
            
        } catch (error: any) {
            console.error("Error updating user status:", error);
            
            let errorMessage = "No se pudo actualizar el estado del usuario";
            
            if (error instanceof FetchTimeoutError) {
                errorMessage = "Timeout: La actualización tardó demasiado tiempo";
            } else if (error instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + error.message;
            } else {
                errorMessage += ": " + (error.message || "Error desconocido");
            }
            
            alert(errorMessage);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="p-8 animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Consola de Administración</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">Gestión de Accesos y Seguridad</p>
                    </div>
                </div>

                {/* PANEL DE DIAGNÓSTICO MEJORADO */}
                {(loading || error || users.length === 0) && (
                    <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-3 h-3 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : error ? 'bg-red-500' : 'bg-green-500'}`}></div>
                            <h3 className="text-sm font-bold text-slate-700">Estado del Sistema</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                                <span className="font-bold text-slate-500">Estado:</span>
                                <span className={`ml-2 ${loading ? 'text-blue-600' : error ? 'text-red-600' : 'text-green-600'}`}>
                                    {loading ? 'Cargando...' : error ? 'Error' : 'Listo'}
                                </span>
                            </div>
                            <div>
                                <span className="font-bold text-slate-500">Usuarios:</span>
                                <span className="ml-2 text-slate-700">{users.length}</span>
                            </div>
                            <div>
                                <span className="font-bold text-slate-500">Último Error:</span>
                                <span className="ml-2 text-slate-600">{error || 'Ninguno'}</span>
                            </div>
                        </div>
                        {error && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 transition-all"
                                >
                                    <i className="fas fa-redo mr-1"></i>Recargar Página
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/30">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario / Rol</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Registro / Ubicación</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispositivo</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${u.role === 'Admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {u.full_name?.charAt(0) || u.role?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{u.full_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{u.role}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="text-[11px] font-bold text-slate-700 mb-1">
                                            {new Date(u.registration_date).toLocaleString()}
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-500">
                                            {u.registration_location || 'Desconocida'}
                                        </p>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="max-w-[200px]">
                                            <p className="text-[11px] font-bold text-slate-600 truncate">
                                                {u.device_info || 'N/A'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {u.is_active ? 'Activo' : 'Pendiente'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button
                                            onClick={() => toggleUserStatus(u.id, u.is_active)}
                                            disabled={actionLoading === u.id || u.role === 'Admin'}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.is_active ? 'text-rose-500 hover:bg-rose-50' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700'} disabled:opacity-30`}
                                        >
                                            {actionLoading === u.id ? '...' : (u.is_active ? 'Suspender' : 'Autorizar')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {loading && (
                    <div className="p-20 text-center">
                        <div className="flex flex-col items-center">
                            <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-4"></i>
                            <p className="text-slate-500 font-medium">Cargando usuarios...</p>
                            <p className="text-slate-400 text-sm mt-1">Esto puede tomar unos segundos</p>
                        </div>
                    </div>
                )}

                {!loading && error && (
                    <div className="p-20 text-center">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
                            <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
                            <h3 className="text-red-800 font-bold text-lg mb-2">Error de Conexión</h3>
                            <p className="text-red-700 text-sm mb-4">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-all"
                            >
                                <i className="fas fa-redo mr-2"></i>Reintentar
                            </button>
                        </div>
                    </div>
                )}

                {!loading && !error && users.length === 0 && (
                    <div className="p-20 text-center text-slate-400">
                        <i className="fas fa-users text-4xl mb-4 opacity-50"></i>
                        <p className="text-lg font-medium">No hay usuarios registrados</p>
                        <p className="text-sm mt-1">Los nuevos registros aparecerán aquí automáticamente</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUserManagementView;
