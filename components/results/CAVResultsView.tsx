
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, AuditResults, AuditSampleItem, UserRole } from '../../types';
import { calculateInference, calculateVariableExpansion, formatMoney } from '../../services/statisticalService';
import { supabase } from '../../services/supabaseClient';
import SharedResultsLayout from './SharedResultsLayout';
import { RichInfoCard } from '../ui/RichInfoCard';
import RiskChart from '../reporting/RiskChart';
import { ASSISTANT_CONTENT } from '../../constants';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    role: UserRole;
    onBack: () => void;
}

const CAVResultsView: React.FC<Props> = ({ appState, setAppState, role, onBack }) => {
    if (!appState.results) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <i className="fas fa-spinner fa-spin text-4xl text-orange-500 mb-4"></i>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Cargando resultados de CAV...</p>
                </div>
            </div>
        );
    }

    const [currentResults, setCurrentResults] = useState<AuditResults>(appState.results);
    const [isSaving, setIsSaving] = useState(false);
    const [isExpanding, setIsExpanding] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ show: boolean, title: string, message: string, type: 'success' | 'error' }>({
        show: false,
        title: '',
        message: '',
        type: 'success'
    });
    const [helpKey, setHelpKey] = useState<string | null>(null);
    const [showInferenceModal, setShowInferenceModal] = useState(false);

    const totalValue = appState.selectedPopulation?.total_monetary_value || 0;
    const populationCount = appState.selectedPopulation?.total_rows || 0;
    const inference = useMemo(() => calculateInference(currentResults, appState.samplingMethod, totalValue, populationCount), [currentResults]);
    const isPilot = currentResults.pilotMetrics?.type === 'CAV_PILOT';
    const sigmaToUse = isPilot ? currentResults.pilotMetrics?.calibratedSigma : appState.samplingParams.cav.sigma;
    const tolerableError = appState.samplingParams.cav?.TE || 50000;
    const isAcceptable = (inference.projectedError || 0) <= tolerableError;

    const errorsFound = currentResults.sample.filter(i => i.compliance_status === 'EXCEPCION').length;
    const expansionMetrics = useMemo(() => calculateVariableExpansion(
        appState,
        currentResults,
        errorsFound,
        0,
        populationCount
    ), [appState, currentResults, errorsFound, populationCount]);

    useEffect(() => {
        if (saveFeedback.show) {
            const timer = setTimeout(() => {
                setSaveFeedback(prev => ({ ...prev, show: false }));
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [saveFeedback.show]);

    const saveToDb = async (updatedResults: AuditResults, silent = true) => {
        if (!appState.selectedPopulation?.id) return;
        setIsSaving(true);
        try {
            // OPTIMIZE: Remove raw_row from sample to reduce payload size
            const optimizedSample = (updatedResults.sample || []).map(item => {
                const { raw_row, ...rest } = item;
                return rest;
            });

            const currentMethodResults = {
                ...updatedResults,
                sample: optimizedSample,
                method: appState.samplingMethod,
                sampling_params: appState.samplingParams
            };

            const updatedStorage = {
                ...(appState.full_results_storage || {}),
                [appState.samplingMethod]: currentMethodResults,
                last_method: appState.samplingMethod
            };

            // Use Proxy to save work in progress (Bypass Firewall)
            const saveRes = await fetch('/api/sampling_proxy?action=save_work_in_progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    population_id: appState.selectedPopulation.id,
                    results_json: updatedStorage,
                    sample_size: updatedResults.sampleSize
                })
            });

            if (!saveRes.ok) {
                const errText = await saveRes.text();
                throw new Error(`Proxy Save Failed (${saveRes.status}): ${errText}`);
            }

            // 🔄 DUAL SAVE: Also update the current historical sample if it exists
            try {
                const historicalResponse = await fetch('/api/sampling_proxy?action=update_current_sample', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        population_id: appState.selectedPopulation.id,
                        method: appState.samplingMethod,
                        results_json: updatedStorage,
                    }),
                });
                if (!historicalResponse.ok) {
                    console.warn('⚠️ Failed to sync to historical sample (non-critical)');
                }
            } catch (historicalError) {
                console.warn('⚠️ Historical sync error (non-critical):', historicalError);
            }

            setAppState(prev => ({ ...prev, full_results_storage: updatedStorage }));

            if (!silent) {
                setSaveFeedback({ show: true, title: "Sincronizado", message: "Resultados CAV guardados.", type: 'success' });
            }
        } catch (err: any) {
            console.error("Error saving CAV via Proxy:", err);
            setSaveFeedback({ show: true, title: "Error de Sincronización", message: err.message, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateFindings = (updatedSample: AuditSampleItem[]) => {
        const newResults = { ...currentResults, sample: updatedSample };
        setCurrentResults(newResults);
        setAppState(prev => ({ ...prev, results: newResults }));
        saveToDb(newResults);
    };

    const handleExpandSample = async () => {
        if (!appState.selectedPopulation?.id || expansionMetrics.recommendedExpansion <= 0) return;
        setIsExpanding(true);
        try {
            const amountToFetch = expansionMetrics.recommendedExpansion;
            const existingIds = new Set(currentResults.sample.map(i => i.id));

            // Strategy: Re-fetch universe (lightweight) -> Filter -> Hydrate (Bypass Firewall)
            const uniRes = await fetch(`/api/sampling_proxy?action=get_universe&population_id=${appState.selectedPopulation.id}&detailed=false`);
            if (!uniRes.ok) throw new Error('Proxy Universe Fetch Failed');

            const { data: allUniverse } = await uniRes.json();

            // Filter candidates not in existing sample
            const candidates = allUniverse.filter((r: any) => !existingIds.has(String(r.unique_id_col)));

            // Select next N candidates (Simple selection, or Random if preferred? Code implies simple Limit)
            const selection = candidates.slice(0, amountToFetch);

            if (selection.length === 0) {
                setSaveFeedback({ show: true, title: "Aviso", message: "No se encontraron más registros disponibles.", type: 'error' });
                return;
            }

            // Hydrate selection
            const ids = selection.map((s: any) => s.unique_id_col);
            const hydRes = await fetch('/api/sampling_proxy?action=get_rows_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ population_id: appState.selectedPopulation.id, ids })
            });

            if (!hydRes.ok) throw new Error('Proxy Hydration Failed');
            const { rows: moreRows } = await hydRes.json();

            if (moreRows && moreRows.length > 0) {
                const mapping = appState.selectedPopulation.column_mapping;
                const newItems: AuditSampleItem[] = moreRows.map((row, i) => {
                    const raw = row.raw_json || {};
                    const val = parseFloat(String(raw[mapping?.monetaryValue || '']).replace(/[^0-9.-]+/g, "")) || 0;
                    return {
                        id: String(row.unique_id_col || raw[mapping?.uniqueId || ''] || `EXT-${Date.now()}-${i}`),
                        value: val,
                        risk_score: 50,
                        risk_factors: ["Fase: Ampliación"],
                        compliance_status: 'OK',
                        error_description: '',
                        raw_row: { ...raw, _isExpanded: true }
                    };
                });

                const updatedResults: AuditResults = {
                    ...currentResults,
                    sampleSize: currentResults.sampleSize + newItems.length,
                    sample: [...currentResults.sample, ...newItems],
                    pilotMetrics: currentResults.pilotMetrics ? { ...currentResults.pilotMetrics, phase: 'EXPANDED' } : undefined,
                    methodologyNotes: [
                        ...currentResults.methodologyNotes,
                        `Ampliación CAV: Se agregaron ${newItems.length} ítems ante recalibración por riesgo/variabilidad.`
                    ]
                };

                setCurrentResults(updatedResults);
                const updatedStorage = {
                    ...(appState.full_results_storage || {}),
                    [appState.samplingMethod]: updatedResults,
                    last_method: appState.samplingMethod
                };
                setAppState(prev => ({
                    ...prev,
                    results: updatedResults,
                    full_results_storage: updatedStorage
                }));

                await saveToDb(updatedResults, true);

                setSaveFeedback({
                    show: true,
                    title: "Muestra Ampliada",
                    message: `Se han incorporado ${newItems.length} nuevos registros para revisión.`,
                    type: 'success'
                });
            }
        } catch (err: any) {
            console.error("Expand Error:", err);
            setSaveFeedback({ show: true, title: "Error al ampliar", message: err.message, type: 'error' });
        } finally {
            setIsExpanding(false);
        }
    };

    return (
        <SharedResultsLayout
            appState={appState}
            role={role}
            title="Resultados: Variables Clásicas (CAV)"
            subtitle="Estimación de valores totales y calibración de variabilidad"
            onBack={onBack}
            onSaveManual={() => saveToDb(currentResults, false)}
            isSaving={isSaving}
            sidebarContent={
                <div className="space-y-6">
                    <div
                        onClick={() => setShowInferenceModal(true)}
                        className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer group hover:border-orange-500 transition-all relative overflow-hidden"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inferencia Técnica</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 rounded-md border border-slate-200">DETERMINISTA</span>
                        </div>
                        <h3 className={`text-4xl font-black mb-2 tracking-tighter ${isAcceptable ? 'text-slate-900' : 'text-rose-600'}`}>
                            ${inference.projectedError.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h3>
                        <p className="text-[9px] font-medium text-slate-400 mb-4 italic leading-tight">
                            Análisis basado en Estimación de Diferencia / MPU calibrada con Sigma (σ).
                        </p>
                        <div className="h-[120px] w-full mt-4">
                            <RiskChart
                                upperErrorLimit={inference.projectedError}
                                tolerableError={tolerableError}
                                method={appState.samplingMethod}
                            />
                        </div>
                    </div>

                    {currentResults.pilotMetrics?.type === 'CAV_PILOT' && (currentResults.pilotMetrics as any).requiresRecalibration && (
                        <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 animate-fade-in-up">
                            <div className="flex items-center gap-3 mb-4 text-rose-600">
                                <i className="fas fa-shield-alt text-xl"></i>
                                <span className="text-[10px] font-black uppercase tracking-widest">Sigma Shield: Bloqueo</span>
                            </div>
                            <p className="text-[11px] font-medium text-rose-500 mb-2 leading-relaxed">
                                Variabilidad excesiva detectada: <strong>{((currentResults.pilotMetrics as any).sigmaDeviation * 100).toFixed(1)}%</strong> de desviación.
                            </p>
                            <p className="text-[9px] text-rose-400 italic leading-tight">
                                La calibración supera el límite del 25%. El sistema ha bloqueado la inferencia final hasta recalibrar Sigma.
                            </p>
                        </div>
                    )}

                    {expansionMetrics.recommendedExpansion > 0 && (
                        <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 animate-pulse">
                            <div className="flex items-center gap-3 mb-4 text-rose-600">
                                <i className="fas fa-exclamation-triangle text-xl"></i>
                                <span className="text-[10px] font-black uppercase tracking-widest">Ampliación Requerida</span>
                            </div>
                            <p className="text-[11px] font-medium text-rose-500 mb-6 leading-relaxed">
                                Debido a la variabilidad o errores detectados, el modelo estadístico requiere
                                <strong> {expansionMetrics.recommendedExpansion} registros adicionales</strong> para mantener el nivel de confianza.
                            </p>
                            <button
                                onClick={handleExpandSample}
                                disabled={isExpanding}
                                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                            >
                                {isExpanding ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                                Ampliar Muestra (+{expansionMetrics.recommendedExpansion})
                            </button>
                        </div>
                    )}

                    <RichInfoCard
                        title="Calibración Sigma (σ)"
                        icon="fas fa-flask"
                        variant="orange"
                    >
                        <div className="space-y-3 mt-2">
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Sigma de Diseño</span>
                                <span className="text-sm font-bold text-slate-600">{formatMoney(appState.samplingParams.cav.sigma)}</span>
                            </div>
                            {isPilot && (
                                <div className="flex justify-between items-center bg-orange-50 p-3 rounded-xl border border-orange-100">
                                    <span className="text-[10px] font-black text-orange-400 uppercase">Sigma Calibrado</span>
                                    <span className="text-sm font-black text-orange-600">{formatMoney(currentResults.pilotMetrics?.calibratedSigma || 0)}</span>
                                </div>
                            )}
                        </div>
                    </RichInfoCard>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Cinta de Parámetros de Configuración */}
                <div className="grid grid-cols-6 gap-3">
                    <div onClick={() => setHelpKey("tecnicaEstimacion")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-orange-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Técnica</div>
                        <div className="text-xl font-black tracking-tighter text-orange-600">
                            {appState.samplingParams?.cav?.estimationTechnique === 'Media' ? 'MPU' :
                                appState.samplingParams?.cav?.estimationTechnique === 'Diferencia' ? 'DIFF' :
                                    appState.samplingParams?.cav?.estimationTechnique === 'Tasa Combinada' ? 'RAZÓN' : 'REGR.'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Estimación Aplicada</div>
                    </div>

                    <div onClick={() => setHelpKey("estratificacion")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-blue-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estratificar</div>
                        <div className={`text-xl font-black tracking-tighter ${appState.samplingParams?.cav?.stratification ? 'text-blue-600' : 'text-slate-400'}`}>
                            {appState.samplingParams?.cav?.stratification ? 'SÍ' : 'NO'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Segmentación N</div>
                    </div>

                    <div onClick={() => setHelpKey("poblacionTotal")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-slate-400"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Universo (N)</div>
                        <div className="text-xl font-black tracking-tighter text-slate-700">
                            {populationCount.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Registros Totales</div>
                    </div>

                    <div onClick={() => setHelpKey("nivelConfianza")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-emerald-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Confianza (NC)</div>
                        <div className="text-xl font-black tracking-tighter text-emerald-600">
                            {appState.samplingParams?.cav?.NC || 95}%
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Seguridad NIA</div>
                    </div>

                    <div onClick={() => setHelpKey("desviacionTolerable")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-amber-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Materia (TE)</div>
                        <div className="text-xl font-black tracking-tighter text-amber-500">
                            {formatMoney(tolerableError)}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Error Tolerable</div>
                    </div>

                    <div onClick={() => setHelpKey("desviacionEstandar")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-rose-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Variabilidad (σ)</div>
                        <div className="text-xl font-black tracking-tighter text-rose-600">
                            {formatMoney(sigmaToUse)}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">{isPilot ? 'Sigma Calibrado' : 'Sigma de Diseño'}</div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">#</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">ID Registro</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Valor Libro</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {currentResults.sample.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-bold text-slate-400">{idx + 1}</td>
                                    <td className="px-6 py-4 font-black text-slate-700">{item.id}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-600">{formatMoney(item.value)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${item.is_pilot_item ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-slate-100 text-slate-500'}`}>
                                            {item.is_pilot_item ? 'PILOTO' : 'MUESTRA'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => {
                                                const newSample = [...currentResults.sample];
                                                newSample[idx] = { ...item, compliance_status: item.compliance_status === 'OK' ? 'EXCEPCION' : 'OK' };
                                                handleUpdateFindings(newSample);
                                            }}
                                            className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${item.compliance_status === 'OK' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {item.compliance_status === 'OK' ? 'CONFORME' : 'EXCEPCIÓN'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <textarea
                                            placeholder="Escriba hallazgos..."
                                            value={item.error_description || ''}
                                            onChange={(e) => {
                                                const newSample = [...currentResults.sample];
                                                newSample[idx] = { ...item, error_description: e.target.value };
                                                setCurrentResults({ ...currentResults, sample: newSample });
                                                // Optional: update appState too to prevent data loss on immediate navigation
                                                setAppState(prev => ({ ...prev, results: { ...currentResults, sample: newSample } }));
                                            }}
                                            onBlur={() => handleUpdateFindings(currentResults.sample)}
                                            className="w-full bg-slate-50 border-none p-4 rounded-xl text-[12px] font-medium min-h-[60px] shadow-inner focus:ring-4 focus:ring-orange-500/10"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Inferencia MPU */}
            {showInferenceModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-scale-in">
                        <div className="px-10 py-8 bg-orange-600 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Análisis de Inferencia MPU</h3>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Estimación por Media de la Unidad</p>
                            </div>
                            <button onClick={() => setShowInferenceModal(false)} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className={`p-8 rounded-[2rem] border-2 flex items-center gap-6 ${isAcceptable ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-lg ${isAcceptable ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                    <i className={`fas ${isAcceptable ? 'fa-check-double' : 'fa-exclamation-triangle'} text-2xl`}></i>
                                </div>
                                <div>
                                    <h4 className={`text-sm font-black uppercase tracking-tight ${isAcceptable ? 'text-emerald-900' : 'text-rose-900'}`}>
                                        {isAcceptable ? 'Proyección de Riesgo Aceptable' : 'Riesgo de Error Material Detectado'}
                                    </h4>
                                    <p className="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">
                                        {isAcceptable
                                            ? "La proyección de errores basada en la muestra actual se encuentra por debajo del umbral de materialidad tolerable."
                                            : "El error proyectado excede el límite tolerable. Se recomienda ampliar la muestra o evaluar procedimientos sustantivos adicionales."
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Error Proyectado</span>
                                    <div className="text-2xl font-black text-orange-600">${inference.projectedError.toLocaleString()}</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Error Tolerable (TE)</span>
                                    <div className="text-2xl font-black text-slate-800">${tolerableError.toLocaleString()}</div>
                                </div>
                            </div>

                            <RichInfoCard type="methodology" title="Lógica de Cálculo">
                                <div className="font-mono text-[11px] text-slate-600 bg-white p-4 rounded-xl border border-slate-100 space-y-1">
                                    <p>1. Error_Promedio = Suma_Errores_Muestra / n</p>
                                    <p>2. Proyección = Error_Promedio * N ({populationCount.toLocaleString()} items)</p>
                                    <p className="text-orange-600 mt-2 font-black">Total: {formatMoney(inference.projectedError)}</p>
                                </div>
                            </RichInfoCard>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Ayuda Dinámico */}
            {helpKey && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-scale-in">
                        <div className="flex justify-between items-start mb-6">
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
                                {ASSISTANT_CONTENT[helpKey as keyof typeof ASSISTANT_CONTENT]?.title || "Detalle Técnico"}
                            </h4>
                            <button onClick={() => setHelpKey(null)} className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all">
                                <i className="fas fa-times text-slate-400"></i>
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {ASSISTANT_CONTENT[helpKey as keyof typeof ASSISTANT_CONTENT]?.content || (
                                <p className="text-sm text-slate-500 font-medium leading-relaxed italic">
                                    Información no disponible para este parámetro.
                                </p>
                            )}
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <button
                                onClick={() => setHelpKey(null)}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SharedResultsLayout>
    );
};

export default CAVResultsView;
