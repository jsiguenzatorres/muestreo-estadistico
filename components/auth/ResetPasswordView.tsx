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
 * Shown when user arrives from "Forgot password" email link (PASSWORD_RECOVERY event).
 */
const ResetPasswordView: React.FC = () => {
    const { clearRecoveryMode } = useAuth();
    const [password, setPassword]   = useState('');
    const [confirm, setConfirm]     = useState('');
    const [showPw, setShowPw]       = useState(false);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState<string | null>(null);
    const [done, setDone]           = useState(false);

    const strength = pwStrength(password);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm)  { setError('Las contraseñas no coinciden.'); return; }
        if (strength.score < 2)    { setError('La contraseña es demasiado débil.'); return; }
        setLoading(true); setError(null);
        try {
            const { error: err } = await supabase.auth.updateUser({ password });
            if (err) throw err;
            setDone(true);
        } catch (err: any) {
            setError(err.message || 'No se pudo actualizar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#080e1a] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-blue-700/12 rounded-full blur-[130px] pointer-events-none"></div>
            <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] bg-indigo-700/10 rounded-full blur-[150px] pointer-events-none"></div>

            <div className="relative w-full max-w-[420px] animate-fade-in-up">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 ring-1 ring-white/10 mx-auto mb-3">
                        <i className="fas fa-layer-group text-white text-xl"></i>
                    </div>
                    <h1 className="text-xl font-black text-white">AuditFlow</h1>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 p-8">
                    {done ? (
                        <div className="text-center">
                            <div className="relative mx-auto mb-6 w-16 h-16">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl animate-ping"></div>
                                <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                                    <i className="fas fa-check text-2xl text-white"></i>
                                </div>
                            </div>
                            <h2 className="text-xl font-black text-white mb-3">¡Contraseña actualizada!</h2>
                            <p className="text-slate-400 text-sm mb-6">Tu nueva contraseña ha sido establecida correctamente.</p>
                            <button onClick={clearRecoveryMode}
                                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-xl text-sm hover:brightness-110 transition-all">
                                <i className="fas fa-sign-in-alt mr-2 opacity-60"></i>Ir al sistema
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/25 rounded-xl flex items-center justify-center mb-4">
                                    <i className="fas fa-key text-blue-400"></i>
                                </div>
                                <h2 className="text-lg font-black text-white">Nueva contraseña</h2>
                                <p className="text-slate-500 text-xs mt-1">Elige una contraseña segura para tu cuenta.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Password */}
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Nueva contraseña</label>
                                        {password && <span className={`text-[9px] font-black uppercase ${strength.score <= 2 ? 'text-rose-400' : strength.score === 3 ? 'text-amber-400' : 'text-emerald-400'}`}>{strength.label}</span>}
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
                                            placeholder="••••••••"
                                            className={`w-full bg-slate-800/60 border rounded-xl py-3.5 pl-11 pr-10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${confirm && confirm !== password ? 'border-rose-500/50 focus:ring-rose-500/15' : confirm && confirm === password ? 'border-emerald-500/50 focus:ring-emerald-500/15' : 'border-slate-700/60 focus:border-blue-500/70 focus:ring-blue-500/15'}`} />
                                        {confirm && <i className={`fas absolute right-4 top-1/2 -translate-y-1/2 text-sm ${confirm === password ? 'fa-check-circle text-emerald-400' : 'fa-times-circle text-rose-400'}`}></i>}
                                    </div>
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
                                        ? <><i className="fas fa-circle-notch fa-spin"></i>Actualizando...</>
                                        : <><span>Establecer nueva contraseña</span><i className="fas fa-arrow-right opacity-50"></i></>}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordView;
