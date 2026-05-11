import React, { useState, useEffect } from 'react';
import { AppState, SamplingMethod, Step, AuditObservation } from '../../types';
import AttributeSampling from '../samplingMethods/AttributeSampling';
import MonetaryUnitSampling from '../samplingMethods/MonetaryUnitSampling';
import ClassicalVariablesSampling from '../samplingMethods/ClassicalVariablesSampling';
import NonStatisticalSampling from '../samplingMethods/NonStatisticalSampling';
import StratifiedSampling from '../samplingMethods/StratifiedSampling';
import ObservationsManager from '../sampling/ObservationsManager';
import { calculateSampleSize } from '../../services/statisticalService';
import { supabase } from '../../services/supabaseClient';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    setCurrentStep: (step: Step) => void;
}

const Step3SamplingMethod: React.FC<Props> = ({ appState, setAppState, setCurrentStep }) => {
    const [loading, setLoading] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'config' | 'observations'>('config');
    const [dataStatus, setDataStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error' | 'empty', count: number }>({ status: 'idle', count: 0 });

    useEffect(() => {
        const checkDataAvailability = async () => {
            if (!appState.selectedPopulation) return;

            setDataStatus(prev => ({ ...prev, status: 'loading' }));
            try {
                const { count, error } = await supabase
                    .from('audit_data_rows')
                    .select('*', { count: 'exact', head: true })
                    .eq('population_id', appState.selectedPopulation.id);

                if (error) {
                    setDataStatus({ status: 'error', count: 0 });
                } else {
                    const finalCount = count || 0;
                    setDataStatus({ status: finalCount > 0 ? 'success' : 'empty', count: finalCount });
                }
            } catch (e) {
                setDataStatus({ status: 'error', count: 0 });
            }
        };

        checkDataAvailability();
    }, [appState.selectedPopulation]);

    const handleMethodChange = (method: SamplingMethod) => {
        setAppState(prev => ({ ...prev, samplingMethod: method }));
    };

    const handleRunSampling = async () => {
        // console.log("Starting Sampling..."); // Removed alert
        setLoading(true);
        try {
            let realRows: any[] = [];
            const populationId = appState.selectedPopulation?.id;

            if (populationId) {
                // ---------------------------------------------------------
                // UNIVERSAL SERVER-SIDE SAMPLING SWITCH
                // ---------------------------------------------------------
                // Explicitly check for Server Side Methods
                const useServerSide = appState.samplingMethod === SamplingMethod.NonStatistical ||
                    appState.samplingMethod === SamplingMethod.Attribute;

                let serverRows: any[] | null = null;


                console.log("🔍 DEBUG: samplingMethod =", appState.samplingMethod);
                console.log("🔍 DEBUG: SamplingMethod.NonStatistical =", SamplingMethod.NonStatistical);
                console.log("🔍 DEBUG: useServerSide =", useServerSide);

                if (appState.samplingMethod === SamplingMethod.NonStatistical) {
                    // ------------------------------------
                    // 1. NON-STATISTICAL (Server-Side GET)
                    // ------------------------------------
                    const type = appState.samplingParams.nonStatistical.selectedInsight || 'RiskScoring';
                    const size = appState.samplingParams.nonStatistical.sampleSize || 30;
                    const threshold = appState.selectedPopulation?.advanced_analysis?.outliersThreshold || 0;

                    console.log(`🚀 Step 3 (NonStat): GET /api/sampling_proxy?action=get_non_statistical_sample&type=${type}`);

                    const res = await fetch(`/api/sampling_proxy?action=get_non_statistical_sample&population_id=${populationId}&type=${type}&size=${size}&threshold=${threshold}`);

                    if (!res.ok) throw new Error("Error en muestreo No Estadístico (Server-Side)");
                    const { rows } = await res.json();
                    serverRows = rows;

                } else if (appState.samplingMethod === SamplingMethod.Attribute) {
                    // ------------------------------------
                    // 2. ATTRIBUTE (Server-Side POST)
                    // ------------------------------------
                    const attrParams = {
                        sampleSize: appState.samplingParams.attribute.sampleSize || 30
                    };

                    console.log(`🚀 Step 3 (Attribute): POST /api/sampling_proxy?action=calculate_sample`);

                    const res = await fetch('/api/sampling_proxy?action=calculate_sample', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            population_id: populationId,
                            method: appState.samplingMethod,
                            params: attrParams
                        })
                    });

                    if (!res.ok) throw new Error("Error en muestreo Atributos (Server-Side)");
                    const { rows } = await res.json();
                    serverRows = rows;
                }

                if (serverRows) {
                    if (!serverRows || serverRows.length === 0) {
                        alert("No se encontraron registros para la muestra.");
                        setLoading(false);
                        return;
                    }

                    // Map Response (Shared Mapping for Server Results)
                    const serverSample = serverRows.map((r: any) => ({
                        id: String(r.unique_id_col),
                        value: r.monetary_value_col || 0,
                        risk_score: r.risk_score,
                        risk_factors: r.risk_factors || [],
                        risk_flag: r.risk_score > 0 ? 'RIESGO DETECTADO' : 'Muestreo Aleatorio',
                        risk_justification: `Selección Servidor: ${appState.samplingMethod}`,
                        is_manual_selection: true,
                        raw_row: r.raw_json
                    }));

                    const results = {
                        sampleSize: serverSample.length,
                        sample: serverSample,
                        totalErrorProjection: 0,
                        upperErrorLimit: 0,
                        findings: [],
                        methodologyNotes: ["Ejecución Server-Side para optimización de recursos."],
                        observations: appState.observations
                    };

                    setAppState(prev => ({ ...prev, results }));
                    setCurrentStep(Step.Results);
                    setLoading(false);
                    return; // EXIT EARLY
                }

                // ---------------------------------------------------------
                // STRATEGY B: CLIENT-SIDE SAMPLING (MUS, Stratified, CAV)
                // ---------------------------------------------------------


                // ---------------------------------------------------------
                // STRATEGY B: CLIENT-SIDE SAMPLING (Standard)
                // ---------------------------------------------------------
                // 1. FETCH LIGHTWEIGHT UNIVERSE (NO RAW JSON) - Prevent Freeze
                console.log("🚀 Step 3: Fetching Light Universe via Proxy...");

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s Timeout

                try {
                    // Stratified MultiVariable needs raw_json to classiy
                    const isStratifiedMulti = appState.samplingMethod === SamplingMethod.Stratified && appState.samplingParams.stratified.basis === 'MultiVariable';
                    const detailedParam = isStratifiedMulti ? 'true' : 'false';

                    const res = await fetch(`/api/sampling_proxy?action=get_universe&population_id=${populationId}&detailed=${detailedParam}`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (!res.ok) throw new Error(`Proxy Fetch Failed: ${res.status}`);
                    const { rows } = await res.json();

                    if (!rows || rows.length === 0) {
                        alert("ERROR CRÍTICO: No se encontraron registros.");
                        setLoading(false);
                        return;
                    }
                    realRows = rows;

                } catch (proxyErr: any) {
                    if (proxyErr.name === 'AbortError') throw new Error("Tiempo de espera agotado cargando universo. (Timeout 30s)");
                    throw proxyErr;
                }
            }

            // 2. CALCULATE SAMPLE (Using Light Data)
            // calculateSampleSize logic works with subsets of data for MUS/Attribute
            const results = calculateSampleSize(appState, realRows);

            // 3. HYDRATE SAMPLE WITH FULL DETAILS (Fetch only selected IDs)
            const isStratifiedMulti = appState.samplingMethod === SamplingMethod.Stratified && appState.samplingParams.stratified.basis === 'MultiVariable';

            if (populationId && results.sample.length > 0 && !isStratifiedMulti) {
                const selectedIds = results.sample.map(s => s.id);
                console.log(`🚀 Hydrating ${selectedIds.length} items...`);

                // CHUNK STRATEGY to avoid Vercel 4.5MB Limit
                const CHUNK_SIZE = 50;
                const hydratedMap = new Map<string, any>();

                for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
                    const chunkIds = selectedIds.slice(i, i + CHUNK_SIZE);
                    // Optional: Update loading state with % here if we had a detailed state
                    // setLoadingText(`Descargando detalles (${i + chunkIds.length}/${selectedIds.length})...`); 

                    try {
                        const chunkRes = await fetch('/api/sampling_proxy?action=get_rows_batch', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ population_id: populationId, ids: chunkIds })
                        });

                        if (chunkRes.ok) {
                            const { rows: chunks } = await chunkRes.json();
                            chunks.forEach((d: any) => {
                                hydratedMap.set(String(d.unique_id_col), {
                                    raw: d.raw_json,
                                    factors: d.risk_factors // Now available from batch
                                });
                            });
                        } else {
                            console.warn(`Failed to hydrate chunk ${i / CHUNK_SIZE}`);
                        }
                    } catch (chunkErr) {
                        console.error(`Error hydrating chunk ${i}:`, chunkErr);
                    }
                }

                // Apply hydrated data (raw_row AND risk_factors)
                results.sample = results.sample.map(item => {
                    const hydrated = hydratedMap.get(String(item.id));
                    return {
                        ...item,
                        raw_row: hydrated?.raw || item.raw_row,
                        // If risk_factors were missing in universe, restore them now
                        risk_factors: hydrated?.factors || item.risk_factors
                    };
                });
            }

            results.observations = appState.observations;
            setAppState(prev => ({ ...prev, results }));
            setCurrentStep(Step.Results);

        } catch (error: any) {
            console.error("Sampling Error:", error);
            alert(`Error: ${error.message || "Ocurrió un error inesperado."}`);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: SamplingMethod.Attribute, label: 'Atributos', icon: 'fa-check-circle' },
        { id: SamplingMethod.MUS, label: 'MUS', icon: 'fa-dollar-sign' },
        { id: SamplingMethod.Stratified, label: 'Estratificado', icon: 'fa-layer-group' },
        { id: SamplingMethod.CAV, label: 'Variables (CAV)', icon: 'fa-calculator' },
        { id: SamplingMethod.NonStatistical, label: 'No Estadístico', icon: 'fa-user-check' },
    ];

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-black text-slate-800">
                        Definición del Método de Muestreo <span className="text-emerald-500 text-sm">[v2.5 SERVER]</span>
                    </h3>
                    <p className="text-slate-500 text-sm">Configure los parámetros técnicos o registre observaciones cualitativas de la población.</p>
                </div>
                <div className="mt-1">
                    {dataStatus.status === 'success' && (
                        <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 uppercase tracking-widest flex items-center shadow-sm">
                            <i className="fas fa-database mr-2"></i> {dataStatus.count.toLocaleString()} Registros Reales
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                {/* Tabs de Métodos */}
                <div className="border-b border-slate-100 bg-slate-50/50">
                    <nav className="flex overflow-x-auto" aria-label="Tabs">
                        {tabs.map(tab => {
                            const isActive = appState.samplingMethod === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleMethodChange(tab.id)}
                                    className={`${isActive
                                        ? 'border-blue-600 text-blue-700 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.03)]'
                                        : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                        } whitespace-nowrap py-5 px-6 border-b-2 font-black text-[10px] uppercase tracking-[0.15em] flex items-center transition-all flex-1 justify-center`}
                                >
                                    <i className={`fas ${tab.icon} mr-3 ${isActive ? 'text-blue-600' : 'text-slate-300'}`}></i>
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Sub-Tabs: Configuración vs Observaciones */}
                <div className="flex bg-slate-100/50 p-2 border-b border-slate-100">
                    <button
                        onClick={() => setActiveSubTab('config')}
                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSubTab === 'config' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <i className="fas fa-cog mr-2"></i> Configuración Técnica
                    </button>
                    <button
                        onClick={() => setActiveSubTab('observations')}
                        className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${activeSubTab === 'observations' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <i className="fas fa-clipboard-list mr-2"></i> Observaciones ({(appState.observations || []).length})
                    </button>
                </div>

                <div className="p-8">
                    {activeSubTab === 'config' ? (
                        <>
                            {appState.samplingMethod === SamplingMethod.Attribute && <AttributeSampling appState={appState} setAppState={setAppState} />}
                            {appState.samplingMethod === SamplingMethod.MUS && <MonetaryUnitSampling appState={appState} setAppState={setAppState} />}
                            {appState.samplingMethod === SamplingMethod.Stratified && <StratifiedSampling appState={appState} setAppState={setAppState} />}
                            {appState.samplingMethod === SamplingMethod.CAV && <ClassicalVariablesSampling appState={appState} setAppState={setAppState} />}
                            {appState.samplingMethod === SamplingMethod.NonStatistical && <NonStatisticalSampling appState={appState} setAppState={setAppState} />}
                        </>
                    ) : (
                        <ObservationsManager
                            populationId={appState.selectedPopulation!.id}
                            method={appState.samplingMethod}
                            onObservationsUpdate={(obs) => setAppState(prev => ({ ...prev, observations: obs }))}
                        />
                    )}
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <button
                        onClick={() => setCurrentStep(Step.GeneralParams)}
                        className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-all shadow-sm"
                    >
                        <i className="fas fa-chevron-left mr-3"></i> Atrás
                    </button>
                    <button
                        onClick={handleRunSampling}
                        disabled={loading || dataStatus.status !== 'success'}
                        className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50"
                    >
                        {loading ? <i className="fas fa-circle-notch fa-spin mr-3"></i> : <i className="fas fa-calculator mr-3 text-cyan-400"></i>}
                        Calcular Muestra Definitiva
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Step3SamplingMethod;
