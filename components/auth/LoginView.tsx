import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/* ─── Password strength ─── */
function pwStrength(pwd: string) {
    if (!pwd) return { score: 0, label: '', color: '' };
    let s = 0;
    if (pwd.length >= 8) s++;
    if (pwd.length >= 12) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    const map = [
        { label: 'Muy débil', color: 'bg-rose-500' },
        { label: 'Débil', color: 'bg-rose-500' },
        { label: 'Regular', color: 'bg-amber-400' },
        { label: 'Buena', color: 'bg-emerald-400' },
        { label: 'Fuerte', color: 'bg-emerald-500' },
        { label: 'Excelente', color: 'bg-emerald-600' },
    ];
    return { score: s, ...map[Math.min(s, 5)] };
}

type Mode = 'login' | 'forgot' | 'register';

/* ─── Shared input ─── */
const Field: React.FC<{
    label: string; icon: string; type?: string;
    value: string; onChange: (v: string) => void;
    placeholder?: string; right?: React.ReactNode;
    className?: string;
}> = ({ label, icon, type = 'text', value, onChange, placeholder, right, className }) => (
    <div className={className}>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">{label}</label>
        <div className="relative">
            <i className={`fas ${icon} absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none`}></i>
            <input
                type={type} value={value} onChange={e => onChange(e.target.value)}
                placeholder={placeholder} required
                className="w-full bg-slate-800/60 border border-slate-700/60 hover:border-slate-600/80 rounded-xl py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15 transition-all"
            />
            {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
        </div>
    </div>
);

/* ─── Error banner ─── */
const ErrorMsg: React.FC<{ msg: string }> = ({ msg }) => (
    <div className="flex gap-3 items-start bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 text-rose-300 text-xs font-medium">
        <i className="fas fa-circle-exclamation mt-0.5 shrink-0 text-rose-400"></i>
        <span>{msg}</span>
    </div>
);

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
const LoginView: React.FC = () => {
    const [mode, setMode] = useState<Mode>('login');
    const [step, setStep] = useState<1 | 2>(1);

    const [email, setEmail]           = useState('');
    const [password, setPassword]     = useState('');
    const [confirm, setConfirm]       = useState('');
    const [fullName, setFullName]     = useState('');
    const [role, setRole]             = useState<'Auditor' | 'Supervisor'>('Auditor');
    const [showPw, setShowPw]         = useState(false);

    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState<string | null>(null);
    const [success, setSuccess]       = useState<'register' | 'forgot' | null>(null);

    /* rotating badge text */
    const BADGES = ['ISO 19011', 'NIA 530', 'ISSAI 3000', 'INTOSAI'];
    const [badgeIdx, setBadgeIdx] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setBadgeIdx(i => (i + 1) % BADGES.length), 2800);
        return () => clearInterval(t);
    }, []);

    const strength = pwStrength(password);

    const switchMode = (m: Mode) => {
        setMode(m); setStep(1); setError(null); setSuccess(null);
        setEmail(''); setPassword(''); setConfirm(''); setFullName('');
    };

    /* ── REGISTER step 1 ── */
    const handleStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) { setError('Ingresa tu nombre completo.'); return; }
        setError(null); setStep(2);
    };

    /* ── FORGOT PASSWORD ── */
    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/?reset=1`
            });
            if (err) throw err;
            setSuccess('forgot');
        } catch (err: any) {
            setError(err.message || 'Error al enviar el correo.');
        } finally {
            setLoading(false);
        }
    };

    /* ── LOGIN ── */
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            const { error: err } = await supabase.auth.signInWithPassword({ email, password });
            if (err) throw err;
        } catch (err: any) {
            setError(err.message === 'Invalid login credentials'
                ? 'Credenciales incorrectas. Verifica tu correo y contraseña.'
                : err.message || 'Error al iniciar sesión.');
        } finally {
            setLoading(false);
        }
    };

    /* ── REGISTER ── */
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
        if (strength.score < 2)   { setError('La contraseña es demasiado débil.'); return; }
        setLoading(true); setError(null);
        try {
            const deviceInfo  = `${navigator.platform} - ${navigator.vendor}`;
            const browserInfo = navigator.userAgent;
            let loc = 'Desconocida';
            try {
                const g = await (await fetch('https://ipapi.co/json/')).json();
                loc = `${g.city}, ${g.region}, ${g.country_name} (IP: ${g.ip})`;
            } catch { /* optional */ }

            const { error: err } = await supabase.auth.signUp({
                email, password,
                options: { data: { full_name: fullName, role, device_info: deviceInfo, browser_info: browserInfo, registration_location: loc } }
            });
            if (err) throw err;
            setSuccess('register');
        } catch (err: any) {
            setError(err.message || 'Error en el registro.');
        } finally {
            setLoading(false);
        }
    };

    /* ══════════ SUCCESS SCREENS ══════════ */
    if (success === 'forgot') return (
        <Screen>
            <div className="text-center">
                <div className="relative mx-auto mb-8 w-20 h-20">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-2xl animate-ping"></div>
                    <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                        <i className="fas fa-paper-plane text-3xl text-white"></i>
                    </div>
                </div>
                <h2 className="text-2xl font-black text-white mb-3">¡Correo enviado!</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-2">
                    Revisa tu bandeja de entrada en <span className="text-blue-400 font-bold">{email}</span>.
                </p>
                <p className="text-slate-500 text-xs mb-8">
                    El enlace expira en 1 hora. Si no lo ves, revisa spam.
                </p>
                <button onClick={() => switchMode('login')} className="btn-primary w-full">
                    <i className="fas fa-arrow-left mr-2 opacity-60"></i>Volver al inicio de sesión
                </button>
            </div>
        </Screen>
    );

    if (success === 'register') return (
        <Screen>
            <div className="text-center">
                <div className="relative mx-auto mb-8 w-20 h-20">
                    <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl animate-ping"></div>
                    <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                        <i className="fas fa-check-double text-3xl text-white"></i>
                    </div>
                </div>
                <h2 className="text-2xl font-black text-white mb-3">¡Solicitud enviada!</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                    Un administrador revisará tu solicitud y activará tu cuenta.
                </p>
                <div className="grid grid-cols-3 gap-2 mb-8 text-center">
                    {['Registrado', 'En revisión', 'Activación'].map((s, i) => (
                        <div key={s} className={`rounded-xl p-3 border ${i === 0 ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-white/4 border-white/8'}`}>
                            <div className={`w-5 h-5 rounded-full mx-auto mb-1.5 flex items-center justify-center text-[9px] font-black ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                                {i === 0 ? '✓' : i + 1}
                            </div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{s}</p>
                        </div>
                    ))}
                </div>
                <button onClick={() => switchMode('login')} className="btn-primary w-full">
                    <i className="fas fa-sign-in-alt mr-2 opacity-60"></i>Ir al inicio de sesión
                </button>
            </div>
        </Screen>
    );

    /* ══════════ MAIN CARD ══════════ */
    return (
        <div className="min-h-screen bg-[#080e1a] flex items-center justify-center p-4 relative overflow-hidden">

            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-blue-700/12 rounded-full blur-[130px]"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-indigo-700/10 rounded-full blur-[150px]"></div>
                <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-cyan-600/6 rounded-full blur-[90px]"></div>
                {/* Subtle grid */}
                <div className="absolute inset-0 opacity-[0.025]"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }}>
                </div>
            </div>

            <div className="relative w-full max-w-[440px] animate-fade-in-up">

                {/* ── Logo ── */}
                <div className="text-center mb-8">
                    <div className="inline-flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 ring-1 ring-white/10">
                            <i className="fas fa-layer-group text-white text-2xl"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">AuditFlow</h1>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] transition-all duration-500">
                                    {BADGES[badgeIdx]}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Card ── */}
                <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

                    {/* Tab switcher — only for login/register */}
                    {mode !== 'forgot' && (
                        <div className="flex bg-slate-950/60 border-b border-slate-800/80">
                            {(['login', 'register'] as Mode[]).map(m => (
                                <button key={m} onClick={() => switchMode(m)}
                                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === m ? 'text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>
                                    {m === 'login' ? <><i className="fas fa-sign-in-alt mr-2"></i>Acceder</> : <><i className="fas fa-user-plus mr-2"></i>Registrarse</>}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="p-7">

                        {/* ══ LOGIN ══ */}
                        {mode === 'login' && (
                            <>
                                <div className="mb-6">
                                    <h2 className="text-lg font-black text-white">Bienvenido de nuevo</h2>
                                    <p className="text-slate-500 text-xs mt-1">Ingresa tus credenciales para continuar</p>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-4">
                                    <Field label="Correo electrónico" icon="fa-envelope"
                                        type="email" value={email} onChange={setEmail}
                                        placeholder="correo@empresa.com" />

                                    <Field label="Contraseña" icon="fa-key"
                                        type={showPw ? 'text' : 'password'}
                                        value={password} onChange={setPassword}
                                        placeholder="••••••••"
                                        right={
                                            <button type="button" onClick={() => setShowPw(p => !p)}
                                                className="text-slate-500 hover:text-slate-300 transition-colors p-1">
                                                <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                                            </button>
                                        } />

                                    {error && <ErrorMsg msg={error} />}

                                    <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
                                        {loading
                                            ? <><i className="fas fa-circle-notch fa-spin mr-2"></i>Verificando...</>
                                            : <><span>Entrar al Sistema</span><i className="fas fa-arrow-right ml-2 opacity-50"></i></>}
                                    </button>
                                </form>

                                <div className="mt-5 text-center">
                                    <button onClick={() => { setMode('forgot'); setError(null); setEmail(''); }}
                                        className="text-[11px] font-bold text-slate-500 hover:text-blue-400 transition-colors">
                                        <i className="fas fa-lock mr-1.5 opacity-60"></i>¿Olvidaste tu contraseña?
                                    </button>
                                </div>

                                <div className="mt-5 pt-5 border-t border-slate-800 flex items-center justify-center gap-3">
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold">
                                        <i className="fas fa-shield-halved text-slate-700"></i>
                                        Conexión cifrada SSL
                                    </div>
                                    <div className="w-px h-3 bg-slate-800"></div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold">
                                        <i className="fas fa-user-lock text-slate-700"></i>
                                        Acceso por autorización
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ══ FORGOT PASSWORD ══ */}
                        {mode === 'forgot' && (
                            <>
                                <button onClick={() => switchMode('login')}
                                    className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-bold mb-5">
                                    <i className="fas fa-arrow-left text-xs"></i>
                                    Volver
                                </button>
                                <div className="mb-6">
                                    <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/25 rounded-xl flex items-center justify-center mb-4">
                                        <i className="fas fa-key text-blue-400"></i>
                                    </div>
                                    <h2 className="text-lg font-black text-white">Recuperar contraseña</h2>
                                    <p className="text-slate-500 text-xs mt-1">
                                        Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
                                    </p>
                                </div>

                                <form onSubmit={handleForgot} className="space-y-4">
                                    <Field label="Correo electrónico" icon="fa-envelope"
                                        type="email" value={email} onChange={setEmail}
                                        placeholder="correo@empresa.com" />

                                    {error && <ErrorMsg msg={error} />}

                                    <button type="submit" disabled={loading} className="btn-primary w-full">
                                        {loading
                                            ? <><i className="fas fa-circle-notch fa-spin mr-2"></i>Enviando...</>
                                            : <><i className="fas fa-paper-plane mr-2 opacity-60"></i>Enviar enlace de recuperación</>}
                                    </button>
                                </form>
                            </>
                        )}

                        {/* ══ REGISTER step 1 ══ */}
                        {mode === 'register' && step === 1 && (
                            <>
                                <StepIndicator current={1} />

                                <div className="mb-5">
                                    <h2 className="text-lg font-black text-white">Tu perfil</h2>
                                    <p className="text-slate-500 text-xs mt-1">Cuéntanos quién eres en la firma</p>
                                </div>

                                <form onSubmit={handleStep1} className="space-y-5">
                                    <Field label="Nombre completo" icon="fa-user"
                                        value={fullName} onChange={setFullName}
                                        placeholder="Ej: María González Ruiz" />

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-3">Rol solicitado</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {(['Auditor', 'Supervisor'] as const).map(r => (
                                                <button key={r} type="button" onClick={() => setRole(r)}
                                                    className={`relative py-5 rounded-xl border transition-all ${role === r
                                                        ? 'bg-blue-600/15 border-blue-500/50 shadow-lg shadow-blue-500/10'
                                                        : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/70'}`}>
                                                    {role === r && (
                                                        <span className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                                            <i className="fas fa-check text-[8px] text-white"></i>
                                                        </span>
                                                    )}
                                                    <i className={`fas ${r === 'Auditor' ? 'fa-file-pen' : 'fa-eye'} text-xl mb-2 block ${role === r ? 'text-blue-400' : 'text-slate-600'}`}></i>
                                                    <p className={`text-xs font-black uppercase tracking-wide ${role === r ? 'text-white' : 'text-slate-500'}`}>{r}</p>
                                                    <p className="text-[9px] text-slate-600 mt-0.5">{r === 'Auditor' ? 'Ejecuta muestreos' : 'Revisa resultados'}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {error && <ErrorMsg msg={error} />}

                                    <button type="submit" className="btn-primary w-full">
                                        Siguiente<i className="fas fa-arrow-right ml-2 opacity-50"></i>
                                    </button>
                                </form>
                            </>
                        )}

                        {/* ══ REGISTER step 2 ══ */}
                        {mode === 'register' && step === 2 && (
                            <>
                                <StepIndicator current={2} />

                                {/* Profile pill */}
                                <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 mb-5">
                                    <div className="w-9 h-9 bg-blue-600/20 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                                        {fullName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-black text-sm truncate">{fullName}</p>
                                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest">{role}</p>
                                    </div>
                                    <button type="button" onClick={() => { setStep(1); setError(null); }}
                                        className="text-slate-500 hover:text-blue-400 transition-colors text-[10px] font-black uppercase tracking-widest">
                                        <i className="fas fa-pen mr-1 text-[9px]"></i>Editar
                                    </button>
                                </div>

                                <form onSubmit={handleRegister} className="space-y-4">
                                    <Field label="Correo electrónico" icon="fa-envelope"
                                        type="email" value={email} onChange={setEmail}
                                        placeholder="correo@empresa.com" />

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Contraseña</label>
                                            {password && <span className={`text-[9px] font-black uppercase tracking-wide ${strength.score <= 2 ? 'text-rose-400' : strength.score === 3 ? 'text-amber-400' : 'text-emerald-400'}`}>{strength.label}</span>}
                                        </div>
                                        <div className="relative">
                                            <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"></i>
                                            <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                                placeholder="Mínimo 8 caracteres"
                                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/15 transition-all" />
                                            <button type="button" onClick={() => setShowPw(p => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1">
                                                <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                                            </button>
                                        </div>
                                        {password && (
                                            <div className="flex gap-1 mt-2">
                                                {[1,2,3,4,5].map(n => (
                                                    <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-300 ${n <= strength.score ? strength.color : 'bg-slate-700'}`}></div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Confirmar contraseña</label>
                                        <div className="relative">
                                            <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"></i>
                                            <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required
                                                placeholder="••••••••"
                                                className={`w-full bg-slate-800/60 border rounded-xl py-3.5 pl-11 pr-10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${confirm && confirm !== password ? 'border-rose-500/50 focus:ring-rose-500/15' : confirm && confirm === password ? 'border-emerald-500/50 focus:ring-emerald-500/15' : 'border-slate-700/60 focus:border-blue-500/70 focus:ring-blue-500/15'}`} />
                                            {confirm && (
                                                <i className={`fas absolute right-4 top-1/2 -translate-y-1/2 text-sm ${confirm === password ? 'fa-check-circle text-emerald-400' : 'fa-times-circle text-rose-400'}`}></i>
                                            )}
                                        </div>
                                    </div>

                                    {error && <ErrorMsg msg={error} />}

                                    <div className="flex gap-2 pt-1">
                                        <button type="button" onClick={() => { setStep(1); setError(null); }}
                                            className="p-3.5 bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 rounded-xl transition-all">
                                            <i className="fas fa-arrow-left"></i>
                                        </button>
                                        <button type="submit" disabled={loading} className="btn-primary flex-1">
                                            {loading
                                                ? <><i className="fas fa-circle-notch fa-spin mr-2"></i>Registrando...</>
                                                : <><span>Completar registro</span><i className="fas fa-user-check ml-2 opacity-50"></i></>}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}

                    </div>
                </div>

                <p className="text-center text-[10px] text-slate-700 font-bold uppercase tracking-[0.2em] mt-6">
                    &copy; 2026 iNova Tech Systems · Enterprise v3.0
                </p>
            </div>

            {/* Global styles injected once */}
            <style>{`
                .btn-primary {
                    display: inline-flex; align-items: center; justify-content: center;
                    padding: 0.875rem 1.5rem;
                    background: linear-gradient(135deg, #2563eb, #4f46e5);
                    color: white; font-weight: 900; border-radius: 0.75rem;
                    box-shadow: 0 8px 24px -4px rgba(37,99,235,.35);
                    transition: all .2s;
                    font-size: 0.8125rem; letter-spacing: .025em;
                    border: none; cursor: pointer;
                }
                .btn-primary:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 12px 28px -4px rgba(37,99,235,.45); }
                .btn-primary:active:not(:disabled) { transform: translateY(0); }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
};

/* ─── Step indicator for register ─── */
const StepIndicator: React.FC<{ current: 1 | 2 }> = ({ current }) => (
    <div className="flex items-center gap-3 mb-5">
        {[1, 2].map(n => (
            <React.Fragment key={n}>
                <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${current > n ? 'bg-emerald-500 text-white' : current === n ? 'bg-blue-600 text-white ring-4 ring-blue-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                        {current > n ? <i className="fas fa-check text-[8px]"></i> : n}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${current === n ? 'text-white' : 'text-slate-600'}`}>
                        {n === 1 ? 'Tu perfil' : 'Credenciales'}
                    </span>
                </div>
                {n < 2 && <div className={`flex-1 h-px ${current > 1 ? 'bg-emerald-500/40' : 'bg-slate-800'}`}></div>}
            </React.Fragment>
        ))}
    </div>
);

/* ─── Wrapper for success screens ─── */
const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-[#080e1a] flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-2xl p-10 shadow-2xl shadow-black/50">
            {children}
        </div>
    </div>
);

export default LoginView;
