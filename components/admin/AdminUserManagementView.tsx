import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';

/* ─── Create User Modal ─── */
const CreateUserModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail]       = useState('');
    const [role, setRole]         = useState<'Auditor' | 'Supervisor'>('Auditor');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw]     = useState(false);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState<string | null>(null);

    // Auto-generate a temp password
    const genPassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
        let pw = '';
        for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
        setPassword(pw);
        setShowPw(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName || !email || !password) { setError('Completa todos los campos.'); return; }
        setLoading(true); setError(null);
        try {
            await samplingProxyFetch('create_user', { full_name: fullName, email, password, role }, { method: 'POST' });
            onCreated();
        } catch (err: any) {
            setError(err.message || 'Error al crear el usuario.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center">
                            <i className="fas fa-user-plus text-blue-400 text-sm"></i>
                        </div>
                        <div>
                            <h3 className="text-white font-black text-sm">Crear Nuevo Usuario</h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">El usuario recibirá acceso inmediato</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-7 space-y-4">
                    {/* Full name */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre completo</label>
                        <div className="relative">
                            <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"></i>
                            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required
                                placeholder="Ej: María González" className="field-dark w-full pl-11" />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Correo electrónico</label>
                        <div className="relative">
                            <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"></i>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                placeholder="correo@empresa.com" className="field-dark w-full pl-11" />
                        </div>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Rol asignado</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['Auditor', 'Supervisor', 'Admin'] as const).map(r => (
                                <button key={r} type="button" onClick={() => setRole(r as any)}
                                    className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${(role as string) === r ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:border-slate-600'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Temp password */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contraseña temporal</label>
                            <button type="button" onClick={genPassword}
                                className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors">
                                <i className="fas fa-dice mr-1"></i>Generar
                            </button>
                        </div>
                        <div className="relative">
                            <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"></i>
                            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                placeholder="Contraseña que el usuario deberá cambiar" className="field-dark w-full pl-11 pr-11" />
                            <button type="button" onClick={() => setShowPw(p => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 transition-colors">
                                <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-600 font-bold mt-1.5">
                            <i className="fas fa-info-circle mr-1"></i>
                            El usuario deberá cambiar esta contraseña en su primer inicio de sesión.
                        </p>
                    </div>

                    {error && (
                        <div className="flex gap-3 items-start bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 text-rose-300 text-xs font-medium">
                            <i className="fas fa-circle-exclamation mt-0.5 shrink-0"></i><span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3.5 bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-500/25 hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? <><i className="fas fa-circle-notch fa-spin"></i>Creando...</> : <><i className="fas fa-user-check"></i>Crear usuario</>}
                        </button>
                    </div>
                </form>

                <style>{`
                    .field-dark { background: rgba(30,41,59,.6); border: 1px solid rgba(71,85,105,.6); border-radius: 0.75rem; padding: 0.875rem 1rem; font-size: 0.875rem; font-weight: 500; color: white; outline: none; transition: all .2s; }
                    .field-dark::placeholder { color: #475569; }
                    .field-dark:focus { border-color: rgba(59,130,246,.7); box-shadow: 0 0 0 2px rgba(59,130,246,.15); }
                `}</style>
            </div>
        </div>
    );
};

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
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

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

    const deleteUser = async (userId: string) => {
        setActionLoading(userId);
        try {
            await samplingProxyFetch('delete_user', { user_id: userId }, { method: 'POST' });
            setUsers(prev => prev.filter(u => u.id !== userId));
            setDeleteConfirm(null);
        } catch (err: any) {
            alert('Error al eliminar usuario: ' + (err.message || 'Error desconocido'));
        } finally {
            setActionLoading(null);
        }
    };

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
        <>
        <div className="p-8 animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Consola de Administración</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest text-[10px]">Gestión de Accesos y Seguridad</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/25 hover:brightness-110 hover:-translate-y-0.5 transition-all"
                    >
                        <i className="fas fa-user-plus"></i>
                        Crear Usuario
                    </button>
                </div>

                {showCreateModal && (
                    <CreateUserModal
                        onClose={() => setShowCreateModal(false)}
                        onCreated={() => {
                            setShowCreateModal(false);
                            fetchUsers();
                        }}
                    />
                )}

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
                                        <div className="flex items-center justify-end gap-2">
                                            {/* Eliminar — solo para pendientes (nunca autorizados) y no-Admin */}
                                            {!u.is_active && u.role !== 'Admin' && (
                                                <button
                                                    onClick={() => setDeleteConfirm({ id: u.id, name: u.full_name })}
                                                    disabled={actionLoading === u.id}
                                                    title="Eliminar usuario"
                                                    className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-rose-50 text-rose-500 border border-rose-100 hover:bg-rose-600 hover:text-white hover:border-rose-600 disabled:opacity-30"
                                                >
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => toggleUserStatus(u.id, u.is_active)}
                                                disabled={actionLoading === u.id || u.role === 'Admin'}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.is_active ? 'text-rose-500 hover:bg-rose-50' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700'} disabled:opacity-30`}
                                            >
                                                {actionLoading === u.id ? '...' : (u.is_active ? 'Suspender' : 'Autorizar')}
                                            </button>
                                        </div>
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

        {/* Modal de confirmación de eliminación */}
        {deleteConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setDeleteConfirm(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center animate-fade-in-up"
                    onClick={e => e.stopPropagation()}>
                    <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <i className="fas fa-user-slash text-2xl text-rose-500"></i>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">¿Eliminar usuario?</h3>
                    <p className="text-slate-500 text-sm mb-1">
                        Se eliminará permanentemente la cuenta de:
                    </p>
                    <p className="font-black text-slate-800 mb-5 bg-slate-50 rounded-xl py-2 px-4 text-sm border border-slate-100">
                        {deleteConfirm.name}
                    </p>
                    <p className="text-[11px] text-rose-500 font-bold bg-rose-50 rounded-xl px-4 py-2 mb-6 border border-rose-100">
                        Esta acción no se puede deshacer
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setDeleteConfirm(null)}
                            className="py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                            Cancelar
                        </button>
                        <button
                            onClick={() => deleteUser(deleteConfirm.id)}
                            disabled={actionLoading === deleteConfirm.id}
                            className="py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                            {actionLoading === deleteConfirm.id
                                ? <><i className="fas fa-circle-notch fa-spin"></i>Eliminando...</>
                                : <><i className="fas fa-trash-alt"></i>Eliminar</>}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default AdminUserManagementView;
