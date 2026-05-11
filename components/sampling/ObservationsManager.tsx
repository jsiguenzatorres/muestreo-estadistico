
import React, { useState, useEffect, useRef } from 'react';
import { SamplingMethod, AuditObservation, ObservationEvidence } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../ui/ToastContext';
import Modal from '../ui/Modal';
import { generateObservationsReport } from '../../services/observationsReportService';

interface Props {
    populationId: string;
    method: SamplingMethod;
    onObservationsUpdate: (obs: AuditObservation[]) => void;
}

const CURRENT_USER = "Auditor Principal";
const STORAGE_BUCKET = "evidencias_auditoria";

const ObservationsManager: React.FC<Props> = ({ populationId, method, onObservationsUpdate }) => {
    const [observations, setObservations] = useState<AuditObservation[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [obsToDelete, setObsToDelete] = useState<string | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    const [formData, setFormData] = useState<Partial<AuditObservation>>({
        titulo: '',
        descripcion: '',
        severidad: 'Medio',
        tipo: 'Sustantivo',
        monto_observado: undefined,
        evidencias: []
    });

    useEffect(() => {
        fetchObservations();
    }, [populationId, method]);

    const fetchObservations = async () => {
        setLoading(true);
        try {
            // FETCH VIA PROXY (Firewall Bypass)
            const res = await fetch(`/api/sampling_proxy?action=get_observations&population_id=${populationId}`);
            if (!res.ok) throw new Error("Proxy Fetch Failed");

            const { observations: data } = await res.json();

            if (data) {
                const methodFiltered = data.filter((o: any) => o.metodo === method);

                const formattedData = methodFiltered.map((obs: any) => ({
                    ...obs,
                    evidencias: Array.isArray(obs.evidencias) ? obs.evidencias : []
                }));
                setObservations(formattedData as AuditObservation[]);
                onObservationsUpdate(formattedData as AuditObservation[]);
            }
        } catch (err) {
            console.error("Error al cargar observaciones (Proxy):", err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            addToast("El archivo es demasiado grande. El límite es 10MB.", 'error');
            return;
        }

        setUploadingFile(true);
        try {
            const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const fileExt = cleanFileName.split('.').pop();
            const uniqueName = `${Math.random().toString(36).substring(2, 10)}-${Date.now()}.${fileExt}`;
            const filePath = `${populationId}/${uniqueName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                const status = (uploadError as any).statusCode;

                if (status === "403" || (uploadError as any).message?.toLowerCase().includes("permission denied")) {
                    const errorMsg = `ERROR DE PERMISOS (RLS).\n\nPara solucionar esto rápido:\n1. Ve al "SQL Editor" de Supabase.\n2. Pega y corre este código:\n\nCREATE POLICY "Public Access" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = '${STORAGE_BUCKET}');`;
                    throw new Error(errorMsg);
                }

                throw uploadError;
            }

            const { data: urlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(filePath);

            const nuevaEvidencia: ObservationEvidence = {
                nombre: file.name,
                url: urlData.publicUrl,
                tipo: file.type || 'application/octet-stream'
            };

            setFormData(prev => ({
                ...prev,
                evidencias: [...(prev.evidencias || []), nuevaEvidencia]
            }));

        } catch (err: any) {
            console.error("Error subida:", err);
            addToast(err.message, 'error');
        } finally {
            setUploadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeEvidence = (index: number) => {
        setFormData(prev => ({
            ...prev,
            evidencias: prev.evidencias?.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        if (!formData.titulo || !formData.descripcion) {
            addToast("Los campos Título y Descripción son obligatorios.", 'error');
            return;
        }

        setIsSaving(true);
        try {
            // PROXY SAVE (Firewall Bypass)
            const finalEvidencias = Array.isArray(formData.evidencias) ? formData.evidencias : [];
            const payload = {
                id: editingId || undefined,
                titulo: formData.titulo,
                descripcion: formData.descripcion,
                severidad: formData.severidad,
                tipo: formData.tipo,
                monto_observado: formData.monto_observado ?? null,
                evidencias: finalEvidencias,
                id_poblacion: populationId,
                metodo: method,
                creado_por: CURRENT_USER
            };

            const res = await fetch('/api/sampling_proxy?action=save_observation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Proxy Error: ${errText}`);
            }

            await fetchObservations();
            setIsAdding(false);
            setEditingId(null);
            setFormData({ titulo: '', descripcion: '', severidad: 'Medio', tipo: 'Sustantivo', monto_observado: undefined, evidencias: [] });

        } catch (err: any) {
            addToast(`ERROR AL GUARDAR (PROXY): ${err.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!obsToDelete) return;
        const id = obsToDelete;
        setObsToDelete(null);
        try {
            // PROXY DELETE
            const res = await fetch('/api/sampling_proxy?action=delete_observation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

            if (!res.ok) throw new Error("Delete Failed");

            await fetchObservations();
        } catch (err: any) {
            addToast("No se pudo eliminar (Proxy Error).", 'error');
        }
    };

    const startEdit = (obs: AuditObservation) => {
        setEditingId(obs.id!);
        setFormData({
            titulo: obs.titulo,
            descripcion: obs.descripcion,
            severidad: obs.severidad,
            tipo: obs.tipo,
            monto_observado: obs.monto_observado,
            evidencias: Array.isArray(obs.evidencias) ? [...obs.evidencias] : []
        });
        setIsAdding(false);
    };

    const getFileIcon = (tipo: string) => {
        if (tipo.includes('pdf')) return 'fa-file-pdf text-rose-500';
        if (tipo.includes('image')) return 'fa-file-image text-blue-500';
        if (tipo.includes('excel') || tipo.includes('spreadsheet') || tipo.includes('sheet')) return 'fa-file-excel text-emerald-600';
        return 'fa-file-alt text-slate-400';
    };

    const handleExportReport = async () => {
        if (isGeneratingReport) return;
        
        setIsGeneratingReport(true);
        try {
            await generateObservationsReport({
                populationName: `Población ID: ${populationId}`,
                samplingMethod: method,
                observations: observations,
                generatedBy: CURRENT_USER,
                generatedDate: new Date()
            });
            
            addToast('Expediente PDF generado exitosamente', 'success');
        } catch (error) {
            console.error('Error generando expediente:', error);
            addToast('Error al generar el expediente PDF', 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-5">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-cyan-400 shadow-xl ring-4 ring-slate-50">
                        <i className="fas fa-microscope text-xl"></i>
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Expediente de Hallazgos</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Control de Evidencia NIA 530</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleExportReport}
                        disabled={isGeneratingReport}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 shadow-lg transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGeneratingReport ? (
                            <>
                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                Generando...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-file-pdf mr-2"></i>
                                Exportar PDF
                            </>
                        )}
                    </button>
                    {!isAdding && !editingId && (
                        <button onClick={() => setIsAdding(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg transition-all flex items-center">
                            <i className="fas fa-plus mr-2"></i> Documentar Observación
                        </button>
                    )}
                </div>
            </div>

            {(isAdding || editingId) && (
                <div className="bg-white border-2 border-slate-200 rounded-[2.5rem] p-10 shadow-2xl animate-fade-in-up">
                    <div className="flex justify-between items-center mb-10">
                        <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                            {editingId ? 'Modificar Registro' : 'Nueva Entrada de Papel de Trabajo'}
                        </h4>
                        <button onClick={() => { setEditingId(null); setIsAdding(false); }} className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-rose-500">
                            <i className="fas fa-times mr-1"></i> Cancelar
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Título</label>
                            <input type="text" value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} className="w-full px-6 py-4 rounded-2xl border-slate-200 bg-slate-50 text-xs font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Severidad</label>
                            <select value={formData.severidad} onChange={e => setFormData({ ...formData, severidad: e.target.value as any })} className="w-full px-6 py-4 rounded-2xl border-slate-200 bg-slate-50 text-xs font-black">
                                <option value="Bajo">Bajo</option>
                                <option value="Medio">Medio</option>
                                <option value="Alto">Alto</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Tipo</label>
                            <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value as any })} className="w-full px-6 py-4 rounded-2xl border-slate-200 bg-slate-50 text-xs font-black">
                                <option value="Control">Control</option>
                                <option value="Sustantivo">Sustantivo</option>
                                <option value="Cumplimiento">Cumplimiento</option>
                            </select>
                        </div>
                    </div>
                    <div className="mb-8">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Monto Observado <span className="text-slate-300 normal-case font-medium">(opcional)</span></label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.monto_observado ?? ''}
                            onChange={e => setFormData({ ...formData, monto_observado: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="w-full px-6 py-4 rounded-2xl border-slate-200 bg-slate-50 text-xs font-bold"
                        />
                    </div>

                    <div className="mb-8">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Descripción</label>
                        <textarea value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full px-6 py-6 rounded-[2rem] border-slate-200 bg-slate-50 text-xs font-medium min-h-[120px]" />
                    </div>

                    <div className="mb-10 p-8 bg-blue-50/40 border-2 border-dashed border-blue-200 rounded-[2rem]">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Evidencias</span>
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="px-5 py-2.5 bg-white border border-blue-200 rounded-xl text-[9px] font-black uppercase text-blue-600">
                                {uploadingFile ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-cloud-upload-alt mr-2"></i>}
                                Adjuntar
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {formData.evidencias?.map((ev, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-blue-100 shadow-sm animate-fade-in">
                                    <div className="flex items-center overflow-hidden">
                                        <i className={`fas ${getFileIcon(ev.tipo)} mr-3 text-lg`}></i>
                                        <span className="text-[10px] font-bold truncate max-w-[150px]">{ev.nombre}</span>
                                    </div>
                                    <button onClick={() => removeEvidence(idx)} className="text-slate-300 hover:text-rose-500 transition-colors ml-4">
                                        <i className="fas fa-times-circle"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleSave} disabled={isSaving || uploadingFile} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-[12px] uppercase tracking-[0.3em] shadow-xl hover:bg-black transition-all">
                        {isSaving ? <i className="fas fa-spinner fa-spin mr-3"></i> : <i className="fas fa-save mr-3 text-cyan-400"></i>}
                        Sincronizar Observación
                    </button>
                </div>
            )}

            <div className="space-y-6">
                {loading ? (
                    <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-4xl text-blue-200 mb-4"></i></div>
                ) : observations.length === 0 ? (
                    !isAdding && <div className="text-center py-24 border-4 border-dashed border-slate-50 rounded-[3rem] bg-slate-50/20 text-slate-300 font-black uppercase">Sin Hallazgos</div>
                ) : (
                    (['Alto', 'Medio', 'Bajo'] as const).map(nivel => {
                        const grupo = observations.filter(o => o.severidad === nivel);
                        if (grupo.length === 0) return null;
                        const color = nivel === 'Alto' ? { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' }
                            : nivel === 'Medio' ? { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' }
                            : { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' };

                        // Agrupar por Tipo dentro del nivel de riesgo
                        const porTipo = grupo.reduce<Record<string, typeof grupo>>((acc, obs) => {
                            const t = obs.tipo || 'Sin Tipo';
                            if (!acc[t]) acc[t] = [];
                            acc[t].push(obs);
                            return acc;
                        }, {});

                        const totalMonto = grupo.reduce((s, o) => s + (o.monto_observado || 0), 0);

                        return (
                            <div key={nivel} className="border-2 border-slate-100 rounded-[2rem] overflow-hidden">
                                {/* Cabecera de nivel de riesgo */}
                                <div className={`flex items-center justify-between px-8 py-4 ${color.light} border-b ${color.border}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${color.bg}`}></div>
                                        <span className={`text-xs font-black uppercase tracking-widest ${color.text}`}>Riesgo {nivel}</span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-100">{grupo.length} hallazgo{grupo.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    {totalMonto > 0 && (
                                        <span className={`text-[10px] font-black ${color.text}`}>
                                            Monto: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalMonto)}
                                        </span>
                                    )}
                                </div>

                                {/* Sub-grupos por Tipo */}
                                {Object.entries(porTipo).map(([tipo, items]) => (
                                    <div key={tipo}>
                                        <div className="px-8 py-2 bg-slate-50 border-b border-slate-100">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{tipo}</span>
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {items.map(obs => (
                                                <div key={obs.id} className="relative bg-white px-8 py-6 hover:bg-slate-50/50 transition-all group">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-black text-slate-800 mb-1">{obs.titulo}</h4>
                                                            <p className="text-[11px] text-slate-500 italic line-clamp-2">"{obs.descripcion}"</p>
                                                            {obs.monto_observado != null && obs.monto_observado > 0 && (
                                                                <span className={`inline-block mt-2 text-[9px] font-black px-2 py-0.5 rounded-full ${color.light} ${color.text} ${color.border} border`}>
                                                                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(obs.monto_observado)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                                                            <button onClick={() => startEdit(obs)} className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs"><i className="fas fa-edit"></i></button>
                                                            <button onClick={() => setObsToDelete(obs.id!)} className="h-8 w-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center text-xs"><i className="fas fa-trash-alt"></i></button>
                                                        </div>
                                                    </div>
                                                    {Array.isArray(obs.evidencias) && obs.evidencias.length > 0 && (
                                                        <div className="flex gap-2 mt-3 flex-wrap">
                                                            {obs.evidencias.map((ev, idx) => (
                                                                <a key={idx} href={ev.url} target="_blank" rel="noopener noreferrer" className="flex items-center bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 hover:bg-blue-600 hover:text-white transition-all text-[9px] font-bold text-slate-500">
                                                                    <i className={`fas ${getFileIcon(ev.tipo)} mr-1.5`}></i>
                                                                    <span className="truncate max-w-[100px]">{ev.nombre}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="mt-2 text-[9px] text-slate-300 font-bold uppercase">{obs.creado_por} · {obs.fecha_creacion ? new Date(obs.fecha_creacion).toLocaleDateString() : ''}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })
                )}
            </div>

            <Modal
                isOpen={!!obsToDelete}
                onClose={() => setObsToDelete(null)}
                title="Eliminar Hallazgo"
            >
                <div className="p-2 text-center">
                    <div className="flex items-center justify-center w-20 h-20 bg-rose-100 rounded-full mx-auto mb-6">
                        <i className="fas fa-microscope text-3xl text-rose-600"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-4">¿Eliminar Hallazgo?</h3>
                    <p className="text-sm text-slate-500 leading-relaxed mb-8">
                        Se eliminará el papel de trabajo y todas las evidencias adjuntas. Esta acción es definitiva para el expediente actual.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setObsToDelete(null)} className="py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
                        <button onClick={handleDelete} className="py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest hover:bg-rose-700 transition-all transform hover:-translate-y-1">
                            <i className="fas fa-trash-alt mr-2"></i> Eliminar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ObservationsManager;
