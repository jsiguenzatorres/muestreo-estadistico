import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../services/AuthContext';

function pwStrength(pwd: string) {
    if (!pwd) return { score: 0, label: '', color: '' };
    let s = 0;
    if (pwd.length >= 8) s++;
    if (pwd.length >= 12) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    const map = ['', 'Muy débil', 'Regular', 'Buena', 'Fuerte', 'Excelente'];
    const colors = ['', 'bg-rose-500', 'bg-amber-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];
    return { score: s, label: map[Math.min(s, 5)], color: colors[Math.min(s, 5)] };
}

/**
 * Shown when user logs in for the first time with an admin-assigned temporary password.
 * Requires them to set a personal password before accessing the app.
 */
const ForcePasswordChangeView: React.FC = () => {
    const { user, profile, signOut } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm]   = useState('');
    const [showPw, setShowPw]     = useState(false);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState<string | null>(null);

    const strength = pwStrength(password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
        if (strength.score < 2)   { setError('La contraseña es demasiado débil. Usa al menos 8 caracteres con números.'); return; }
        setLoading(true); setError(null);
        try {
            const { error: err } = await supabase.auth.updateUser({
                password,
                data: { must_change_password: false }
            });
            if (err) throw err;
            // Reload so AuthContext re-reads user_metadata
            window.location.reload();
        } catch (err: any) {
            setError(err.message || 'No se pudo actualizar la contraseña.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#080e1a] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-amber-700/8 rounded-full blur-[130px] pointer-events-none"></div>
            <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-orange-700/6 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="relative w-full max-w-[440px] animate-fade-in-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 ring-1 ring-white/10 mx-auto mb-3">
                        <i className="fas fa-layer-group text-white text-xl"></i>
                    </div>
                    <h1 className="text-xl font-black text-white">AuditFlow</h1>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                    {/* Header banner */}
                    <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/15 border-b border-amber-500/20 px-7 py-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center shrink-0">
                            <i className="fas fa-shield-exclamation text-amber-400 text-sm"></i>
                        </div>
                        <div>
                            <p className="text-amber-300 font-black text-sm">Cambio de contraseña requerido</p>
                            <p className="text-amber-600 text-[10px] font-bold uppercase tracking-widest">Primer acceso al sistema</p>
                        </div>
                    </div>

                    <div className="p-7">
                        <div className="mb-6">
                            <p className="text-slate-300 text-sm leading-relaxed">
                                Hola <span className="text-white font-black">{profile?.full_name || 'Bienvenido'}</span> 👋<br />
                                Tu cuenta fue creada con una contraseña temporal. Por seguridad, debes establecer tu propia contraseña antes de continuar.
                            </p>
                        </div>

                        {/* Show logged-in email as read-only context (not an input) */}
                        {user?.email && (
                            <div className="flex items-center gap-2.5 bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 mb-4">
                                <i className="fas fa-user-circle text-slate-500 text-sm shrink-0"></i>
                                <span className="text-slate-400 text-xs font-medium truncate">{user.email}</span>
                                <span className="ml-auto text-[9px] font-black text-slate-600 uppercase tracking-widest shrink-0">Sesión activa</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                            {/*
                              Hidden username field — tells browsers/password-managers this is a
                              "change password" form (not a login form), suppressing credential autofill.
                              RFC: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill
                            */}
                            <input type="text" autoComplete="username" readOnly tabIndex={-1}
                                value={user?.email || ''} style={{ display: 'none' }} aria-hidden="true" />

                            {/* New password */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Nueva contraseña</label>
                                    {password && <span className={`text-[9px] font-black uppercase ${strength.score <= 2 ? 'text-rose-400' : strength.score === 3 ? 'text-amber-400' : 'text-emerald-400'}`}>{strength.label}</span>}
                                </div>
                                <div className="relative">
                                    <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"></i>
                                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                        autoComplete="new-password"
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
                                            <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= strength.score ? strength.color : 'bg-slate-700'}`}></div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Confirm */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Confirmar contraseña</label>
                                <div className="relative">
                                    <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none"></i>
                                    <input type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} required
                                        autoComplete="new-password"
                                        placeholder="••••••••"
                                        className={`w-full bg-slate-800/60 border rounded-xl py-3.5 pl-11 pr-10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${confirm && confirm !== password ? 'border-rose-500/50 focus:ring-rose-500/15' : confirm && confirm === password ? 'border-emerald-500/50 focus:ring-emerald-500/15' : 'border-slate-700/60 focus:border-blue-500/70 focus:ring-blue-500/15'}`} />
                                    {confirm && <i className={`fas absolute right-4 top-1/2 -translate-y-1/2 text-sm ${confirm === password ? 'fa-check-circle text-emerald-400' : 'fa-times-circle text-rose-400'}`}></i>}
                                </div>
                            </div>

                            {/* Requirements hint */}
                            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3.5 grid grid-cols-2 gap-y-1.5">
                                {[
                                    { ok: password.length >= 8, text: 'Mínimo 8 caracteres' },
                                    { ok: /[A-Z]/.test(password), text: 'Una mayúscula' },
                                    { ok: /[0-9]/.test(password), text: 'Un número' },
                                    { ok: /[^A-Za-z0-9]/.test(password), text: 'Un símbolo (recomendado)' },
                                ].map(({ ok, text }) => (
                                    <div key={text} className="flex items-center gap-2">
                                        <i className={`fas ${ok ? 'fa-check-circle text-emerald-400' : 'fa-circle text-slate-700'} text-[11px]`}></i>
                                        <span className={`text-[10px] font-bold ${ok ? 'text-slate-300' : 'text-slate-600'}`}>{text}</span>
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="flex gap-3 items-start bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 text-rose-300 text-xs font-medium">
                                    <i className="fas fa-circle-exclamation mt-0.5 shrink-0 text-rose-400"></i>
                                    <span>{error}</span>
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl text-sm shadow-lg shadow-blue-500/25 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2">
                                {loading
                                    ? <><i className="fas fa-circle-notch fa-spin"></i>Guardando...</>
                                    : <><span>Establecer contraseña y entrar</span><i className="fas fa-arrow-right opacity-50"></i></>}
                            </button>
                        </form>

                        <div className="mt-5 text-center">
                            <button onClick={() => signOut()} className="text-[11px] font-bold text-slate-600 hover:text-slate-400 transition-colors">
                                <i className="fas fa-power-off mr-1.5 opacity-60"></i>Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForcePasswordChangeView;
