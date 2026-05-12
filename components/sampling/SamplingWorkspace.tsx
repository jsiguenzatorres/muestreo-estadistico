
import React, { useEffect, useState } from 'react';
import { AppState, SamplingMethod, HistoricalSample } from '../../types';
import Modal from '../ui/Modal';
import AttributeSampling from '../samplingMethods/AttributeSampling';
import MonetaryUnitSampling from '../samplingMethods/MonetaryUnitSampling';
import ClassicalVariablesSampling from '../samplingMethods/ClassicalVariablesSampling';
import NonStatisticalSampling from '../samplingMethods/NonStatisticalSampling';
import StratifiedSampling from '../samplingMethods/StratifiedSampling';
import ObservationsManager from './ObservationsManager';
import { calculateSampleSize } from '../../services/statisticalService';
import { supabase } from '../../services/supabaseClient';
import SampleHistoryManager from './SampleHistoryManager';
import { useToast } from '../ui/ToastContext';
import StratumAllocationPreview from './StratumAllocationPreview';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    currentMethod: SamplingMethod;
    onBack: () => void;
    onComplete: () => void;
}

const methodTitles: { [key in SamplingMethod]: string } = {
    [SamplingMethod.Attribute]: 'Muestreo de Atributos',
    [SamplingMethod.MUS]: 'Muestreo por Unidad Monetaria (MUS)',
    [SamplingMethod.CAV]: 'Muestreo de Variables Clásicas (CAV)',
    [SamplingMethod.Stratified]: 'Muestreo Estratificado',
    [SamplingMethod.NonStatistical]: 'Muestreo No Estadístico / de Juicio',
};

const methodColors: { [key in SamplingMethod]: string } = {
    [SamplingMethod.Attribute]: 'bg-blue-600',
    [SamplingMethod.MUS]: 'bg-amber-500',
    [SamplingMethod.CAV]: 'bg-orange-500',
    [SamplingMethod.Stratified]: 'bg-indigo-600',
    [SamplingMethod.NonStatistical]: 'bg-teal-500',
};

const SamplingWorkspace: React.FC<Props> = ({ appState, setAppState, currentMethod, onBack, onComplete }) => {
    const [loading, setLoading] = useState(false);
    const [viewHistory, setViewHistory] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showReplaceWarning, setShowReplaceWarning] = useState(false);
    const [showAllocationPreview, setShowAllocationPreview] = useState(false);
    const [activeTab, setActiveTab] = useState<'config' | 'findings'>('config');
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
    const [showLargePopulationWarning, setShowLargePopulationWarning] = useState(false);
    const { addToast } = useToast();

    const checkExistingAndLock = async () => {
        console.log("🔐 checkExistingAndLock iniciado", { selectedPopulation: !!appState.selectedPopulation, loading });

        if (!appState.selectedPopulation) {
            console.error("❌ No hay población seleccionada en checkExistingAndLock");
            return;
        }

        console.log("✅ Iniciando verificación y bloqueo...");
        setLoading(true);

        try {
            // Verificar si existe una muestra actual en esta población
            console.log("🔍 Verificando historial de muestras...");

            const { history } = await samplingProxyFetch('get_history', {
                population_id: appState.selectedPopulation.id
            }, {
                timeout: 10000 // 10 segundos de timeout
            });

            console.log(`📊 Historial obtenido: ${history?.length || 0} muestras`);

            // Verificar si hay una muestra marcada como "actual"
            const hasCurrent = history && history.some((h: any) => h.is_current);

            if (hasCurrent) {
                console.log("⚠️ Muestra actual detectada, mostrando advertencia de reemplazo");
                setShowConfirmModal(false);
                setShowReplaceWarning(true);
                setLoading(false);
            } else {
                console.log("✅ No hay muestra actual, procediendo directamente");
                await handleRunSampling(true);
            }
        } catch (err: any) {
            let errorMessage = "Error al verificar historial";

            if (err.name === 'AbortError') {
                errorMessage = "Operación cancelada por timeout";
            } else if (err instanceof FetchTimeoutError) {
                errorMessage = "Timeout: La consulta tardó demasiado. Verifique su conexión.";
            } else if (err instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + err.message;
            } else {
                errorMessage += ": " + (err.message || "Error desconocido");
            }

            console.error("❌ Error en verificación de historial:", errorMessage);
            addToast(errorMessage, 'error');
            setLoading(false);
        }
    };

    const handleRunSampling = async (isFinal: boolean, manualAllocations?: Record<string, number>) => {
        console.log("🚀 handleRunSampling iniciado", { isFinal, loading, selectedPopulation: !!appState.selectedPopulation });

        if (!appState.selectedPopulation) {
            console.error("❌ No hay población seleccionada");
            return;
        }

        // 🔒 PROTECCIÓN CRÍTICA: Evitar múltiples ejecuciones
        if (loading) {
            console.warn("⚠️ Ejecución ya en progreso, ignorando click adicional");
            return;
        }

        console.log("✅ Iniciando proceso de muestreo...");
        setLoading(true);
        setShowConfirmModal(false);
        setShowReplaceWarning(false);
        setShowAllocationPreview(false);

        // Update local state with allocations if provided
        if (manualAllocations) {
            setAppState(prev => ({
                ...prev,
                samplingParams: {
                    ...prev.samplingParams,
                    stratified: { ...prev.samplingParams.stratified, manualAllocations }
                }
            }));
        }

        try {
            console.log("🌐 Iniciando carga de datos (versión anti-bucle)...");
            console.log("⏰ Inicio:", new Date().toLocaleString());
            console.log("🎯 Método:", appState.samplingMethod);

            const expectedRows = appState.selectedPopulation.total_rows || 1500;

            // Advertencia específica para MUS
            if (appState.samplingMethod === "mus" && appState.samplingParams?.mus?.TE < 50000) {
                console.warn("⚠️ MUS: TE muy pequeño puede causar problemas");
                addToast("Advertencia: TE pequeño puede causar muestras excesivas en MUS", "warning");
            }

            // NO mostrar toast aquí, se maneja con modal profesional
            // La advertencia se muestra ANTES de ejecutar, no durante

            console.log(`📊 Población esperada: ${expectedRows} registros`);

            // SOLUCIÓN AL BUCLE INFINITO: Límites estrictos y validación
            const startTime = Date.now();

            const { rows: realRows } = await samplingProxyFetch('get_universe', {
                population_id: appState.selectedPopulation.id
            }, {
                timeout: 10000 // Timeout reducido a 10 segundos
            });

            const loadTime = Date.now() - startTime;
            console.log(`⏱️ Tiempo de carga: ${loadTime}ms`);

            // Verificar que tenemos datos válidos
            if (!realRows || realRows.length === 0) {
                throw new Error('No se encontraron datos en la población seleccionada');
            }

            console.log(`✅ Datos obtenidos: ${realRows.length} registros`);

            // VALIDACIÓN CRÍTICA: Detectar inconsistencias que causan bucles
            const ratio = realRows.length / expectedRows;
            console.log(`📈 Ratio obtenido/esperado: ${ratio.toFixed(2)}`);

            if (ratio > 3) {
                console.error(`🚨 DATOS INCONSISTENTES: ratio ${ratio.toFixed(2)} demasiado alto`);
                throw new Error(`Error de datos: se obtuvieron ${realRows.length} registros pero se esperaban ${expectedRows}. Ratio: ${ratio.toFixed(2)}`);
            }

            // Aplicar límite de seguridad SIEMPRE
            const SAFETY_LIMIT = 15000; // Límite más conservador
            let limitedRows = realRows.slice(0, SAFETY_LIMIT);

            if (realRows.length > SAFETY_LIMIT) {
                addToast(`Población limitada a ${SAFETY_LIMIT} registros para evitar bucles infinitos (original: ${realRows.length}).`, 'warning');
                console.warn(`⚠️ Población limitada: ${realRows.length} → ${limitedRows.length} registros`);
            }

            // Validar que los datos no están corruptos
            const validRows = limitedRows.filter(row =>
                row &&
                typeof row === 'object' &&
                row.unique_id_col !== undefined &&
                typeof row.monetary_value_col === 'number'
            );

            if (validRows.length !== limitedRows.length) {
                console.warn(`⚠️ Datos corruptos detectados: ${limitedRows.length - validRows.length} registros inválidos`);
                limitedRows = validRows;
            }

            console.log(`🔢 Procesando ${limitedRows.length} registros válidos`);

            // Use updated appState with manualAllocations if applicable
            const currentAppState = manualAllocations ? {
                ...appState,
                samplingParams: {
                    ...appState.samplingParams,
                    stratified: { ...appState.samplingParams.stratified, manualAllocations }
                }
            } : appState;

            // PROTECCIÓN ADICIONAL: Timeout para calculateSampleSize
            const calcStartTime = Date.now();
            let results;

            try {
                // yield al event loop para que el spinner sea visible antes del bloqueo síncrono
                await new Promise(resolve => setTimeout(resolve, 50));
                results = calculateSampleSize(currentAppState, limitedRows);
                const calcTime = Date.now() - calcStartTime;
                console.log(`⚡ Cálculo completado en ${calcTime}ms`);

                if (calcTime > 10000) { // Más de 10 segundos es sospechoso
                    console.warn(`⚠️ Cálculo lento detectado: ${calcTime}ms`);
                }
            } catch (calcError) {
                console.error('❌ Error en calculateSampleSize:', calcError);
                throw new Error(`Error en cálculo estadístico: ${calcError.message}`);
            }

            // Adjuntar las observaciones al snapshot de resultados para el reporte
            results.observations = appState.observations;

            // 🎯 SOLUCIÓN DEFINITIVA: Guardado inteligente según entorno (RLS corregido)
            const isDevelopment = window.location.hostname === 'localhost';
            const forceSkipSave = localStorage.getItem('SKIP_SAVE_MODE') === 'true';

            // En producción, SIEMPRE intentar guardar (RLS ya corregido)
            // En desarrollo, usar modo emergencia solo si está activado manualmente
            const shouldSkipSave = isDevelopment && forceSkipSave;

            if (shouldSkipSave || !isFinal) {
                console.log("🚨 MODO SIN GUARDADO: Saltando persistencia en BD");
                if (shouldSkipSave) {
                    addToast("Modo emergencia activado: Sin guardado en BD", "warning");
                } else if (!isFinal) {
                    addToast("Modo simulación: Muestra temporal generada", "info");
                }

                setAppState(prev => {
                    const currentMethodResults = {
                        ...results,
                        method: prev.samplingMethod,
                        sampling_params: prev.samplingParams
                    };
                    return {
                        ...prev,
                        results,
                        isLocked: false,
                        isCurrentVersion: false,
                        full_results_storage: {
                            ...(prev.full_results_storage || {}),
                            [prev.samplingMethod]: currentMethodResults,
                            last_method: prev.samplingMethod
                        }
                    };
                });
            } else {
                // 🎯 GUARDADO CON ESTRATEGIA HÍBRIDA (Opción 1: Directo, Opción 2: Edge Function)
                try {
                    console.log("🔄 Preparando guardado de muestra...");

                    const historicalData = {
                        population_id: appState.selectedPopulation.id,
                        method: appState.samplingMethod,
                        objective: appState.generalParams.objective,
                        seed: appState.generalParams.seed,
                        sample_size: results.sampleSize,
                        params_snapshot: appState.samplingParams,
                        results_snapshot: results,
                        is_final: true,
                        is_current: true
                    };

                    console.log("🔄 Guardando muestra con estrategia híbrida...");

                    // ✅ FIX CRÍTICO: Usar samplingProxyFetch con manejo robusto de errores
                    let savedSample;
                    try {
                        const saveData = {
                            population_id: appState.selectedPopulation.id,
                            method: appState.samplingMethod,
                            sample_data: {
                                objective: appState.generalParams.objective,
                                seed: appState.generalParams.seed,
                                sample_size: results.sampleSize,
                                params_snapshot: appState.samplingParams,
                                results_snapshot: results
                            },
                            is_final: true
                        };

                        console.log("📤 Datos a guardar:", {
                            population_id: saveData.population_id,
                            method: saveData.method,
                            is_final: saveData.is_final,
                            sample_size: saveData.sample_data.sample_size,
                            objective: saveData.sample_data.objective.substring(0, 50) + '...'
                        });

                        savedSample = await samplingProxyFetch('save_sample', saveData);

                        console.log(`✅ Guardado completado exitosamente:`, savedSample);

                        // Verificar que la respuesta sea válida
                        if (!savedSample || !savedSample.id) {
                            throw new Error('Respuesta inválida del servidor: falta ID de muestra');
                        }

                        // 🔍 VERIFICACIÓN ADICIONAL: Confirmar que se guardó en la BD
                        console.log("🔍 Verificando persistencia en BD...");
                        try {
                            // Esperar un momento para que se propague
                            await new Promise(resolve => setTimeout(resolve, 500));

                            const historyCheck = await samplingProxyFetch('get_history', {
                                population_id: appState.selectedPopulation.id
                            });

                            const foundSample = historyCheck.history?.find(h => h.id === savedSample.id);

                            if (foundSample) {
                                console.log("✅ PERSISTENCIA CONFIRMADA: Muestra encontrada en historial");
                                console.log("📄 Detalles:", {
                                    id: foundSample.id,
                                    is_current: foundSample.is_current,
                                    is_final: foundSample.is_final,
                                    created_at: foundSample.created_at
                                });
                            } else {
                                console.warn("⚠️ ADVERTENCIA: Muestra no encontrada en historial inmediatamente");
                                console.warn("💡 Esto puede ser normal debido a propagación de BD");

                                // Marcar como temporal si no se encuentra
                                savedSample.persistence_warning = true;
                            }
                        } catch (verifyError) {
                            console.warn("⚠️ No se pudo verificar persistencia:", verifyError.message);
                            savedSample.persistence_warning = true;
                        }

                        // 🚨 DETECCIÓN AUTOMÁTICA DE PROBLEMA RLS (DESACTIVADA)
                        // ⚠️ NOTA: Esta detección automática era demasiado agresiva y se activaba
                        // incluso cuando el guardado era exitoso, causando que NO se guardaran
                        // muestras subsecuentes. Se desactiva para permitir guardado normal.
                        /*
                        if (savedSample.persistence_warning || !foundSample) {
                            console.log("🚨 DETECTADO: Posible problema RLS en audit_historical_samples");
                            console.log("💡 ACTIVANDO MODO DE EMERGENCIA AUTOMÁTICO...");

                            // Activar modo emergencia automáticamente
                            localStorage.setItem('SKIP_SAVE_MODE', 'true');
                            localStorage.setItem('EMERGENCY_REASON', 'RLS_AUTO_DETECTED');
                            localStorage.setItem('EMERGENCY_TIMESTAMP', Date.now().toString());

                            console.log("✅ Modo emergencia activado - próximas muestras se guardarán solo en memoria");

                            // Mostrar instrucciones al usuario
                            if (window.addToast) {
                                addToast("⚠️ Problema de BD detectado. Contacte al administrador. Modo emergencia activado.", "warning");
                            }
                        }
                        */

                    // ✅ FIX: También guardar en audit_results para que el reload funcione
                    // (el reload lee de audit_results, no de audit_historical_samples)
                    try {
                        const wip_json = {
                            ...(appState.full_results_storage || {}),
                            [appState.samplingMethod]: {
                                ...results,
                                method: appState.samplingMethod,
                                sampling_params: appState.samplingParams
                            },
                            last_method: appState.samplingMethod
                        };
                        await fetch('/api/sampling_proxy?action=save_work_in_progress', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                population_id: appState.selectedPopulation.id,
                                results_json: wip_json,
                                sample_size: results.sampleSize
                            })
                        });
                        console.log("✅ audit_results sincronizado para recarga persistente");
                    } catch (wipError) {
                        console.warn("⚠️ No se pudo sincronizar audit_results (non-critical):", wipError);
                    }

                    } catch (saveError) {
                        console.error("❌ Error detallado en guardado:", saveError);

                        // Análisis específico del error para mejor diagnóstico
                        let errorMessage = "Error al guardar la muestra";
                        let shouldContinue = false;

                        if (saveError.message?.includes('RLS') || saveError.message?.includes('permission')) {
                            errorMessage = "Error de permisos en base de datos. La muestra se guardará solo en memoria.";
                            shouldContinue = true;
                        } else if (saveError.message?.includes('timeout')) {
                            errorMessage = "Timeout al guardar. La muestra se guardará solo en memoria.";
                            shouldContinue = true;
                        } else if (saveError.message?.includes('network') || saveError.message?.includes('fetch')) {
                            errorMessage = "Error de conexión. La muestra se guardará solo en memoria.";
                            shouldContinue = true;
                        } else if (saveError.message?.includes('Missing required fields')) {
                            errorMessage = "Error de datos: campos requeridos faltantes";
                            shouldContinue = false;
                        }

                        if (shouldContinue) {
                            console.log("⚠️ Continuando sin guardado en BD debido a:", saveError.message);
                            addToast(errorMessage, "warning");

                            // Crear un ID temporal para continuar
                            savedSample = {
                                id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                created_at: new Date().toISOString(),
                                method: 'memory_only',
                                persistence_warning: true
                            };
                        } else {
                            // Error crítico, no continuar
                            throw new Error(`Error crítico en guardado: ${saveError.message}`);
                        }
                    }

                    setAppState(prev => {
                        const currentMethodResults = {
                            ...results,
                            method: prev.samplingMethod,
                            sampling_params: prev.samplingParams
                        };

                        // Determinar si está bloqueado basado en si se guardó exitosamente
                        const isLocked = savedSample && savedSample.id && !savedSample.id.startsWith('temp-');
                        const isCurrentVersion = isLocked;

                        return {
                            ...prev,
                            results,
                            isLocked,
                            isCurrentVersion,
                            historyId: savedSample?.id,
                            full_results_storage: {
                                ...(prev.full_results_storage || {}),
                                [prev.samplingMethod]: currentMethodResults,
                                last_method: prev.samplingMethod
                            }
                        };
                    });

                    console.log("✅ Estado actualizado correctamente");

                    // Mensaje de éxito apropiado basado en persistencia real
                    if (savedSample && savedSample.id && !savedSample.id.startsWith('temp-')) {
                        if (savedSample.persistence_warning) {
                            addToast("✅ Muestra bloqueada exitosamente (verificando persistencia en BD...)", "info");
                        } else {
                            addToast("✅ Muestra bloqueada exitosamente como Papel de Trabajo", "success");
                        }
                    } else {
                        addToast("✅ Muestra generada (guardada en memoria temporal)", "info");
                    }
                } catch (saveError) {
                    console.error("❌ Error al guardar:", saveError);

                    // 🔧 FALLBACK: Si falla el guardado, continuar sin guardar
                    addToast("Advertencia: No se pudo guardar en base de datos, pero la muestra se generó correctamente", "warning");

                    setAppState(prev => {
                        const currentMethodResults = {
                            ...results,
                            method: prev.samplingMethod,
                            sampling_params: prev.samplingParams
                        };
                        return {
                            ...prev,
                            results,
                            isLocked: false, // No locked si no se guardó
                            isCurrentVersion: false,
                            full_results_storage: {
                                ...(prev.full_results_storage || {}),
                                [prev.samplingMethod]: currentMethodResults,
                                last_method: prev.samplingMethod
                            }
                        };
                    });

                    console.log("⚠️ Continuando sin guardar en BD");
                }
            }

            const totalTime = Date.now() - startTime;
            console.log(`🎉 Proceso completado en ${totalTime}ms`);

            // 🔧 FIX: setLoading(false) ANTES de onComplete() para evitar botón pegado
            setLoading(false);
            console.log("🎯 Llamando onComplete()...");
            onComplete();
            console.log("✅ onComplete() ejecutado exitosamente");

        } catch (error) {
            console.error("Error en flujo de muestreo:", error);

            let errorMessage = "Error inesperado en el proceso";

            if (error instanceof FetchTimeoutError) {
                errorMessage = "Timeout: La operación tardó más de 30 segundos. Intente con una población más pequeña.";
            } else if (error instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + error.message;
            } else if (error.message?.includes('calculateSampleSize')) {
                errorMessage = "Error en el cálculo estadístico: " + error.message;
            } else if (error.message?.includes('datos inconsistentes') || error.message?.includes('Error de datos')) {
                errorMessage = "Error de datos: " + error.message + ". Contacte al administrador.";
            } else if (error.message?.includes('No se encontraron datos')) {
                errorMessage = "No hay datos disponibles en la población seleccionada";
            } else {
                errorMessage = error?.message || errorMessage;
            }

            addToast(`ERROR: ${errorMessage}`, 'error');
        } finally {
            // 🔧 Solo resetear loading si no se ejecutó onComplete() exitosamente
            setLoading(false);
        }
    };

    const onLoadHistory = async (sample: HistoricalSample) => {
        console.log('📜 Loading historical sample:', sample.id, 'method:', sample.method);

        // 🔄 CRITICAL FIX: Also check for newer work-in-progress
        let latestResults = sample.results_snapshot;

        try {
            console.log('🔍 Checking audit_results for latest changes...');
            const res = await fetch(`/api/get_audit_results?population_id=${appState.selectedPopulation?.id}`);

            if (res.ok) {
                const { data } = await res.json();
                const wipStorage = data?.results_json;

                if (wipStorage && wipStorage[sample.method]) {
                    console.log('✅ Using latest work-in-progress for', sample.method);
                    latestResults = wipStorage[sample.method];
                } else {
                    console.log('ℹ️ No work-in-progress, using historical snapshot');
                }
            }
        } catch (error) {
            console.warn('⚠️ Could not load work-in-progress, using snapshot:', error);
        }
        setAppState(prev => ({
            ...prev,
            samplingMethod: sample.method,
            generalParams: { ...prev.generalParams, objective: sample.objective, seed: sample.seed },
            samplingParams: sample.params_snapshot,
            results: latestResults,
            observations: latestResults.observations || [],
            isLocked: true,
            isCurrentVersion: sample.is_current,
            historyId: sample.id
        }));

        // 🔧 FIX: Asegurar que loading se resetee antes de cambiar vista
        setLoading(false);
        onComplete();
    };

    if (viewHistory && appState.selectedPopulation) {
        return <SampleHistoryManager
            populationId={appState.selectedPopulation.id}
            currentMethod={currentMethod}
            onLoadSample={onLoadHistory}
            onBack={() => setViewHistory(false)}
        />;
    }

    return (
        <div className="animate-fade-in max-w-6xl mx-auto">
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center space-x-3 mb-3">
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black text-white shadow-lg uppercase tracking-widest ${methodColors[currentMethod]}`}>
                            {activeTab === 'config' ? 'Configuración Técnica' : 'Levantamiento de Observaciones'}
                        </span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                        {methodTitles[currentMethod]}
                    </h2>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setViewHistory(true)}
                        className="px-6 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:bg-slate-800 transition-all transform hover:-translate-y-1 flex items-center shadow-lg"
                    >
                        <i className="fas fa-history mr-2 text-cyan-400"></i>
                        Ver Historial
                    </button>
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-700 uppercase tracking-widest hover:text-blue-800 hover:border-blue-500 hover:shadow-xl transition-all transform hover:-translate-y-1 group flex items-center shadow-md"
                    >
                        <div className="bg-slate-100 group-hover:bg-blue-50 p-2 rounded-lg mr-3 transition-colors">
                            <i className="fas fa-chevron-left text-blue-600 transform group-hover:-translate-x-1 transition-transform"></i>
                        </div>
                        Volver
                    </button>
                </div>
            </div>

            {/* CONTROL DE SUB-PESTAÑAS */}
            {/* overflow-hidden removido: clippeaba los dropdowns absolutos de CustomGradientDropdown */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 mb-10">
                <div className="flex bg-slate-100/50 p-2 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center ${activeTab === 'config' ? 'bg-white text-blue-700 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <i className="fas fa-cog mr-3 text-lg"></i> Parámetros Técnicos
                    </button>
                    <button
                        onClick={() => setActiveTab('findings')}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center ${activeTab === 'findings' ? 'bg-white text-blue-700 shadow-md border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <i className="fas fa-clipboard-list mr-3 text-lg"></i> Levantamiento de Observaciones ({(appState.observations || []).length})
                    </button>
                </div>

                <div className="p-8">
                    {activeTab === 'config' ? (
                        <div className="space-y-10 animate-fade-in">
                            {showAllocationPreview ? (
                                <StratumAllocationPreview
                                    appState={appState}
                                    onConfirm={(allocations) => handleRunSampling(true, allocations)}
                                    onCancel={() => setShowAllocationPreview(false)}
                                />
                            ) : (
                                <>
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                        <label className="block text-sm font-black text-slate-600 mb-3 uppercase tracking-widest flex items-center">
                                            <i className="fas fa-bullseye mr-2 text-blue-500"></i> Objetivo Específico del Muestreo
                                        </label>
                                        <textarea
                                            name="objective"
                                            value={appState.generalParams.objective}
                                            onChange={(e) => setAppState(prev => ({ ...prev, generalParams: { ...prev.generalParams, objective: e.target.value } }))}
                                            rows={2}
                                            className="block w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-inner focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all resize-none text-slate-700 font-medium text-sm"
                                            placeholder="Defina el alcance y objetivo de esta selección..."
                                        />
                                    </div>

                                    <div className="pt-4">
                                        {currentMethod === SamplingMethod.Attribute && <AttributeSampling appState={appState} setAppState={setAppState} />}
                                        {currentMethod === SamplingMethod.MUS && <MonetaryUnitSampling appState={appState} setAppState={setAppState} />}
                                        {currentMethod === SamplingMethod.CAV && <ClassicalVariablesSampling appState={appState} setAppState={setAppState} />}
                                        {currentMethod === SamplingMethod.Stratified && <StratifiedSampling appState={appState} setAppState={setAppState} />}
                                        {currentMethod === SamplingMethod.NonStatistical && <NonStatisticalSampling appState={appState} setAppState={setAppState} />}
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <ObservationsManager
                                populationId={appState.selectedPopulation!.id}
                                method={currentMethod}
                                onObservationsUpdate={(obs) => setAppState(prev => ({ ...prev, observations: obs }))}
                            />
                        </div>
                    )}
                </div>

                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end items-center space-x-4">
                    {/* 🚨 BOTÓN DE EMERGENCIA */}
                    {window.location.hostname === 'localhost' && (
                        <button
                            onClick={() => {
                                const isActive = localStorage.getItem('SKIP_SAVE_MODE') === 'true';
                                if (isActive) {
                                    localStorage.removeItem('SKIP_SAVE_MODE');
                                    addToast("Modo emergencia desactivado", "info");
                                } else {
                                    localStorage.setItem('SKIP_SAVE_MODE', 'true');
                                    addToast("Modo emergencia activado - Sin guardado en BD", "warning");
                                }
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${localStorage.getItem('SKIP_SAVE_MODE') === 'true'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-red-100'
                                }`}
                        >
                            🚨 {localStorage.getItem('SKIP_SAVE_MODE') === 'true' ? 'MODO EMERGENCIA ON' : 'Activar Emergencia'}
                        </button>
                    )}

                    {appState.results && (
                        <button
                            onClick={onComplete}
                            className="px-8 py-4 rounded-2xl bg-white border-2 border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest hover:border-blue-500 hover:text-blue-700 transition-all flex items-center shadow-md"
                        >
                            <i className="fas fa-eye mr-3 text-blue-500"></i>
                            Ver Resultados Existentes
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (currentMethod === SamplingMethod.Stratified && (appState.samplingParams.stratified.basis === 'Category' || appState.samplingParams.stratified.basis === 'Subcategory' || appState.samplingParams.stratified.basis === 'MultiVariable')) {
                                setShowAllocationPreview(true);
                                return;
                            }

                            // Verificar si es Estratificado con población grande
                            const expectedRows = appState.selectedPopulation?.total_rows || 0;
                            if (currentMethod === SamplingMethod.Stratified && expectedRows > 1000) {
                                setShowLargePopulationWarning(true);
                                return;
                            }

                            if (appState.results) {
                                setShowOverwriteConfirm(true);
                            } else {
                                setShowConfirmModal(true);
                            }
                        }}
                        disabled={loading || showAllocationPreview}
                        className="px-12 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-[0_10px_25px_rgba(0,0,0,0.2)] hover:bg-slate-800 transition-all transform hover:-translate-y-1 flex items-center"
                    >
                        {loading ? <i className="fas fa-circle-notch fa-spin mr-3"></i> : <i className="fas fa-bolt mr-3 text-cyan-400"></i>}
                        {showAllocationPreview ? 'Configurando Estratos...' : 'Ejecutar Nueva Selección'}
                    </button>
                </div>
            </div>

            {/* Modal de Advertencia de Sobreescritura */}
            <Modal
                isOpen={showOverwriteConfirm}
                onClose={() => setShowOverwriteConfirm(false)}
                title="Resultados Existentes"
            >
                <div className="p-2 text-center">
                    <div className="flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mx-auto mb-6">
                        <i className="fas fa-history text-3xl text-amber-600"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-4">¿Ejecutar Nuevo Muestreo?</h3>
                    <p className="text-sm text-slate-500 leading-relaxed mb-8">
                        Ya existen resultados y hallazgos registrados para esta población. Ejecutar una nueva acción <span className="text-amber-600 font-bold">borrará el historial actual</span> del área de trabajo.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setShowOverwriteConfirm(false)} className="py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest">Conservar Actual</button>
                        <button
                            onClick={() => {
                                setShowOverwriteConfirm(false);
                                setShowConfirmModal(true);
                            }}
                            className="py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest hover:bg-black transition-all transform hover:-translate-y-1"
                        >
                            <i className="fas fa-sync mr-2"></i> Sobreescribir
                        </button>
                    </div>
                </div>
            </Modal>

            {/* MODAL DE ADVERTENCIA: POBLACIÓN GRANDE CON ESTRATIFICADO */}
            <Modal
                isOpen={showLargePopulationWarning}
                onClose={() => setShowLargePopulationWarning(false)}
                title="Recomendación Metodológica"
            >
                <div className="space-y-6 py-2">
                    {/* Banner de Advertencia */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 p-6 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <i className="fas fa-clock text-7xl text-amber-600"></i>
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-12 w-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shadow-sm">
                                    <i className="fas fa-exclamation-triangle text-xl"></i>
                                </div>
                                <div>
                                    <h3 className="text-amber-900 font-black text-lg uppercase tracking-tight">Población de Alto Volumen Detectada</h3>
                                    <p className="text-amber-700 text-xs font-bold">
                                        {appState.selectedPopulation?.total_rows.toLocaleString()} registros | Método: Estratificado
                                    </p>
                                </div>
                            </div>
                            <p className="text-amber-800 leading-relaxed text-sm font-medium">
                                El <span className="font-black">Muestreo Estratificado</span> con poblaciones superiores a 1,000 registros requiere cálculos intensivos de asignación óptima (Algoritmo de Neyman).
                                El tiempo estimado de procesamiento es de <span className="font-black text-amber-900">30 a 60 segundos</span>.
                            </p>
                        </div>
                    </div>

                    {/* Recomendación Profesional */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-6 rounded-3xl">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                <i className="fas fa-lightbulb text-xl"></i>
                            </div>
                            <div>
                                <h4 className="text-blue-900 font-black text-base uppercase tracking-tight mb-2">Alternativa Recomendada: MUS</h4>
                                <p className="text-blue-800 text-sm leading-relaxed font-medium">
                                    Para poblaciones de este tamaño, el <span className="font-black">Muestreo de Unidades Monetarias (MUS)</span> ofrece:
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3 ml-16">
                            <div className="flex items-center gap-3 bg-white/60 p-3 rounded-xl border border-blue-100">
                                <i className="fas fa-bolt text-blue-600"></i>
                                <p className="text-xs text-blue-900 font-bold">Tiempo de procesamiento: <span className="text-emerald-600">5-10 segundos</span></p>
                            </div>
                            <div className="flex items-center gap-3 bg-white/60 p-3 rounded-xl border border-blue-100">
                                <i className="fas fa-crosshairs text-blue-600"></i>
                                <p className="text-xs text-blue-900 font-bold">Enfoque automático en valores de alto riesgo monetario</p>
                            </div>
                            <div className="flex items-center gap-3 bg-white/60 p-3 rounded-xl border border-blue-100">
                                <i className="fas fa-chart-line text-blue-600"></i>
                                <p className="text-xs text-blue-900 font-bold">Precisión estadística equivalente según NIA 530</p>
                            </div>
                        </div>
                    </div>

                    {/* Nota Técnica */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="flex items-start gap-3">
                            <i className="fas fa-info-circle text-slate-400 mt-1"></i>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                <span className="font-black text-slate-800">Nota Técnica:</span> Si decide continuar con Estratificado,
                                el sistema ejecutará el cálculo completo. No cierre el navegador durante el proceso.
                                Recibirá una notificación al completarse.
                            </p>
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <button
                            onClick={() => {
                                setShowLargePopulationWarning(false);
                                // Cambiar a MUS
                                setAppState(prev => ({
                                    ...prev,
                                    samplingMethod: SamplingMethod.MUS
                                }));
                                addToast("Método cambiado a MUS (recomendado para esta población)", "success");
                            }}
                            className="py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-check-circle"></i>
                            Cambiar a MUS (Recomendado)
                        </button>
                        <button
                            onClick={() => {
                                setShowLargePopulationWarning(false);
                                // Continuar con Estratificado
                                if (appState.results) {
                                    setShowOverwriteConfirm(true);
                                } else {
                                    setShowConfirmModal(true);
                                }
                            }}
                            className="py-4 bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:bg-slate-50 flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-forward"></i>
                            Continuar con Estratificado
                        </button>
                    </div>
                </div>
            </Modal>

            {/* MODAL DE OPCIONES DE MUESTREO */}
            <Modal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                title="Protocolo de Selección de Muestra"
            >
                <div className="space-y-8">
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-2xl">
                        <div className="flex items-start gap-4">
                            <i className="fas fa-shield-halved text-amber-500 text-xl mt-1"></i>
                            <div>
                                <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest mb-1">Guía Metodológica</h4>
                                <p className="text-sm text-amber-800 leading-relaxed">
                                    Ha configurado los parámetros técnicos. Seleccione el destino de esta ejecución para su Papel de Trabajo:
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                        <button
                            onClick={() => {
                                // 🔒 PROTECCIÓN: Evitar múltiples clicks
                                if (loading) return;
                                checkExistingAndLock();
                            }}
                            disabled={loading}
                            className="group text-left border-2 border-slate-100 rounded-3xl p-6 hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-6">
                                <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                    <i className="fas fa-lock text-2xl"></i>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xl font-black text-slate-800 group-hover:text-blue-900 mb-1">Bloquear como Papel de Trabajo</h4>
                                    <p className="text-sm text-slate-500 group-hover:text-blue-700 leading-snug font-medium">
                                        Genera la muestra definitiva y archiva la versión anterior en el histórico de trazabilidad.
                                    </p>
                                </div>
                                <i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                // 🔒 PROTECCIÓN: Evitar múltiples clicks
                                if (loading) return;
                                handleRunSampling(false);
                            }}
                            disabled={loading}
                            className="group text-left border-2 border-slate-100 rounded-3xl p-6 hover:border-slate-800 hover:bg-slate-50 transition-all shadow-sm hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-6">
                                <div className="h-16 w-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-slate-800 group-hover:text-white transition-all shadow-inner">
                                    <i className="fas fa-vial text-2xl"></i>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xl font-black text-slate-800 group-hover:text-slate-900 mb-1">Ejecutar Simulación / Ensayo</h4>
                                    <p className="text-sm text-slate-500 leading-snug font-medium">
                                        Visualice los resultados para calibrar. <span className="text-red-500 font-bold uppercase text-[10px]">No se persistirá en la base de datos.</span>
                                    </p>
                                </div>
                                <i className="fas fa-chevron-right text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                            </div>
                        </button>
                    </div>

                    {/* Botón ENTENDIDO para cerrar el modal */}
                    <div className="pt-4 border-t border-slate-200">
                        <button
                            onClick={() => setShowConfirmModal(false)}
                            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-check text-green-500"></i>
                            ENTENDIDO
                        </button>
                        <p className="text-xs text-slate-400 text-center mt-2">
                            Puede cerrar este modal y continuar configurando parámetros
                        </p>
                    </div>
                </div>
            </Modal>

            {/* MODAL DE ADVERTENCIA DE SUSTITUCIÓN */}
            <Modal
                isOpen={showReplaceWarning}
                onClose={() => setShowReplaceWarning(false)}
                title="Advertencia: Protocolo de Sustitución de Versión"
            >
                <div className="space-y-8 py-4">
                    <div className="bg-rose-50 border-2 border-rose-200 p-8 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <i className="fas fa-triangle-exclamation text-7xl text-rose-600"></i>
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-rose-900 font-black text-xl mb-4 flex items-center">
                                <i className="fas fa-history mr-3"></i>
                                Papel de Trabajo Activo Detectado
                            </h3>
                            <p className="text-rose-800 leading-relaxed font-medium mb-6">
                                Se ha identificado que esta población ya cuenta con una <span className="font-black underline">Muestra Definitiva Vigente</span> en el sistema.
                                <br /><br />
                                Al proceder con esta acción:
                            </p>
                            <div className="space-y-4">
                                <div className="flex items-start gap-4 bg-white/60 p-4 rounded-2xl border border-rose-200">
                                    <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <i className="fas fa-box-archive"></i>
                                    </div>
                                    <p className="text-xs text-rose-900 font-bold leading-normal">
                                        La muestra actual será desplazada al <span className="text-indigo-700">Archivo Histórico (Legacy)</span> manteniendo su integridad para futuras auditorías de calidad.
                                    </p>
                                </div>
                                <div className="flex items-start gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                                    <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <i className="fas fa-star"></i>
                                    </div>
                                    <p className="text-xs text-emerald-900 font-bold leading-normal">
                                        La nueva selección se establecerá como la <span className="text-emerald-700">Versión Vigente de Auditoría</span> para sus actuales papeles de trabajo.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowReplaceWarning(false)}
                            className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 hover:border-slate-300 transition-all"
                        >
                            Cancelar Acción
                        </button>
                        <button
                            onClick={() => handleRunSampling(true)}
                            className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black shadow-2xl uppercase text-xs tracking-widest transition-all transform hover:-translate-y-1 flex items-center justify-center"
                        >
                            <i className="fas fa-check-double mr-2 text-cyan-400"></i>
                            Confirmar Sustitución
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SamplingWorkspace;
