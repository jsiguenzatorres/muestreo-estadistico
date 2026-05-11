import React, { useState, useMemo, useEffect } from 'react';
import { AppState, AuditResults, AuditSampleItem, UserRole } from '../../types';
import { calculateInference } from '../../services/statisticalService';
import { supabase } from '../../services/supabaseClient';
import SharedResultsLayout from './SharedResultsLayout';
import RiskChart from '../reporting/RiskChart';
import Modal from '../ui/Modal';
import { RichInfoCard } from '../ui/RichInfoCard';
import { ASSISTANT_CONTENT } from '../../constants';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    role: UserRole;
    onBack: () => void;
}

const AttributeResultsView: React.FC<Props> = ({ appState, setAppState, role, onBack }) => {
    const [currentResults, setCurrentResults] = useState<AuditResults>(appState.results!);
    const [showUelModal, setShowUelModal] = useState(false);
    const [isExpanding, setIsExpanding] = useState(false);
    const [isApproved, setIsApproved] = useState(false);
    const [showSampleSizeModal, setShowSampleSizeModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' }>({ show: false, title: '', message: '', type: 'success' });
    const [helpKey, setHelpKey] = useState<string | null>(null);

    const params = appState.samplingParams.attribute;
    const inference = useMemo(() => calculateInference(currentResults, appState.samplingMethod, 0), [currentResults]);
    const threshold = params.ET;
    const isAcceptable = inference.upperLimit <= threshold;
    const errorsFound = currentResults.sample.filter(i => i.compliance_status === 'EXCEPCION').length;
    const criticalNumber = inference.criticalNumber ?? 0;
    const isControlEffective = errorsFound <= criticalNumber;

    // Lógica para ampliación secuencial Stop-or-Go
    const canExpand = params.useSequential && errorsFound > 0 && currentResults.sampleSize < 100;

    // Determine R Factor for display
    let rFactorDisplay = 2.3;
    if (params.NC >= 99) rFactorDisplay = 4.6;
    else if (params.NC >= 95) rFactorDisplay = 3.0;




    // Auto-ocultar notificación de guardado
    useEffect(() => {
        if (saveFeedback.show) {
            const timer = setTimeout(() => {
                setSaveFeedback(prev => ({ ...prev, show: false }));
            }, 4000); // Aumentado a 4 segundos para mejor UX
            return () => clearTimeout(timer);
        }
    }, [saveFeedback.show]);

    const saveToDb = async (updatedResults: AuditResults, silent = true) => {
        if (!appState.selectedPopulation?.id) return;
        setIsSaving(true);

        try {
            // Snapshot del método actual
            const currentMethodResults = {
                ...updatedResults,
                method: appState.samplingMethod,
                sampling_params: appState.samplingParams
            };

            // COMBINACIÓN MULTI-MÉTODO: Recuperamos lo que hay en el estado global para NO sobrescribir otros métodos
            const updatedStorage = {
                ...(appState.full_results_storage || {}),
                [appState.samplingMethod]: currentMethodResults,
                last_method: appState.samplingMethod
            };

            // Usar el proxy para guardar con timeout
            await samplingProxyFetch('save_work_in_progress', {
                population_id: appState.selectedPopulation.id,
                results_json: updatedStorage,
                sample_size: updatedResults.sampleSize
            }, { method: 'POST' });

            // 🔄 DUAL SAVE: Also update the current historical sample if it exists
            try {
                await samplingProxyFetch('update_current_sample', {
                    population_id: appState.selectedPopulation.id,
                    method: appState.samplingMethod,
                    results_json: updatedStorage
                }, { method: 'POST' });
            } catch (historicalError) {
                // Non-critical - don't fail if historical sync fails
                console.warn('⚠️ Historical sync error (non-critical):', historicalError);
            }

            // Actualizamos el estado global con el nuevo storage para que App.tsx esté sincronizado
            setAppState(prev => ({ ...prev, full_results_storage: updatedStorage }));

            if (!silent) {
                setSaveFeedback({
                    show: true,
                    title: "Sincronizado",
                    message: "Papel de trabajo actualizado correctamente.",
                    type: 'success'
                });
            }

        } catch (error: any) {
            console.error("Error saving to DB:", error);

            let errorMessage = "Error al guardar";
            if (error instanceof FetchTimeoutError) {
                errorMessage = "Timeout: El guardado tardó demasiado tiempo";
            } else if (error instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + error.message;
            } else {
                errorMessage += ": " + (error.message || "Error desconocido");
            }

            if (!silent) {
                setSaveFeedback({
                    show: true,
                    title: "Error de Guardado",
                    message: errorMessage,
                    type: 'error'
                });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleExpandSample = async () => {
        setIsExpanding(true);
        try {
            // 1. Calcular el Tamaño Teórico Completo (n) usando la fórmula validada
            const n_theoretical = Math.ceil((rFactorDisplay * 100) / (params.ET - params.PE));

            // 2. Determinar cuántos faltan
            const needed = n_theoretical - currentResults.sampleSize;

            if (needed <= 0) {
                setIsExpanding(false);
                return;
            }

            // 3. Obtener los registros faltantes
            const excludedIds = currentResults.sample.map(i => i.id);

            const { data: moreRows, error } = await supabase
                .from('audit_data_rows')
                .select('unique_id_col, monetary_value_col, raw_json')
                .eq('population_id', appState.selectedPopulation!.id)
                .not('unique_id_col', 'in', `(${excludedIds.map(id => `"${id}"`).join(',')})`)
                .limit(needed);

            if (error) throw error;

            if (moreRows && moreRows.length > 0) {
                const newItems: AuditSampleItem[] = moreRows.map((row, i) => ({
                    id: String(row.unique_id_col || `EXTRA-${Date.now()}-${i}`),
                    value: 0,
                    risk_score: 75,
                    risk_factors: ["Fase 2: Ampliación por Riesgo Detectado"],
                    compliance_status: 'OK',
                    error_description: '',
                    raw_row: row.raw_json
                }));

                const updatedResults = {
                    ...currentResults,
                    sampleSize: currentResults.sampleSize + newItems.length,
                    sample: [...currentResults.sample, ...newItems],
                    methodologyNotes: [
                        ...currentResults.methodologyNotes,
                        `Fase 2 (Stop-or-Go): Se detectaron desviaciones. La muestra se amplió en ${newItems.length} registros para alcanzar el tamaño teórico de ${n_theoretical} (NC ${params.NC}%).`
                    ]
                };

                setCurrentResults(updatedResults);
                setAppState(prev => ({ ...prev, results: updatedResults }));
                await saveToDb(updatedResults, false);
            }
        } catch (e) {
            console.error("Error expanding sample:", e);
        } finally {
            setIsExpanding(false);
        }
    };

    const sidebar = (
        <div className="space-y-6">
            {/* ... UEL Card ... */}
            <div
                className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                    <i className="fas fa-microscope text-indigo-500"></i>
                </div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Veredicto Técnico</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 rounded-md border border-slate-200">DETERMINISTA</span>
                </div>

                <div className={`text-2xl font-black mb-2 tracking-tighter ${isControlEffective ? 'text-emerald-500' : 'text-rose-600'}`}>
                    {isControlEffective ? 'CONTROL EFECTIVO' : 'CONTROL NO EFECTIVO'}
                    <i className={`fas ${isControlEffective ? 'fa-check-circle' : 'fa-times-circle'} ml-2 text-lg`}></i>
                </div>

                <p className="text-[9px] font-medium text-slate-400 mb-6 italic">
                    {isControlEffective
                        ? `Basado en NIA 530: Hallazgos (${errorsFound}) ≤ Número Crítico (${criticalNumber}).`
                        : `Basado en NIA 530: Hallazgos (${errorsFound}) > Número Crítico (${criticalNumber}).`}
                </p>

                <div className="flex justify-between items-end mb-6">
                    <div>
                        <span className="text-[8px] font-black text-slate-400 uppercase block">UEL Calculado</span>
                        <h3 className={`text-3xl font-black leading-none ${isAcceptable ? 'text-emerald-500' : 'text-rose-600'}`}>
                            {inference.upperLimit.toFixed(2)}%
                        </h3>
                    </div>
                </div>
                <div className="h-[120px] w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-50">
                    <RiskChart
                        upperErrorLimit={inference.upperLimit}
                        tolerableError={threshold}
                        method={appState.samplingMethod}
                    />
                </div>
            </div>

            {canExpand && (
                <button
                    onClick={handleExpandSample}
                    disabled={isExpanding}
                    className="w-full py-6 bg-rose-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 animate-bounce"
                >
                    {isExpanding ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus-circle"></i>}
                    Ampliar Muestra (Secuencial)
                </button>
            )}

            <div
                onClick={() => setShowSampleSizeModal(true)}
                className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-transform relative group"
            >
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="fas fa-info-circle text-white/50"></i>
                </div>
                <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tamaño Muestra</span>
                    <i className="fas fa-filter text-slate-600"></i>
                </div>
                <div className="text-6xl font-black tracking-tighter mb-2">
                    {currentResults.sampleSize}
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Unidades de Muestreo</p>

                <div className="flex items-center gap-3 pt-6 border-t border-slate-800">
                    <span className="text-[9px] font-mono text-cyan-500">Factor Z:</span>
                    <span className="text-[9px] font-mono text-slate-400">{params.NC >= 99 ? '2.576' : params.NC >= 95 ? '1.96' : '1.645'}</span>
                </div>
            </div>

            <p className="text-[10px] font-black text-slate-300 uppercase text-center tracking-[0.2em] mt-6 italic">Ver Análisis de Inferencia</p>
        </div>
    );



    const main = (
        <div className="space-y-6">
            {/* Cinta de Parámetros de Configuración */}
            <div className="grid grid-cols-5 gap-3">
                <div onClick={() => setHelpKey("Modelo_Atributos")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-indigo-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estrategia</div>
                    <div className={`text-xl font-black tracking-tighter ${params.useSequential ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {params.useSequential ? 'SECUENCIAL' : 'FIJA'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">
                        {params.useSequential ? 'Stop-or-Go' : 'Muestra Única'}
                    </div>
                </div>

                <div onClick={() => setHelpKey("poblacionTotal")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-blue-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Población (N)</div>
                    <div className="text-xl font-black tracking-tighter text-slate-700">
                        {appState.selectedPopulation?.total_rows?.toLocaleString() || "0"}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">Registros</div>
                </div>

                <div onClick={() => setHelpKey("nivelConfianza")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-emerald-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Confianza (NC)</div>
                    <div className="text-xl font-black tracking-tighter text-emerald-600 break-words">
                        {params.NC}%
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">Seguridad Estadística</div>
                </div>

                <div onClick={() => setHelpKey("desviacionTolerable")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-amber-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Error Máx (ET)</div>
                    <div className="text-xl font-black tracking-tighter text-amber-500">
                        {params.ET}%
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">Tolerable</div>
                </div>

                <div onClick={() => setHelpKey("desviacionEsperada")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-rose-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Error Esp (PE)</div>
                    <div className="text-xl font-black tracking-tighter text-slate-700">
                        {params.PE}%
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">Anticipado</div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                    <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Matriz de Evaluación de Atributos</h3>
                    <div className="flex gap-2">
                        <span className="text-[10px] font-bold px-3 py-1 bg-white rounded-full text-slate-400 border border-slate-100 shadow-sm">
                            {currentResults.sampleSize} registros auditados
                        </span>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                            <tr>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Item #</th>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Referencia</th>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Riesgo</th>
                                <th className="px-10 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Evaluación</th>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">Hallazgos / Observaciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {currentResults.sample.map((item, idx) => {
                                const isEx = item.compliance_status === 'EXCEPCION';
                                const riskScore = item.risk_score || 0;
                                const isPilot = item.risk_factors?.includes("Fase 2") ? false : true; // Simple heuristic or rely on is_pilot_item property if consistent
                                // Actually, in handleExpandSample I didn't set is_pilot_item, so undefined/false implies Phase 2 if we assume Phase 1 always has it.
                                // Let's check statisticalService. Yes, selectItems for pilot sets is_pilot_item: true.
                                const phaseLabel = item.is_pilot_item ? "FASE 1: PILOTO" : "FASE 2: AMPLIACIÓN";

                                return (
                                    <tr key={idx} className={`group transition-all ${isEx ? 'bg-rose-50/40' : riskScore > 75 ? 'bg-amber-50/20' : 'hover:bg-slate-50'}`}>
                                        <td className="px-10 py-6 text-[11px] font-black text-slate-300 text-center">
                                            {idx + 1}
                                            <div className={`mt-1 text-[8px] px-2 py-0.5 rounded-full font-bold tracking-wider ${item.is_pilot_item ? 'bg-blue-50 text-blue-400' : 'bg-purple-50 text-purple-400'}`}>
                                                {item.is_pilot_item ? 'PILOTO' : 'EXT'}
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 font-black text-[12px] text-slate-800 tracking-tight">
                                            {item.id}
                                            <span className="block text-[9px] font-medium text-slate-400 mt-0.5">{phaseLabel}</span>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="group relative">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-12 rounded-full overflow-hidden bg-slate-100`}>
                                                        <div className={`h-full ${riskScore > 80 ? 'bg-rose-500' : riskScore > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${riskScore}%` }}></div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400">{riskScore} pts</span>
                                                </div>
                                                {item.risk_factors && item.risk_factors.length > 0 && (
                                                    <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 bg-slate-900 text-white p-3 rounded-xl shadow-2xl min-w-[200px] border border-slate-700">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-2 border-b border-slate-800 pb-1">Evidencia Técnica (Determinista)</p>
                                                        {item.risk_factors.map((f, fi) => (
                                                            <div key={fi} className="text-[9px] mb-1 flex items-start gap-2">
                                                                <i className="fas fa-cog text-cyan-400 mt-1"></i>
                                                                <span>{f}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <button
                                                onClick={() => {
                                                    const ns = [...currentResults.sample];
                                                    ns[idx].compliance_status = ns[idx].compliance_status === 'OK' ? 'EXCEPCION' : 'OK';
                                                    const updated = { ...currentResults, sample: ns };
                                                    setCurrentResults(updated);
                                                    setAppState(prev => ({ ...prev, results: updated }));
                                                }}
                                                disabled={isApproved || isSaving}
                                                className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm disabled:opacity-50 ${isEx ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-emerald-500 text-white shadow-emerald-100'}`}
                                            >
                                                {isSaving ? <i className="fas fa-spinner fa-spin mr-1"></i> : null}
                                                {isEx ? 'Excepción' : 'Conforme'}
                                            </button>
                                        </td>
                                        <td className="px-10 py-6">
                                            <input
                                                type="text"
                                                disabled={isApproved || !isEx}
                                                value={item.error_description || ''}
                                                onChange={e => {
                                                    const ns = [...currentResults.sample];
                                                    ns[idx].error_description = e.target.value;
                                                    const updated = { ...currentResults, sample: ns };
                                                    setCurrentResults(updated);
                                                    setAppState(prev => ({ ...prev, results: updated }));
                                                }}
                                                className={`w-full text-[11px] font-bold rounded-xl px-4 py-2 border-2 transition-all ${isEx ? 'bg-white border-rose-200 text-rose-700' : 'bg-slate-50 border-transparent text-slate-300'}`}
                                                placeholder={isEx ? "Documentar hallazgo..." : "Sin desviación"}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const wasExpanded = params.useSequential && currentResults.sampleSize > 25;
    const pilotSize = 25;
    const expandedSize = currentResults.sampleSize - pilotSize;

    return (
        <>
            <SharedResultsLayout
                appState={appState} role={role} onBack={onBack} title="Resultados: Atributos"
                onSaveManual={() => saveToDb(currentResults, false)}
                isSaving={isSaving}
                sidebarContent={sidebar} mainContent={main} certificationContent={<div className="mt-10 p-10 bg-[#0f172a] rounded-[3rem] text-center text-white text-[10px] font-black uppercase tracking-[0.4em] border border-slate-800">Uso Exclusivo Auditoría / Control de Calidad</div>}
            />

            <Modal isOpen={showUelModal} onClose={() => setShowUelModal(false)} title="Análisis de Inferencia Técnica" variant="indigo">
                <div className="space-y-6">
                    <div className={`p-8 rounded-[2.5rem] border-2 flex items-center justify-between shadow-sm ${isAcceptable ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className="flex items-center gap-5">
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${isAcceptable ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                <i className={`fas ${isAcceptable ? 'fa-check-circle' : 'fa-triangle-exclamation'} text-xl`}></i>
                            </div>
                            <div>
                                <h4 className={`text-[12px] font-black uppercase tracking-tight ${isAcceptable ? 'text-emerald-900' : 'text-rose-900'}`}>
                                    {isAcceptable ? 'Población Certificada' : 'Advertencia de Hallazgos'}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Comparativa frente al Error Tolerable (ET)</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Tasa Estimada (UEL)</span>
                            <span className={`text-3xl font-black ${isAcceptable ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {inference.upperLimit.toFixed(2)}%
                            </span>
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Límite Tolerable (ET)</span>
                            <span className="text-3xl font-black text-slate-800">{params.ET}%</span>
                        </div>
                    </div>

                    <RichInfoCard type="justification" title="Veredicto de Auditoría">
                        {isAcceptable
                            ? "Los resultados de la muestra proporcionan una base razonable para concluir que la tasa de desviación real no excede el error tolerable definido."
                            : "La proyección de errores sugiere que el control podría ser inefectivo. Se recomienda ampliar la muestra o ejecutar procedimientos sustantivos alternos."
                        }
                    </RichInfoCard>
                </div>
            </Modal>

            <Modal isOpen={showSampleSizeModal} onClose={() => setShowSampleSizeModal(false)} title="Detalle de Muestra Estadística" variant="slate">
                <div className="space-y-8">
                    {wasExpanded ? (
                        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 mb-4">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 text-rose-500 bg-white p-2 rounded-lg shadow-sm">
                                    <i className="fas fa-expand-arrows-alt"></i>
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-black text-rose-800 uppercase tracking-widest mb-1">Muestra Ampliada (Fase 2)</h4>
                                    <p className="text-[10px] text-rose-700 leading-relaxed font-medium">
                                        Se detectaron errores durante la fase piloto (n=25). Según el protocolo Stop-or-Go, esto invalida la conclusión temprana y requiere completar la muestra hasta alcanzar la seguridad estadística plena.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <RichInfoCard type="methodology" title="Propósito del Cálculo">
                            Determinar el tamaño de muestra eficiente para validar la efectividad operativa de los controles, asegurando un riesgo de muestreo aceptable.
                        </RichInfoCard>
                    )}

                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
                        <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6">
                            Lógica de Proporciones NIA 530
                        </h4>
                        <div className="flex justify-center mb-8">
                            <div className="bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100 font-mono text-center text-slate-700">
                                <div className="text-xs mb-1 font-bold">n₀ = (Z² × p × q) / E²</div>
                                <div className="text-[9px] opacity-50">Ajuste FPCF: n = (n₀ × N) / (n₀ + N)</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-600">Nivel de Confianza (NC)</span>
                                <div className="text-right">
                                    <span className="block font-black text-slate-800">{params.NC}%</span>
                                    <span className="text-[9px] text-slate-400">Factor R: {rFactorDisplay}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-600">Error Tolerable (ET)</span>
                                <span className="font-black text-slate-800">{params.ET}%</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-600">Error Esperado (PE)</span>
                                <span className="font-black text-slate-800">{params.PE}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">
                            {wasExpanded ? "Desglose de Expansión" : "Verificación Aritmética"}
                        </h4>

                        <div className="font-mono text-sm text-cyan-300 mb-4 pb-4 border-b border-slate-800">
                            n_teórico = ({rFactorDisplay} × 100) / ({params.ET} - {params.PE}) = {Math.ceil((rFactorDisplay * 100) / (params.ET - params.PE))}
                        </div>

                        {wasExpanded ? (
                            <div className="space-y-2">
                                <div className="flex justify-between font-mono text-xs text-slate-400">
                                    <span>Fase 1 (Piloto):</span>
                                    <span>{pilotSize} registros</span>
                                </div>
                                <div className="flex justify-between font-mono text-xs text-emerald-400">
                                    <span>Fase 2 (Ampliación):</span>
                                    <span>+ {expandedSize} registros</span>
                                </div>
                                <div className="flex justify-between font-mono text-sm text-white pt-2 border-t border-slate-800 font-bold">
                                    <span>Total Auditado:</span>
                                    <span>{currentResults.sampleSize} registros</span>
                                </div>
                            </div>
                        ) : (
                            <div className="font-mono text-sm text-cyan-300">
                                n = {currentResults.sampleSize} registros
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!helpKey} onClose={() => setHelpKey(null)} title="Información Técnica de Auditoría" variant="indigo">
                {helpKey && (
                    <div className="space-y-4">
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3 mb-2">
                            <div className="h-10 w-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-sm">
                                <i className="fas fa-book-open"></i>
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-wider">Variable de Control</h4>
                                <div className="text-xs font-bold text-indigo-600">
                                    {helpKey === 'Modelo_Atributos' ? 'Estrategia de Atributos' :
                                        // @ts-ignore
                                        ASSISTANT_CONTENT[helpKey]?.title || helpKey}
                                </div>
                            </div>
                        </div>

                        {helpKey === 'Modelo_Atributos' ? (
                            <div className="space-y-4">
                                <RichInfoCard type="definition" title="Muestreo Secuencial (Stop-or-Go)">
                                    Modelo que permite concluir la prueba de forma anticipada si no se detectan errores en los primeros 25 registros auditados, optimizando el tiempo del auditor.
                                </RichInfoCard>
                                <RichInfoCard type="impact" title="Flexibilidad">
                                    Si se detecta un hallazgo, el sistema obliga a ampliar la muestra al tamaño teórico para mantener el rigor estadístico.
                                </RichInfoCard>
                            </div>
                        ) : (
                            // @ts-ignore
                            ASSISTANT_CONTENT[helpKey]?.content || <p className="text-slate-400 italic">No hay detalles técnicos disponibles para esta variable.</p>
                        )}
                    </div>
                )}
            </Modal>

            {/* Notificación Toast (Flotante y discreta) */}
            {saveFeedback.show && (
                <div className="fixed bottom-10 right-10 z-[100] animate-fade-in-up">
                    <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border ${saveFeedback.type === 'success'
                        ? 'bg-emerald-600 border-emerald-400 text-white'
                        : 'bg-rose-600 border-rose-400 text-white'
                        }`}>
                        <div className="flex-shrink-0">
                            <i className={`fas ${saveFeedback.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`}></i>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">{saveFeedback.title}</p>
                            <p className="text-sm font-medium opacity-90">{saveFeedback.message}</p>
                        </div>
                        <button
                            onClick={() => setSaveFeedback(prev => ({ ...prev, show: false }))}
                            className="ml-4 hover:opacity-100 opacity-60 transition-opacity"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AttributeResultsView;
