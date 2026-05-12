import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/* ─────────────────────────────────────────────
   Password-strength helper
───────────────────────────────────────────── */
function getPasswordStrength(pwd: string): { score: number; label: string; color: string } {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8)  score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { score, label: 'Muy débil',  color: 'bg-rose-500' };
    if (score === 2) return { score, label: 'Débil',      color: 'bg-orange-400' };
    if (score === 3) return { score, label: 'Aceptable',  color: 'bg-amber-400' };
    if (score === 4) return { score, label: 'Fuerte',     color: 'bg-emerald-400' };
    return              { score, label: 'Muy fuerte',  color: 'bg-emerald-500' };
}

/* ─────────────────────────────────────────────
   Feature highlights shown in the branding panel
───────────────────────────────────────────── */
const FEATURES = [
    { icon: 'fa-microscope',        title: 'Muestreo Estadístico',  desc: 'MUS, CAV, Atributos, Estratificado' },
    { icon: 'fa-fingerprint',       title: 'Análisis Forense',      desc: 'Detección de fraude y anomalías' },
    { icon: 'fa-brain',             title: 'IA Integrada',          desc: 'Recomendaciones con Gemini AI' },
    { icon: 'fa-shield-halved',     title: 'Cumplimiento Normativo', desc: 'ISSAI, INTOSAI, ISO 19011' },
];

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
const LoginView: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [step, setStep] = useState<1 | 2>(1);          // register only

    // Fields
    const [email,           setEmail]           = useState('');
    const [password,        setPassword]        = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName,        setFullName]        = useState('');
    const [role,            setRole]            = useState<'Auditor' | 'Supervisor'>('Auditor');
    const [showPassword,    setShowPassword]    = useState(false);

    // UI state
    const [loading,  setLoading]  = useState(false);
    const [error,    setError]    = useState<string | null>(null);
    const [success,  setSuccess]  = useState(false);
    const [featureIdx, setFeatureIdx] = useState(0);

    // Rotate feature highlight every 3 s
    useEffect(() => {
        const t = setInterval(() => setFeatureIdx(i => (i + 1) % FEATURES.length), 3000);
        return () => clearInterval(t);
    }, []);

    // Reset on mode switch
    const switchMode = (m: 'login' | 'register') => {
        setMode(m); setStep(1); setError(null);
        setEmail(''); setPassword(''); setConfirmPassword('');
        setFullName(''); setRole('Auditor');
    };

    const strength = getPasswordStrength(password);

    /* ── Step 1 validation (register) ── */
    const handleStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) { setError('Ingresa tu nombre completo.'); return; }
        setError(null);
        setStep(2);
    };

    /* ── Final submit ── */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'register') {
            if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
            if (strength.score < 2)           { setError('La contraseña es demasiado débil.'); return; }
        }

        setLoading(true);
        try {
            if (mode === 'register') {
                const deviceInfo  = `${navigator.platform} - ${navigator.vendor}`;
                const browserInfo = navigator.userAgent;
                let locationData  = 'Desconocida';
                try {
                    const geo = await (await fetch('https://ipapi.co/json/')).json();
                    locationData = `${geo.city}, ${geo.region}, ${geo.country_name} (IP: ${geo.ip})`;
                } catch { /* geolocation optional */ }

                const { error: signUpError } = await supabase.auth.signUp({
                    email, password,
                    options: {
                        data: { full_name: fullName, role, device_info: deviceInfo,
                                browser_info: browserInfo, registration_location: locationData }
                    }
                });
                if (signUpError) throw signUpError;
                setSuccess(true);
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) throw signInError;
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error inesperado.');
        } finally {
            setLoading(false);
        }
    };

    /* ─────────────── SUCCESS SCREEN ─────────────── */
    if (success) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-6">
            <div className="max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-12 text-center animate-fade-in-up">
                <div className="relative mx-auto mb-8 w-24 h-24">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-3xl animate-ping"></div>
                    <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                        <i className="fas fa-check-double text-4xl text-white"></i>
                    </div>
                </div>
                <h2 className="text-2xl font-black text-white mb-3 tracking-tight">¡Solicitud Enviada!</h2>
                <p className="text-slate-400 leading-relaxed mb-8 text-sm">
                    Tu registro fue procesado. Un administrador revisará tu solicitud y activará tu cuenta.
                    Recibirás acceso una vez aprobado.
                </p>
                <div className="grid grid-cols-3 gap-3 mb-8">
                    {['Registro recibido', 'Revisión admin', 'Cuenta activa'].map((s, i) => (
                        <div key={s} className={`rounded-2xl p-3 text-center ${i === 0 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-white/5 border border-white/10'}`}>
                            <div className={`w-6 h-6 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                                {i === 0 ? <i className="fas fa-check text-[10px]"></i> : i + 1}
                            </div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s}</p>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => { setSuccess(false); switchMode('login'); }}
                    className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl"
                >
                    <i className="fas fa-arrow-left mr-2"></i>Volver al inicio de sesión
                </button>
            </div>
        </div>
    );

    /* ─────────────── MAIN LAYOUT ─────────────── */
    return (
        <div className="min-h-screen flex bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 relative overflow-hidden">

            {/* ── Ambient blobs ── */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* ════════════════════════════════
                LEFT — Branding panel
            ════════════════════════════════ */}
            <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative">

                {/* Logo */}
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <i className="fas fa-layer-group text-white text-xl"></i>
                    </div>
                    <div>
                        <p className="text-white font-black text-lg tracking-tight leading-none">AuditFlow</p>
                        <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.25em]">Enterprise v3.0</p>
                    </div>
                </div>

                {/* Hero text */}
                <div>
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-8">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Plataforma activa · 100% segura</span>
                    </div>

                    <h1 className="text-5xl font-black text-white leading-tight tracking-tight mb-6">
                        Auditoría<br/>
                        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Inteligente
                        </span><br/>
                        de Siguiente Nivel
                    </h1>
                    <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                        Herramienta de auditoría estadística y forense diseñada para equipos de alto rendimiento.
                    </p>
                </div>

                {/* Rotating feature card */}
                <div className="space-y-4">
                    <div className="relative overflow-hidden bg-white/5 border border-white/10 rounded-[1.5rem] p-6 backdrop-blur-sm">
                        {/* Progress dots */}
                        <div className="flex gap-2 mb-5">
                            {FEATURES.map((_, i) => (
                                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === featureIdx ? 'w-6 bg-blue-400' : 'w-2 bg-white/20'}`}></div>
                            ))}
                        </div>
                        <div className="flex items-start gap-4 transition-all duration-500">
                            <div className="w-11 h-11 bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border border-blue-400/20 rounded-xl flex items-center justify-center shrink-0">
                                <i className={`fas ${FEATURES[featureIdx].icon} text-blue-400 text-lg`}></i>
                            </div>
                            <div>
                                <p className="text-white font-black text-sm mb-1">{FEATURES[featureIdx].title}</p>
                                <p className="text-slate-400 text-xs leading-relaxed">{FEATURES[featureIdx].desc}</p>
                            </div>
                        </div>
                    </div>

                    {/* Stat pills */}
                    <div className="grid grid-cols-3 gap-3">
                        {[['5', 'Métodos'], ['ISO 19011', 'Estándar'], ['IA', 'Integrada']].map(([val, lbl]) => (
                            <div key={lbl} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                                <p className="text-white font-black text-lg">{val}</p>
                                <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">{lbl}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">
                    &copy; 2026 iNova Tech Systems · Todos los derechos reservados
                </p>
            </div>

            {/* ════════════════════════════════
                RIGHT — Auth card
            ════════════════════════════════ */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-md animate-fade-in-up">

                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <i className="fas fa-layer-group text-white"></i>
                        </div>
                        <p className="text-white font-black text-xl">AuditFlow</p>
                    </div>

                    {/* Card */}
                    <div className="bg-white/8 backdrop-blur-2xl border border-white/12 rounded-[2rem] shadow-2xl overflow-hidden">

                        {/* Mode tab switcher */}
                        <div className="flex bg-black/20 p-1.5 m-5 rounded-2xl gap-1">
                            {(['login', 'register'] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => switchMode(m)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        mode === m
                                            ? 'bg-white text-slate-900 shadow-lg'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {m === 'login' ? <><i className="fas fa-sign-in-alt mr-2"></i>Iniciar Sesión</> : <><i className="fas fa-user-plus mr-2"></i>Crear Cuenta</>}
                                </button>
                            ))}
                        </div>

                        <div className="px-8 pb-8">

                            {/* ── REGISTER: step indicator ── */}
                            {mode === 'register' && (
                                <div className="flex items-center gap-3 mb-7">
                                    {[1, 2].map(n => (
                                        <React.Fragment key={n}>
                                            <div className={`flex items-center gap-2 transition-all ${step >= n ? 'opacity-100' : 'opacity-30'}`}>
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${step > n ? 'bg-emerald-500 text-white' : step === n ? 'bg-blue-500 text-white ring-4 ring-blue-500/20' : 'bg-white/10 text-slate-400'}`}>
                                                    {step > n ? <i className="fas fa-check text-[8px]"></i> : n}
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${step === n ? 'text-white' : 'text-slate-500'}`}>
                                                    {n === 1 ? 'Tu perfil' : 'Credenciales'}
                                                </span>
                                            </div>
                                            {n < 2 && <div className={`flex-1 h-px transition-all ${step > 1 ? 'bg-emerald-500/50' : 'bg-white/10'}`}></div>}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}

                            {/* ══════════ LOGIN FORM ══════════ */}
                            {mode === 'login' && (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Correo electrónico</label>
                                        <div className="relative">
                                            <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="correo@empresa.com" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Contraseña</label>
                                        <div className="relative">
                                            <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                            <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="••••••••" />
                                            <button type="button" onClick={() => setShowPassword(p => !p)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    {error && <ErrorBanner msg={error} />}

                                    <button type="submit" disabled={loading}
                                        className="w-full mt-2 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3">
                                        {loading
                                            ? <><i className="fas fa-circle-notch fa-spin"></i><span>Verificando...</span></>
                                            : <><span>Entrar al Sistema</span><i className="fas fa-arrow-right-long opacity-60"></i></>
                                        }
                                    </button>
                                </form>
                            )}

                            {/* ══════════ REGISTER STEP 1 ══════════ */}
                            {mode === 'register' && step === 1 && (
                                <form onSubmit={handleStep1} className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre completo</label>
                                        <div className="relative">
                                            <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                            <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="Ej: María González Ruiz" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Rol solicitado</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {(['Auditor', 'Supervisor'] as const).map(r => (
                                                <button key={r} type="button" onClick={() => setRole(r)}
                                                    className={`relative py-5 rounded-2xl border transition-all group ${
                                                        role === r
                                                            ? r === 'Auditor'
                                                                ? 'bg-blue-600/20 border-blue-500/50 shadow-lg shadow-blue-500/10'
                                                                : 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                                                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
                                                    }`}>
                                                    {role === r && (
                                                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                                            <i className="fas fa-check text-[8px] text-white"></i>
                                                        </div>
                                                    )}
                                                    <i className={`fas ${r === 'Auditor' ? 'fa-file-pen' : 'fa-eye'} text-2xl mb-2 block ${role === r ? (r === 'Auditor' ? 'text-blue-400' : 'text-indigo-400') : 'text-slate-500'}`}></i>
                                                    <p className={`text-xs font-black uppercase tracking-widest ${role === r ? 'text-white' : 'text-slate-500'}`}>{r}</p>
                                                    <p className="text-[9px] text-slate-500 mt-1">{r === 'Auditor' ? 'Ejecuta muestreos' : 'Revisa resultados'}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {error && <ErrorBanner msg={error} />}

                                    <button type="submit"
                                        className="w-full mt-2 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                        <span>Siguiente</span><i className="fas fa-arrow-right opacity-60"></i>
                                    </button>
                                </form>
                            )}

                            {/* ══════════ REGISTER STEP 2 ══════════ */}
                            {mode === 'register' && step === 2 && (
                                <form onSubmit={handleSubmit} className="space-y-4">

                                    {/* Profile summary pill */}
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 mb-2">
                                        <div className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                                            {fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-black text-sm truncate">{fullName}</p>
                                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{role}</p>
                                        </div>
                                        <button type="button" onClick={() => setStep(1)}
                                            className="text-slate-500 hover:text-blue-400 transition-colors text-xs font-black uppercase tracking-widest px-2">
                                            <i className="fas fa-pen text-[10px] mr-1"></i>Editar
                                        </button>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Correo electrónico</label>
                                        <div className="relative">
                                            <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="correo@empresa.com" />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contraseña</label>
                                            {password && (
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${
                                                    strength.score <= 1 ? 'text-rose-400' :
                                                    strength.score === 2 ? 'text-orange-400' :
                                                    strength.score === 3 ? 'text-amber-400' : 'text-emerald-400'
                                                }`}>{strength.label}</span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                            <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                placeholder="Mínimo 8 caracteres" />
                                            <button type="button" onClick={() => setShowPassword(p => !p)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                                            </button>
                                        </div>
                                        {/* Strength bar */}
                                        {password && (
                                            <div className="flex gap-1 mt-2">
                                                {[1, 2, 3, 4, 5].map(n => (
                                                    <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-300 ${n <= strength.score ? strength.color : 'bg-white/10'}`}></div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Confirmar contraseña</label>
                                        <div className="relative">
                                            <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm"></i>
                                            <input type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                                className={`w-full bg-white/5 border rounded-xl py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                                                    confirmPassword && confirmPassword !== password
                                                        ? 'border-rose-500/50 focus:ring-rose-500/20'
                                                        : confirmPassword && confirmPassword === password
                                                            ? 'border-emerald-500/50 focus:ring-emerald-500/20'
                                                            : 'border-white/10 focus:border-blue-500/50 focus:ring-blue-500/20'
                                                }`}
                                                placeholder="••••••••" />
                                            {confirmPassword && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <i className={`fas text-sm ${confirmPassword === password ? 'fa-check-circle text-emerald-400' : 'fa-times-circle text-rose-400'}`}></i>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {error && <ErrorBanner msg={error} />}

                                    <div className="flex gap-3 mt-2">
                                        <button type="button" onClick={() => setStep(1)}
                                            className="py-4 px-5 bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-black rounded-xl transition-all text-sm">
                                            <i className="fas fa-arrow-left"></i>
                                        </button>
                                        <button type="submit" disabled={loading}
                                            className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3">
                                            {loading
                                                ? <><i className="fas fa-circle-notch fa-spin"></i><span>Registrando...</span></>
                                                : <><span>Completar Registro</span><i className="fas fa-user-check opacity-60"></i></>
                                            }
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Legal note */}
                            <p className="mt-6 text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                                Al registrarte aceptas el uso de tus datos con fines de auditoría interna.<br/>
                                Tu cuenta requiere aprobación de un administrador.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── Reusable error banner ─── */
const ErrorBanner: React.FC<{ msg: string }> = ({ msg }) => (
    <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-rose-400 animate-fade-in">
        <i className="fas fa-exclamation-circle mt-0.5 shrink-0"></i>
        <p className="text-xs font-bold leading-relaxed">{msg}</p>
    </div>
);

export default LoginView;
