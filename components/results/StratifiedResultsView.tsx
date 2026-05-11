
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, AuditResults, AuditSampleItem, UserRole } from '../../types';
import { calculateInference, formatMoney } from '../../services/statisticalService';
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

const StratifiedResultsView: React.FC<Props> = ({ appState, setAppState, role, onBack }) => {
    if (!appState.results) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <i className="fas fa-spinner fa-spin text-4xl text-indigo-500 mb-4"></i>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Cargando resultados estratificados...</p>
                </div>
            </div>
        );
    }
    const [currentResults, setCurrentResults] = useState<AuditResults>(appState.results);
    const [isSaving, setIsSaving] = useState(false);
    const [saveFeedback, setSaveFeedback] = useState<{ show: boolean, title: string, message: string, type: 'success' | 'error' }>({
        show: false,
        title: '',
        message: '',
        type: 'success'
    });
    const [helpKey, setHelpKey] = useState<string | null>(null);
    const [showInferenceModal, setShowInferenceModal] = useState(false);
    const [isExpanding, setIsExpanding] = useState(false);
    const [collapsedStrata, setCollapsedStrata] = useState<Set<string>>(new Set());

    const totalValue = appState.selectedPopulation?.total_monetary_value || 0;
    const populationCount = appState.selectedPopulation?.total_rows || 0;
    const inference = useMemo(() => calculateInference(currentResults, appState.samplingMethod, totalValue, populationCount), [currentResults]);
    const errorsFound = currentResults.sample.filter(i => i.compliance_status === 'EXCEPCION').length;

    const tolerableError = appState.samplingParams.mus?.TE || 50000; // Using global/MUS TE as reference
    const isAcceptable = (inference.projectedError || 0) <= tolerableError;

    // Resumen de Estratos basado en los ítems de la muestra
    const strataSummary = useMemo(() => {
        const groups: Record<string, { count: number, value: number, errors: number }> = {};
        currentResults.sample.forEach(item => {
            const key = item.stratum_label || 'Sin Estrato';
            if (!groups[key]) groups[key] = { count: 0, value: 0, errors: 0 };
            groups[key].count++;
            groups[key].value += item.value;
            if (item.compliance_status === 'EXCEPCION') groups[key].errors++;
        });
        return Object.entries(groups).map(([name, data]) => ({ name, ...data }));
    }, [currentResults]);

    useEffect(() => {
        if (saveFeedback.show) {
            const timer = setTimeout(() => {
                setSaveFeedback(prev => ({ ...prev, show: false }));
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [saveFeedback.show]);

    const groupedSample: Record<string, AuditSampleItem[]> = useMemo(() => {
        const groups: Record<string, AuditSampleItem[]> = {};
        currentResults.sample.forEach(item => {
            const label = item.stratum_label || 'E1';
            if (!groups[label]) groups[label] = [];
            groups[label].push(item);
        });
        return groups;
    }, [currentResults.sample]);

    const toggleStratum = (stratum: string) => {
        setCollapsedStrata(prev => {
            const next = new Set(prev);
            if (next.has(stratum)) next.delete(stratum);
            else next.add(stratum);
            return next;
        });
    };

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
                setSaveFeedback({ show: true, title: "Sincronizado", message: "Papel de trabajo actualizado.", type: 'success' });
            }
        } catch (err: any) {
            console.error("Error saving results via Proxy:", err);
            if (!silent) setSaveFeedback({ show: true, title: "Error de Sincronización", message: err.message, type: 'error' });
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
        if (!appState.selectedPopulation?.id) return;
        setIsExpanding(true);
        try {
            // Formula NIA 530 para ampliación estratificada:
            // Si el error proyectado excede el TE, se recomienda duplicar la muestra aleatoria del estrato afectado
            // o ampliar un factor k proporcional al riesgo.
            const exceptions = currentResults.sample.filter(i => i.compliance_status === 'EXCEPCION');
            if (exceptions.length === 0) return;

            // Identificamos el estrato con más errores
            const errorCounts: Record<string, number> = {};
            exceptions.forEach(e => {
                const s = e.stratum_label || 'E1';
                errorCounts[s] = (errorCounts[s] || 0) + 1;
            });
            const topErrorStratum = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0][0];

            const amountToFetch = 15; // Ampliación estándar por estrato crítico
            const existingIds = new Set(currentResults.sample.map(i => i.id));

            // Strategy: Re-fetch universe (lightweight) -> Filter -> Hydrate (Bypass Firewall)
            const uniRes = await fetch(`/api/sampling_proxy?action=get_universe&population_id=${appState.selectedPopulation.id}&detailed=false`);
            if (!uniRes.ok) throw new Error('Proxy Universe Fetch Failed');

            const { data: allUniverse } = await uniRes.json();

            // Filter candidates not in existing sample
            const candidates = allUniverse.filter((r: any) => !existingIds.has(String(r.unique_id_col)));

            const selection = candidates.slice(0, amountToFetch);

            if (selection.length === 0) {
                setSaveFeedback({ show: true, title: "Aviso", message: "No se encontraron más registros disponibles.", type: 'error' });
                setIsExpanding(false);
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
                        id: String(row.unique_id_col || raw[mapping?.uniqueId || ''] || `EXT-S-${Date.now()}-${i}`),
                        value: val,
                        risk_score: 50,
                        risk_factors: ["Ampliación Estratificada"],
                        compliance_status: 'OK',
                        error_description: '',
                        stratum_label: topErrorStratum,
                        raw_row: { ...raw, _isExpanded: true }
                    };
                });

                const updatedResults: AuditResults = {
                    ...currentResults,
                    sampleSize: currentResults.sampleSize + newItems.length,
                    sample: [...currentResults.sample, ...newItems],
                    methodologyNotes: [
                        ...currentResults.methodologyNotes,
                        `Ampliación Estratificada: +${newItems.length} registros en estrato ${topErrorStratum} por concentración de hallazgos.`
                    ]
                };

                setCurrentResults(updatedResults);
                const updatedStorage = {
                    ...(appState.full_results_storage || {}),
                    [appState.samplingMethod]: updatedResults,
                    last_method: appState.samplingMethod
                };
                setAppState(prev => ({ ...prev, results: updatedResults, full_results_storage: updatedStorage }));
                await saveToDb(updatedResults, true);

                setSaveFeedback({
                    show: true,
                    title: "Muestra Ampliada",
                    message: `Se han añadido ${newItems.length} ítems al estrato ${topErrorStratum}.`,
                    type: 'success'
                });
            }
        } catch (err: any) {
            console.error("Expand Error:", err);
            setSaveFeedback({ show: true, title: "Error", message: err.message, type: 'error' });
        } finally {
            setIsExpanding(false);
        }
    };

    return (
        <SharedResultsLayout
            appState={appState}
            role={role}
            title="Resultados: Muestreo Estratificado"
            subtitle="Análisis de cumplimiento segmentado por estratos"
            onBack={onBack}
            onSaveManual={() => saveToDb(currentResults, false)}
            isSaving={isSaving}
            sidebarContent={
                <div className="space-y-6">
                    <div
                        onClick={() => setShowInferenceModal(true)}
                        className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 cursor-pointer group hover:border-indigo-500 transition-all relative overflow-hidden"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inferencia Técnica</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 rounded-md border border-slate-200">DETERMINISTA</span>
                        </div>
                        <h3 className={`text-4xl font-black mb-2 tracking-tighter ${isAcceptable ? 'text-slate-900' : 'text-rose-600'}`}>
                            ${inference.projectedError.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </h3>
                        <p className="text-[9px] font-medium text-slate-400 mb-4 italic leading-tight">
                            Basado en NIA 530: Proyección Ponderada por Estrato [Sum(Error_h * (N_h/n_h))].
                        </p>
                        <div className="h-[120px] w-full mt-4">
                            <RiskChart
                                upperErrorLimit={inference.projectedError}
                                tolerableError={tolerableError}
                                method={appState.samplingMethod}
                            />
                        </div>
                    </div>

                    {isAcceptable ? null : (
                        <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 animate-pulse">
                            <div className="flex items-center gap-3 mb-4 text-rose-600">
                                <i className="fas fa-exclamation-triangle text-xl"></i>
                                <span className="text-[10px] font-black uppercase tracking-widest">Riesgo Detectado</span>
                            </div>
                            <p className="text-[11px] font-medium text-rose-500 mb-6 leading-relaxed">
                                El error proyectado excede la materialidad. Se recomienda ampliar la muestra en los estratos con hallazgos.
                            </p>
                            <button
                                onClick={handleExpandSample}
                                disabled={isExpanding || errorsFound === 0}
                                className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                            >
                                {isExpanding ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                                Ampliar Estrato Crítico
                            </button>
                        </div>
                    )}

                    <RichInfoCard
                        title="Distribución de la Muestra"
                        icon="fas fa-layer-group"
                        variant="indigo"
                    >
                        <div className="space-y-3 mt-2">
                            {strataSummary.map(stratum => (
                                <div key={stratum.name} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{stratum.name}</span>
                                        <span className="text-sm font-bold text-slate-700">{stratum.count} ítems</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-slate-400">{formatMoney(stratum.value)}</div>
                                        {stratum.errors > 0 && (
                                            <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-black">
                                                {stratum.errors} ERR
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </RichInfoCard>

                    <RichInfoCard
                        title="Resumen General"
                        icon="fas fa-chart-pie"
                        variant="slate"
                    >
                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="bg-white/50 p-3 rounded-xl border border-white">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Eficiencia</p>
                                <p className="text-lg font-black text-slate-700">
                                    {((currentResults.sampleSize / (appState.selectedPopulation?.total_rows || 1)) * 100).toFixed(1)}%
                                </p>
                            </div>
                            <div className="bg-white/50 p-3 rounded-xl border border-white">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Hallazgos</p>
                                <p className={`text-lg font-black ${errorsFound > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    {errorsFound}
                                </p>
                            </div>
                        </div>
                    </RichInfoCard>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Cinta de Parámetros de Configuración */}
                <div className="grid grid-cols-5 gap-3">
                    <div onClick={() => setHelpKey("estratificacion")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-indigo-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Base</div>
                        <div className="text-xl font-black tracking-tighter text-indigo-600">
                            {appState.samplingParams?.stratified?.basis === 'Monetary' ? 'MONET.' : 'CAT.'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Segmentación</div>
                    </div>

                    <div onClick={() => setHelpKey("cantidadEstratos")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-slate-400"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estratos</div>
                        <div className="text-xl font-black tracking-tighter text-slate-700">
                            {appState.samplingParams?.stratified?.strataCount}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Subgrupos N</div>
                    </div>

                    <div onClick={() => setHelpKey("metodoAsignacion")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-blue-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Asignación</div>
                        <div className="text-xl font-black tracking-tighter text-blue-600">
                            {appState.samplingParams?.stratified?.allocationMethod.includes('Neyman') ? 'NEYMAN' : 'PROP.'}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Criterio estadístico</div>
                    </div>

                    <div onClick={() => setHelpKey("umbralCerteza")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-amber-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Umbral Certeza</div>
                        <div className="text-xl font-black tracking-tighter text-amber-600">
                            {formatMoney(appState.samplingParams?.stratified?.certaintyStratumThreshold)}
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Capa 100%</div>
                    </div>

                    <div onClick={() => setHelpKey("nivelConfianza")} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm cursor-help hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 opacity-100"><i className="fas fa-question-circle text-emerald-500"></i></div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Confianza</div>
                        <div className="text-xl font-black tracking-tighter text-emerald-600">
                            95%
                        </div>
                        <div className="text-[9px] text-slate-400 font-medium">Seguridad NIA</div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">#</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">ID Registro</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Valor</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Estrato</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {(Object.entries(groupedSample) as [string, AuditSampleItem[]][]).map(([stratum, items]) => (
                                <React.Fragment key={stratum}>
                                    <tr className="bg-slate-50/50 group cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleStratum(stratum)}>
                                        <td colSpan={6} className="px-6 py-2 border-y border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <i className={`fas ${collapsedStrata.has(stratum) ? 'fa-chevron-right' : 'fa-chevron-down'} text-[10px] text-slate-400 group-hover:text-indigo-500 transition-all`}></i>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter shadow-sm ${stratum === 'Certeza'
                                                        ? 'bg-amber-500 text-white'
                                                        : 'bg-indigo-600 text-white'
                                                        }`}>
                                                        ESTRATO: {stratum}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {items.length} ítems en este segmento
                                                    </span>
                                                </div>
                                                {collapsedStrata.has(stratum) && (
                                                    <div className="flex items-center gap-4 animate-fade-in">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">(Vista resumida)</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-bold text-slate-500">Valor Total:</span>
                                                            <span className="text-[10px] font-black text-indigo-600">{formatMoney(items.reduce((acc, curr) => acc + curr.value, 0))}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {!collapsedStrata.has(stratum) && items.map((item, itemIdx) => {
                                        // Calculate global index
                                        const globalIdx = currentResults.sample.findIndex(i => i.id === item.id) + 1;
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-300">
                                                    {globalIdx}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm font-black text-slate-700">{item.id}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-600">
                                                    {formatMoney(item.value)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${item.stratum_label === 'Certeza'
                                                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                        }`}>
                                                        {item.stratum_label || 'E1'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            const newSample = [...currentResults.sample];
                                                            const idxInFull = currentResults.sample.findIndex(i => i.id === item.id);
                                                            newSample[idxInFull] = {
                                                                ...item,
                                                                compliance_status: item.compliance_status === 'OK' ? 'EXCEPCION' : 'OK'
                                                            };
                                                            handleUpdateFindings(newSample);
                                                        }}
                                                        className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${item.compliance_status === 'OK'
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                                            }`}
                                                    >
                                                        {item.compliance_status === 'OK' ? 'CONFORME' : 'EXCEPCIÓN'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <textarea
                                                        placeholder="Describir hallazgo..."
                                                        value={item.error_description || ''}
                                                        onChange={(e) => {
                                                            const newSample = [...currentResults.sample];
                                                            const idxInFull = currentResults.sample.findIndex(i => i.id === item.id);
                                                            newSample[idxInFull] = { ...item, error_description: e.target.value };
                                                            setCurrentResults({ ...currentResults, sample: newSample });
                                                            setAppState(prev => ({ ...prev, results: { ...currentResults, sample: newSample } }));
                                                        }}
                                                        onBlur={() => handleUpdateFindings(currentResults.sample)}
                                                        className="w-full bg-slate-50 border-none p-4 rounded-xl text-[12px] font-medium min-h-[60px] shadow-inner focus:ring-4 focus:ring-indigo-500/10"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Inferencia MPU */}
            {showInferenceModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-scale-in">
                        <div className="px-10 py-8 bg-indigo-600 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Análisis de Riesgo Estratificado</h3>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Estimación de Error Proyectado</p>
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
                                        {isAcceptable ? 'Alcance Suficiente' : 'Materialidad Excedida'}
                                    </h4>
                                    <p className="text-[11px] font-medium text-slate-500 mt-1 leading-relaxed">
                                        {isAcceptable
                                            ? "La muestra actual proporciona evidencia suficiente de que el error en la población es inferior a la materialidad."
                                            : "Se han detectado errores proyectados que superan el umbral tolerable. Considere ampliar la muestra."
                                        }
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Error Proyectado Total</span>
                                    <div className="text-2xl font-black text-indigo-600">${inference.projectedError.toLocaleString()}</div>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Materialidad (TE)</span>
                                    <div className="text-2xl font-black text-slate-800">${tolerableError.toLocaleString()}</div>
                                </div>
                            </div>

                            <RichInfoCard type="methodology" title="Nota Metodológica">
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    La inferencia se realiza mediante <strong>Proyección Ponderada (SIT)</strong> conforme a la NIA 530. El sistema calcula el error proyectado para cada estrato de forma independiente (proyectando el error del sample al universo del estrato) y consolida la suma total. Esto evita sesgos si un estrato tiene mayor representatividad monetaria que otro.
                                </p>
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

export default StratifiedResultsView;
