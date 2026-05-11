import React, { useState, useEffect } from 'react';
import { AppState, AuditObservation } from '../../types';
import { useAuth } from '../../services/AuthContext';
import { observationService } from '../../services/observationService';

interface AuditExpedienteViewProps {
    appState: AppState;
    onBack: () => void;
}

const AuditExpedienteView: React.FC<AuditExpedienteViewProps> = ({ appState, onBack }) => {
    const { profile } = useAuth();
    const [observations, setObservations] = useState<AuditObservation[]>([]);
    const [selectedObs, setSelectedObs] = useState<AuditObservation | null>(null);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);

    const isSupervisor = profile?.role === 'Supervisor';

    useEffect(() => {
        if (appState.selectedPopulation?.id) {
            loadObservations();
        }
    }, [appState.selectedPopulation?.id]);

    const loadObservations = async () => {
        try {
            setLoading(true);
            const data = await observationService.getObservations(appState.selectedPopulation!.id!);
            setObservations(data);
        } catch (err) {
            console.error("Error loading observations:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!selectedObs || !newComment.trim() || !profile) return;

        const updatedComments = [
            ...(selectedObs.review_comments || []),
            {
                user: profile.full_name || 'Supervisor',
                comment: newComment.trim(),
                date: new Date().toISOString()
            }
        ];

        try {
            await observationService.updateReviewComments(selectedObs.id!, updatedComments);
            setObservations(prev => prev.map(o => o.id === selectedObs.id ? { ...o, review_comments: updatedComments } : o));
            setSelectedObs({ ...selectedObs, review_comments: updatedComments });
            setNewComment('');
        } catch (err) {
            alert("Error al guardar el comentario de revisión.");
        }
    };

    return (
        <div className="min-h-screen bg-[#F4F7F9] p-8 animate-fade-in">
            {/* HEADER */}
            <div className="bg-[#0A2540] rounded-t-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 scale-150">
                    <i className="fas fa-folder-tree text-[10rem]"></i>
                </div>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-indigo-400">
                            <i className="fas fa-file-invoice text-2xl"></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">Expediente de Auditoría</h2>
                            <p className="text-indigo-300/80 text-xs font-bold uppercase tracking-widest">{appState.selectedPopulation?.name || 'VISTA MAESTRA'}</p>
                        </div>
                    </div>
                    <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
                        <i className="fas fa-times text-2xl"></i>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-b-[2rem] border-x border-b border-slate-200 shadow-sm min-h-[600px] flex overflow-hidden">
                {/* LISTA DE HALLAZGOS (IZQUIERDA) */}
                <div className="w-1/3 border-r border-slate-100 flex flex-col">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hallazgos Detectados</h3>
                        <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black">{observations.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-slate-300">Cargando...</div>
                        ) : observations.length === 0 ? (
                            <div className="p-8 text-center text-slate-300 text-xs font-bold italic">No hay hallazgos documentados.</div>
                        ) : (
                            observations.map(obs => (
                                <div
                                    key={obs.id}
                                    onClick={() => setSelectedObs(obs)}
                                    className={`p-6 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${selectedObs?.id === obs.id ? 'bg-blue-50/50 border-r-4 border-r-blue-500' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${obs.severidad === 'Crítica' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {obs.severidad}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400">{new Date(obs.fecha_hallazgo).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700 line-clamp-2">{obs.descripcion_hallazgo}</p>
                                    {obs.review_comments?.length ? (
                                        <div className="mt-2 flex items-center gap-1 text-[9px] font-black text-indigo-500 uppercase">
                                            <i className="fas fa-comment-check"></i> Revisado
                                        </div>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* DETALLE (DERECHA) */}
                <div className="flex-1 bg-slate-50/30 flex flex-col">
                    {selectedObs ? (
                        <>
                            <div className="p-8 bg-white border-b border-slate-100">
                                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-4">Detalle del Hallazgo</h4>
                                <h3 className="text-xl font-black text-slate-800 mb-2">{selectedObs.descripcion_hallazgo}</h3>
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedObs.impacto}</p>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Control Fallido</p>
                                        <p className="text-sm font-bold text-slate-700">{selectedObs.control_fallido}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-8 overflow-y-auto">
                                {/* SECCIÓN DE COMENTARIOS DE CALIDAD */}
                                <div className="max-w-2xl">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs">
                                            <i className="fas fa-shield-check"></i>
                                        </div>
                                        <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest">Revisión de Calidad (Supervisor)</h5>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        {selectedObs.review_comments?.length ? (
                                            selectedObs.review_comments.map((rc, i) => (
                                                <div key={i} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[10px] font-black text-indigo-600 uppercase">{rc.user}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">{new Date(rc.date).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-600 italic">"{rc.comment}"</p>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No hay comentarios de revisión aún.</p>
                                        )}
                                    </div>

                                    {isSupervisor && (
                                        <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-dashed border-indigo-200">
                                            <textarea
                                                value={newComment}
                                                onChange={(e) => setNewComment(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="Agregar comentario de validación técnica o sugerencia de corrección..."
                                                rows={3}
                                            />
                                            <div className="flex justify-end mt-4">
                                                <button
                                                    onClick={handleAddComment}
                                                    disabled={!newComment.trim()}
                                                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                                                >
                                                    Publicar Revisión
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50">
                            <i className="fas fa-mouse-pointer text-4xl mb-4"></i>
                            <p className="text-sm font-black uppercase tracking-widest">Selecciona un hallazgo para revisar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditExpedienteView;
