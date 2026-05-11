
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, AuditResults, AuditSampleItem, UserRole } from '../../types';
import { calculateInference, calculateVariableExpansion, calculateCustomFormula, formatMoney } from '../../services/statisticalService';
import { supabase } from '../../services/supabaseClient';
import SharedResultsLayout from './SharedResultsLayout';
import RiskChart from '../reporting/RiskChart';
import Modal from '../ui/Modal';
import { RichInfoCard } from '../ui/RichInfoCard';
import { ASSISTANT_CONTENT } from '../../constants';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    role: UserRole;
    onBack: () => void;
}

const MonetaryResultsView: React.FC<Props> = ({ appState, setAppState, role, onBack }) => {
    const [currentResults, setCurrentResults] = useState<AuditResults>(appState.results!);
    const [showInferenceModal, setShowInferenceModal] = useState(false);
    const [showSampleModal, setShowSampleModal] = useState(false);
    const [isExpanding, setIsExpanding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ show: boolean, title: string, message: string, type: 'success' | 'error' }>({
        show: false,
        title: '',
        message: '',
        type: 'success'
    });
    const [helpKey, setHelpKey] = useState<string | null>(null);

    const musParams = appState.samplingParams.mus;
    const totalValue = appState.selectedPopulation?.total_monetary_value || 0;
    const inference = useMemo(() => calculateInference(currentResults, appState.samplingMethod, totalValue), [currentResults]);
    const isApproved = appState.results?.findings?.[0]?.isApproved || false;

    const tolerableError = musParams.TE;
    const isAcceptable = inference.projectedError <= tolerableError;
    const errorsFound = currentResults.sample.filter(i => i.compliance_status === 'EXCEPCION').length;

    const isFullPopulation = currentResults.sampleSize >= (appState.selectedPopulation?.total_rows || Infinity);
    const isPilot = currentResults.pilotMetrics?.phase === 'PILOT_ONLY';
    const totalRows = appState.selectedPopulation?.total_rows || 0;

    const confidenceLevel = musParams.confidenceLevel || (musParams.RIA ? (100 - musParams.RIA) : 95);

    // FIX: Normalize Chart so Tolerable Error is always at 80% mark
    // Max Value of the chart = Tolerable Error / 0.8
    const chartMaxValue = tolerableError / 0.8;
    const projectedPercent = Math.min(100, (inference.projectedError / chartMaxValue) * 100);

    // Actual Error (Sum of adjustments)
    // For now, using book value of exceptions as a proxy for "Actual Error" since we don't have audited value input yet.
    const actualErrorSum = currentResults.sample
        .filter(i => i.compliance_status === 'EXCEPCION')
        .reduce((acc, curr) => acc + (curr.value || 0), 0);

    const actualPercent = Math.min(100, (actualErrorSum / chartMaxValue) * 100);

    const customCalc = useMemo(() => {
        return calculateCustomFormula(confidenceLevel, totalRows, musParams.TE);
    }, [confidenceLevel, totalRows, musParams.TE]);

    const expansionMetrics = useMemo(() => {
        return calculateVariableExpansion(appState, currentResults, errorsFound, totalValue, totalRows);
    }, [appState, currentResults, errorsFound, totalValue, totalRows]);

    const canExpand = (errorsFound > 0 || isPilot) && expansionMetrics.recommendedExpansion > 0 && !isFullPopulation;

    // Auto-hide toast
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

            // Snapshot del método actual
            const currentMethodResults = {
                ...updatedResults,
                sample: optimizedSample,
                method: appState.samplingMethod,
                sampling_params: appState.samplingParams
            };

            // COMBINACIÓN MULTI-MÉTODO: Recuperamos lo que hay en el estado global para NO sobrescribir otros métodos
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

            // Actualizamos el estado global con el nuevo storage para que App.tsx esté sincronizado
            setAppState(prev => ({ ...prev, full_results_storage: updatedStorage }));

            if (!silent) {
                setSaveFeedback({ show: true, title: "Sincronizado", message: "Papel de trabajo actualizado en la nube.", type: 'success' });
            }
        } catch (err: any) {
            console.error("Exception saving to DB:", err);
            const errMsg = err.message || "Falla desconocida";
            if (!silent) setSaveFeedback({ show: true, title: "Error Guardando", message: errMsg, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExpandSample = async () => {
        setIsExpanding(true);
        try {
            const amountToFetch = expansionMetrics.recommendedExpansion || 25;

            const { data: moreRows } = await supabase
                .from('audit_data_rows')
                .select('unique_id_col, monetary_value_col, raw_json')
                .eq('population_id', appState.selectedPopulation!.id)
                .limit(amountToFetch)
                .not('unique_id_col', 'in', `(${currentResults.sample.map(i => `'${i.id}'`).join(',')})`);

            if (moreRows && moreRows.length > 0) {
                const mapping = appState.selectedPopulation?.column_mapping;
                const newItems: AuditSampleItem[] = moreRows.map((row, i) => {
                    const raw = row.raw_json || {};
                    const value = parseFloat(String(raw[mapping?.monetaryValue || '']).replace(/[^0-9.-]+/g, "")) || 0;
                    return {
                        id: row.unique_id_col || String(raw[mapping?.uniqueId || '']) || `EXT-${Date.now()}-${i}`,
                        value: value,
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
                        `Ampliación: Se agregaron ${newItems.length} registros para completar el tamaño de muestra requerido de ${expansionMetrics.newTotal}.`
                    ]
                };

                await saveToDb(updatedResults, true); // Silent save on expand
                setCurrentResults(updatedResults);
                setAppState(prev => ({ ...prev, results: updatedResults }));
                setSaveFeedback({ show: true, title: "Ampliación", message: `Se agregaron ${newItems.length} registros correctamente.`, type: 'success' });
            } else {
                setSaveFeedback({ show: true, title: "Aviso", message: "No se encontraron más registros disponibles.", type: 'error' });
            }
        } catch (e) {
            console.error("Error expandiendo muestra:", e);
        } finally {
            setIsExpanding(false);
        }
    };

    const sidebar = (
        <div className="space-y-6">
            <div
                onClick={() => setShowInferenceModal(true)}
                className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 cursor-pointer group hover:border-indigo-500 transition-all relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-100">
                    <i className="fas fa-chart-line text-indigo-500 text-xs"></i>
                </div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inferencia Técnica</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 rounded-md border border-slate-200">DETERMINISTA</span>
                </div>
                <h3 className={`text-4xl font-black mb-1 tracking-tighter ${isAcceptable ? 'text-slate-900' : 'text-rose-600'}`}>
                    ${inference.projectedError.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </h3>
                <p className="text-[9px] font-medium text-slate-400 mb-4 italic">
                    {isAcceptable
                        ? `Error Proyectado ($${inference.projectedError.toLocaleString()}) ≤ Tolerable ($${tolerableError.toLocaleString()}).`
                        : `Error Proyectado ($${inference.projectedError.toLocaleString()}) > Tolerable ($${tolerableError.toLocaleString()}).`}
                </p>
                <div className="h-[140px] w-full mt-6 bg-slate-50/50 rounded-3xl p-4 border border-slate-50">
                    <RiskChart
                        upperErrorLimit={inference.projectedError}
                        tolerableError={tolerableError}
                        method={appState.samplingMethod}
                    />
                </div>

                <div className="mt-6 px-2">
                    {/* Main Bar Container */}
                    <div className="h-4 w-full bg-slate-100 rounded-full relative overflow-hidden">
                        {/* Threshold Line at 80% (Tolerable Error) */}
                        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-20" style={{ left: '80%' }}></div>

                        {/* Projected Error Bar */}
                        <div
                            className={`h-full absolute top-0 left-0 transition-all duration-1000 ${isAcceptable ? 'bg-rose-400 opacity-80' : 'bg-rose-500'}`}
                            style={{ width: `${projectedPercent}%`, zIndex: 10 }}
                        ></div>

                        {/* Actual Error Bar (Blue) - Overlay or separate? User said "indica con otra barrita... adicional". Let's overlay it to show composition or comparison */}
                        <div
                            className="h-full absolute top-0 left-0 bg-blue-600 z-15 opacity-90"
                            style={{ width: `${actualPercent}%` }}
                        ></div>
                    </div>

                    <div className="flex justify-between mt-1.5">
                        <span className="text-[8px] font-black text-slate-300 uppercase">Seguro</span>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Real ({formatMoney(actualErrorSum)})</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Proyectado</span>
                            </div>
                        </div>
                        <span className="text-[8px] font-black text-slate-300 uppercase">Crítico</span>
                    </div>
                </div>

                <p className="text-[9px] font-black text-slate-300 uppercase text-center tracking-[0.2em] mt-6 italic">Ver Análisis de Inferencia</p>
            </div>

            {canExpand && (
                <div className="animate-fade-in-up">
                    <div className="mb-2 px-4 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Necesario: {expansionMetrics.newTotal}</span>
                        <span>Faltan: {expansionMetrics.recommendedExpansion}</span>
                    </div>
                    <button
                        onClick={handleExpandSample}
                        disabled={isExpanding}
                        className="w-full py-6 bg-rose-600 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-3 animate-pulse"
                    >
                        {isExpanding ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus-circle"></i>}
                        Ampliar Muestra (Hallazgos)
                    </button>
                </div>
            )}

            <div
                onClick={() => setHelpKey("muestraRepresentativa")}
                className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl cursor-pointer hover:bg-slate-800 transition-all group"
            >
                <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">Tamaño Muestra</span>
                    <i className="fas fa-calculator text-cyan-400 text-xs"></i>
                </div>
                <div className="text-4xl font-black text-white">{currentResults.sampleSize}</div>
                <div className="flex justify-between items-center mt-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Items Seleccionados</p>
                    {isPilot && <span className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase">Fase Piloto</span>}
                </div>
                <p className="text-[9px] font-bold text-cyan-400 mt-4 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all">Ver Detalles <i className="fas fa-arrow-right ml-1"></i></p>
            </div>

            <p className="text-[9px] font-black text-slate-300 uppercase text-center tracking-[0.2em] mt-6 italic">Ver Análisis de Inferencia</p>
        </div>
    );

    const main = (
        <div className="space-y-6">
            {/* Cinta de Parámetros de Configuración MUS */}
            <div className="grid grid-cols-5 gap-3">
                <div onClick={() => setHelpKey("Modelo")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-indigo-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Modelo</div>
                    <div className="text-xl font-black tracking-tighter text-indigo-600">
                        {appState.samplingMethod === 'mus' ? 'MUS' : 'CAV'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        {appState.samplingMethod === 'mus' ? 'Unidades Monetarias' : 'Variables Clásicas'}
                    </div>
                </div>

                <div onClick={() => setHelpKey("valorTotalPoblacion")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-amber-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total (V)</div>
                    <div className="text-xl font-black tracking-tighter text-slate-700">
                        ${totalValue > 1000000 ? (totalValue / 1000000).toFixed(1) + 'M' : totalValue.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">Universo Monetario</div>
                </div>

                <div onClick={() => setHelpKey("errorTolerable")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-rose-600 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Materialidad (TE)</div>
                    <div className="text-xl font-black tracking-tighter text-rose-600">
                        ${musParams.TE.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium font-mono text-[8px]">Err. Tolerable</div>
                </div>

                <div onClick={() => setHelpKey("nivelConfianza")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-emerald-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Confianza</div>
                    <div className="text-xl font-black tracking-tighter text-emerald-600">
                        {confidenceLevel}%
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">Seguridad Audit.</div>
                </div>

                <div onClick={() => setHelpKey("mus_intervalo")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-indigo-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Intervalo (IM)</div>
                    <div className="text-xl font-black tracking-tighter text-slate-800">
                        ${(totalValue / currentResults.sampleSize).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">Salto Monetario</div>
                </div>
            </div>

            {/* Segunda Cinta: Parámetros Avanzados */}
            <div className="grid grid-cols-3 gap-3">
                <div onClick={() => setHelpKey("semilla")} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-slate-400 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Semilla Estadística</div>
                    <div className="text-lg font-mono font-black tracking-tighter text-slate-600">
                        {appState.generalParams.seed}
                    </div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Control de Replicabilidad</div>
                </div>

                <div onClick={() => setHelpKey("estratoCerteza")} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-blue-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estrato de Certeza</div>
                    <div className={`text-lg font-black tracking-tighter ${musParams.optimizeTopStratum ? 'text-blue-600' : 'text-slate-400'}`}>
                        {musParams.optimizeTopStratum ? 'ACTIVO' : 'INACTIVO'}
                    </div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Optimización Top-Stratum</div>
                </div>

                <div onClick={() => setHelpKey("tratamientoNegativos")} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-100 transition-transform group-hover:scale-110"><i className="fas fa-question-circle text-indigo-500 shadow-sm rounded-full"></i></div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tratamiento de Negativos</div>
                    <div className="text-lg font-black tracking-tighter text-slate-600">
                        {musParams.handleNegatives === 'Separate' ? 'Segregar' : musParams.handleNegatives === 'Zero' ? 'A Cero' : 'Absoluto'}
                    </div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Gestión de Saldos Acreedores</div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                    <div>
                        <h4 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Verificación de Saldos: MUS/CAV</h4>
                        <div className="flex gap-2 mt-1">
                            <span className="text-[9px] font-bold px-3 py-1 bg-white rounded-full text-slate-400 border border-slate-100 shadow-sm">
                                {currentResults.sampleSize} partidas seleccionadas
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Control Interno</span>
                        <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-100">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                            <tr>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Item</th>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Referencia</th>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fase</th>
                                <th className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Libro</th>
                                <th className="px-10 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Estatus</th>
                                <th className="px-10 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">Observaciones Técnicas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {currentResults.sample.map((item, idx) => {
                                const isEx = item.compliance_status === 'EXCEPCION';
                                const riskScore = item.risk_score || 0;
                                const isExpansionItem = item.risk_factors?.some(f => f.includes('Ampliación'));
                                const isPilotItem = item.is_pilot_item;

                                return (
                                    <tr key={idx} className={`transition-colors ${isEx ? 'bg-rose-50/30' : riskScore > 70 ? 'bg-amber-50/20' : 'hover:bg-slate-50'}`}>
                                        <td className="px-10 py-6 text-[11px] font-black text-slate-300 text-center">{idx + 1}</td>
                                        <td className="px-10 py-6 font-black text-[12px] text-slate-800 group relative">
                                            {item.id}
                                            {item.risk_factors && item.risk_factors.length > 0 && (
                                                <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 bg-slate-900 text-white p-3 rounded-xl shadow-2xl min-w-[200px] border border-slate-700">
                                                    <p className="text-[8px] font-black text-slate-500 uppercase mb-2 border-b border-slate-800 pb-1">Evidencia Técnica (Determinista)</p>
                                                    {item.risk_factors.map((f, fi) => (
                                                        <div key={fi} className="text-[9px] mb-1 flex items-start gap-2">
                                                            <i className="fas fa-cog text-cyan-400 mt-1"></i>
                                                            <span>{f}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-10 py-6">
                                            {isPilotItem ?
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-wider">Piloto</span>
                                                : isExpansionItem ?
                                                    <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-black uppercase tracking-wider">Ampliación</span>
                                                    : item.risk_flag === 'PARTIDA_CLAVE' ?
                                                        <span className="px-3 py-1 bg-rose-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm ring-2 ring-rose-100">Clave</span>
                                                        : item.risk_flag === 'TOP_STRATUM' ?
                                                            <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black uppercase tracking-wider">Certeza</span>
                                                            : <span className="px-3 py-1 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black uppercase tracking-wider">Muestra</span>
                                            }
                                        </td>
                                        <td className="px-10 py-6 text-[12px] font-bold text-slate-600 text-right font-mono">
                                            ${(item.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                                disabled={isApproved}
                                                className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm ${isEx ? 'bg-rose-600 text-white shadow-rose-200' : 'bg-emerald-500 text-white shadow-emerald-100'}`}
                                            >
                                                {isEx ? 'Hallazgo' : 'Auditado'}
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
                                                placeholder={isEx ? "Naturaleza del error..." : "Sin novedad"}
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

    // Removed redundant projectedPercent calculation since it is done above with chartMaxValue
    // const projectedPercent = Math.min(100, (inference.projectedError / tolerableError) * 100);

    return (
        <>
            <SharedResultsLayout
                appState={appState} role={role} onBack={onBack} title="Resultados: Muestreo Sustantivo (MUS)"
                onSaveManual={() => saveToDb(currentResults, false)}
                isSaving={isSaving}
                sidebarContent={sidebar} mainContent={main} certificationContent={<div className="mt-10 p-10 bg-[#0f172a] rounded-[3rem] text-center text-white text-[10px] font-black uppercase tracking-[0.4em] border border-slate-800">Uso Exclusivo Supervisor / Calidad</div>}
            />

            <Modal isOpen={showInferenceModal} onClose={() => setShowInferenceModal(false)} title="Inferencia Sustantiva NIA 530" variant="amber">
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                            <span>Seguro</span>
                            <span>Umbral Riesgo</span>
                            <span>Crítico</span>
                        </div>
                        <div className="h-6 w-full bg-slate-100 rounded-full relative overflow-hidden">
                            <div className="absolute top-0 bottom-0 w-1 bg-slate-800 z-10" style={{ left: '80%' }}></div>
                            {/* Re-use calculated percentages */}
                            <div className={`h-full absolute top-0 left-0 transition-all duration-1000 ${isAcceptable ? 'bg-emerald-400' : 'bg-rose-500'}`} style={{ width: `${projectedPercent}%` }}></div>
                            <div className="h-full absolute top-0 left-0 bg-blue-600 opacity-50" style={{ width: `${actualPercent}%` }}></div>
                        </div>
                        <div className="flex justify-between mt-2">
                            <div className="text-center">
                                <span className="block text-[9px] font-black text-slate-300 uppercase">Error Real</span>
                                <span className="text-xs font-black text-blue-600">${actualErrorSum.toLocaleString()}</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-[9px] font-black text-slate-300 uppercase">Error Proyectado</span>
                                <span className={`text-xs font-black ${isAcceptable ? 'text-emerald-500' : 'text-rose-500'}`}>${inference.projectedError.toLocaleString()}</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-[9px] font-black text-slate-300 uppercase">Error Tolerable (80%)</span>
                                <span className="text-xs font-black text-slate-800">${tolerableError.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className={`p-8 rounded-[2.5rem] border-2 flex items-center justify-between shadow-sm ${isAcceptable ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <div className="flex items-center gap-5">
                            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${isAcceptable ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                <i className={`fas ${isAcceptable ? 'fa-check-double' : 'fa-triangle-exclamation'} text-xl`}></i>
                            </div>
                            <div>
                                <h4 className={`text-[12px] font-black uppercase tracking-tight ${isAcceptable ? 'text-emerald-900' : 'text-rose-900'}`}>
                                    {isAcceptable ? 'Error Proyectado Aceptable' : 'Error Excede lo Tolerable'}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Comparativa frente al Materialidad (TE)</p>
                            </div>
                        </div>
                    </div>

                    <RichInfoCard type="justification" title="Lógica de Inferencia">
                        Basado en una muestra de {currentResults.sampleSize} ítems, el sistema extrapola la tasa de error al valor total de la población de ${totalValue.toLocaleString()}. Un Error Proyectado menor al TE sugiere que el saldo de cuenta no está materialmente incorrecto.
                    </RichInfoCard>
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
                                    {helpKey === 'Modelo' ? 'Modelo de Auditoría (MUS)' :
                                        helpKey === 'Intervalo' ? 'Salto Monetario (J)' :
                                            helpKey === 'muestraRepresentativa' ? 'Alcance de la Muestra' :
                                                // @ts-ignore
                                                ASSISTANT_CONTENT[helpKey]?.title || helpKey}
                                </div>
                            </div>
                        </div>

                        {helpKey === 'Modelo' ? (
                            <div className="space-y-4">
                                <RichInfoCard type="definition" title="Muestreo de Unidades Monetarias (MUS)">
                                    Modelo estadístico donde la probabilidad de selección es proporcional al tamaño del importe. Se basa en el concepto de que cada peso ($1) es una unidad de muestreo.
                                </RichInfoCard>
                                <RichInfoCard type="impact" title="Ventajas">
                                    Enfoca el esfuerzo en las partidas de mayor valor automáticamente, siendo más eficiente para detectar sobrevaloración de activos o subestimación de pasivos.
                                </RichInfoCard>
                            </div>
                        ) : helpKey === 'Intervalo' ? (
                            <div className="space-y-4">
                                <RichInfoCard type="definition" title="Intervalo de Muestreo (J)">
                                    Valor monetario que define cada cuánto se selecciona un registro. Se calcula dividiendo el Error Tolerable entre el Factor de Confiabilidad (R).
                                </RichInfoCard>
                                <RichInfoCard type="formula" title="Efecto Auditivo">
                                    Un intervalo pequeño selecciona más ítems (más seguridad). Un intervalo grande selecciona menos ítems (más riesgo).
                                </RichInfoCard>
                            </div>
                        ) : (
                            // @ts-ignore
                            ASSISTANT_CONTENT[helpKey]?.content || (
                                <div className="space-y-4">
                                    {/* Fallback Dynamic Content based on helpKey */}
                                    {helpKey === 'muestraRepresentativa' ? (
                                        <>
                                            <RichInfoCard type="definition" title="Tamaño de Muestra Calculado">
                                                Se ha calculado una muestra de <strong>{currentResults.sampleSize} items</strong> para una población de {totalRows} registros con un valor total de {formatMoney(totalValue)}.
                                            </RichInfoCard>
                                            <RichInfoCard type="formula" title="Parámetros Utilizados">
                                                <ul className="list-disc pl-4 text-slate-600">
                                                    <li>Error Tolerable: {formatMoney(tolerableError)}</li>
                                                    <li>Confianza: {confidenceLevel}%</li>
                                                    <li>{musParams.optimizeTopStratum ? 'Con' : 'Sin'} Optimización de Estrato Alto</li>
                                                </ul>
                                            </RichInfoCard>
                                        </>
                                    ) : (
                                        <p className="text-slate-400 italic">No hay detalles técnicos disponibles para esta variable.</p>
                                    )}
                                </div>
                            )
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

export default MonetaryResultsView;
