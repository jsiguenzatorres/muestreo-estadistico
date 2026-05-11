
import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';

const LoginView: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState<'Auditor' | 'Supervisor'>('Auditor');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                // Capturar metadatos básicos
                const deviceInfo = `${navigator.platform} - ${navigator.vendor}`;
                const browserInfo = navigator.userAgent;
                let locationData = "Desconocida";

                try {
                    const geoResponse = await fetch('https://ipapi.co/json/');
                    const geo = await geoResponse.json();
                    locationData = `${geo.city}, ${geo.region}, ${geo.country_name} (IP: ${geo.ip})`;
                } catch (geoErr) {
                    console.warn("No se pudo obtener la geolocalización:", geoErr);
                }

                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: role,
                            device_info: deviceInfo,
                            browser_info: browserInfo,
                            registration_location: locationData
                        }
                    }
                });
                if (signUpError) throw signUpError;
                setRegistrationSuccess(true);
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });
                if (signInError) throw signInError;
            }
        } catch (err: any) {
            setError(err.message || "Ocurrió un error inesperado.");
        } finally {
            setLoading(false);
        }
    };

    if (registrationSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] p-8">
                <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-12 text-center animate-bounce-in">
                    <div className="w-24 h-24 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-emerald-100 shadow-inner">
                        <i className="fas fa-check-double text-4xl text-emerald-500"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-4">¡Registro Exitoso!</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">
                        Tu solicitud de acceso ha sido enviada a los administradores. Recibirás un correo cuando tu cuenta sea activada.
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-6 text-xs text-slate-400 font-bold uppercase tracking-widest border border-slate-100 italic">
                        Por motivos de seguridad, un administrador validará tu identidad antes de habilitar tu perfil.
                    </div>
                    <button
                        onClick={() => {
                            setRegistrationSuccess(false);
                            setIsSignUp(false);
                        }}
                        className="mt-10 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl"
                    >
                        Volver al Inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] relative overflow-hidden">
            {/* BACKGROUND ELEMENTS */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[150px]"></div>

            <div className="w-full max-w-md p-8 animate-fade-in-up">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-xl shadow-blue-500/20 mb-6 group transition-all hover:scale-105 active:scale-95">
                        <i className="fas fa-fingerprint text-white text-4xl"></i>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">AAMA v3.0</h1>
                    <p className="text-slate-500 font-medium text-sm mt-2">Plataforma de Auditoría Inteligente</p>
                </div>

                <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-[2.5rem] shadow-2xl p-10 relative">
                    <h2 className="text-xl font-black text-slate-800 mb-8 border-b border-slate-100 pb-4">
                        {isSignUp ? 'Crear Nueva Cuenta' : 'Acceso al Sistema'}
                    </h2>

                    <form onSubmit={handleAuth} className="space-y-5">
                        {isSignUp && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                <div className="relative">
                                    <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-white/50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                        placeholder="Ej: Auditor Senior"
                                    />
                                </div>
                            </div>
                        )}

                        {isSignUp && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rol en la Firma</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setRole('Auditor')}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${role === 'Auditor' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        <i className="fas fa-file-pen mr-2"></i>
                                        Auditor
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('Supervisor')}
                                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${role === 'Supervisor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        <i className="fas fa-eye mr-2"></i>
                                        Supervisor
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                            <div className="relative">
                                <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                    placeholder="correo@empresa.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                            <div className="relative">
                                <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold border border-rose-100 flex items-center animate-shake">
                                <i className="fas fa-exclamation-circle mr-3 text-lg"></i>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 mt-4 flex items-center justify-center gap-3"
                        >
                            {loading ? (
                                <i className="fas fa-circle-notch fa-spin"></i>
                            ) : (
                                <>
                                    <span>{isSignUp ? 'Finalizar Registro' : 'Entrar con Credenciales'}</span>
                                    <i className="fas fa-arrow-right-long opacity-50"></i>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center pt-6 border-t border-slate-100">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                        >
                            {isSignUp ? '¿Ya tienes cuenta? Iniciar sesión' : '¿No tienes cuenta? Regístrate aquí'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-8">
                    &copy; 2026 Inteligencia de Auditoría Avanzada
                </p>
            </div>
        </div>
    );
};

export default LoginView;
