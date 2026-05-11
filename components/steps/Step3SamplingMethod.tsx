
import React, { useState, useEffect } from 'react';
import { AppState, SamplingMethod, Step } from '../../types';
import AttributeSampling from '../samplingMethods/AttributeSampling';
import MonetaryUnitSampling from '../samplingMethods/MonetaryUnitSampling';
import ClassicalVariablesSampling from '../samplingMethods/ClassicalVariablesSampling';
import NonStatisticalSampling from '../samplingMethods/NonStatisticalSampling';
import StratifiedSampling from '../samplingMethods/StratifiedSampling';
import { calculateSampleSize } from '../../services/statisticalService';
import { supabase } from '../../services/supabaseClient';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    setCurrentStep: (step: Step) => void;
}

const Step3SamplingMethod: React.FC<Props> = ({ appState, setAppState, setCurrentStep }) => {
    const [loading, setLoading] = useState(false);
    const [dataStatus, setDataStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error' | 'empty', count: number }>({ status: 'idle', count: 0 });

    // Verificación de datos al cargar el paso
    useEffect(() => {
        const checkDataAvailability = async () => {
            if (!appState.selectedPopulation) return;

            setDataStatus(prev => ({ ...prev, status: 'loading' }));
            try {
                // Hacemos un count head-only para verificar disponibilidad rápidamente
                const { count, error } = await supabase
                    .from('audit_data_rows')
                    .select('*', { count: 'exact', head: true })
                    .eq('population_id', appState.selectedPopulation.id);

                if (error) {
                    console.error("Error verificando datos en Supabase:", error);
                    setDataStatus({ status: 'error', count: 0 });
                } else {
                    const finalCount = count || 0;
                    console.log(`Verificación de Supabase: ${finalCount} filas disponibles.`);
                    setDataStatus({ status: finalCount > 0 ? 'success' : 'empty', count: finalCount });
                }
            } catch (e) {
                console.error("Excepción verificando datos:", e);
                setDataStatus({ status: 'error', count: 0 });
            }
        };

        checkDataAvailability();
    }, [appState.selectedPopulation]);

    const handleMethodChange = (method: SamplingMethod) => {
        setAppState(prev => ({ ...prev, samplingMethod: method }));
    };

    const handleRunSampling = async () => {
        setLoading(true);
        try {
            let realRows: any[] = [];
            
            // Si hay una población seleccionada, intentamos descargar sus filas para usarlas en el muestreo
            if (appState.selectedPopulation) {
                
                console.log(`Iniciando descarga para Population ID: ${appState.selectedPopulation.id}`);
                
                const { data, error } = await supabase
                    .from('audit_data_rows')
                    .select('unique_id_col, monetary_value_col, raw_json')
                    .eq('population_id', appState.selectedPopulation.id)
                    .limit(10000); 
                
                if (error) {
                    console.error("Error crítico recuperando filas:", error);
                    alert(`Error conectando con la base de datos: ${error.message}`);
                    setLoading(false);
                    return;
                }

                if (!data || data.length === 0) {
                    // BLOQUEO ESTRICTO: Si no hay datos, no calculamos muestra sintética.
                    console.error("La consulta devolvió 0 filas.");
                    alert("ERROR CRÍTICO DE DATOS:\n\nNo se encontraron registros asociados a esta población en la base de datos. \n\nPor favor, vuelva a cargar el archivo en el 'Gestor de Poblaciones' para asegurar la integridad de la muestra.");
                    setLoading(false);
                    return;
                }

                console.log(`Datos descargados correctamente: ${data.length} registros.`);
                realRows = data;
            } else {
                alert("No hay una población seleccionada en el estado de la aplicación.");
                setLoading(false);
                return;
            }

            const results = calculateSampleSize(appState, realRows);
            setAppState(prev => ({...prev, results}));
            setCurrentStep(Step.Results);
        } catch (error) {
            console.error("Sampling error:", error);
            alert("Ocurrió un error inesperado calculando la muestra. Revise la consola del navegador.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleBack = () => {
        setCurrentStep(Step.GeneralParams);
    };

    const tabs = [
        { id: SamplingMethod.Attribute, label: 'Atributos', icon: 'fa-check-circle' },
        { id: SamplingMethod.MUS, label: 'MUS', icon: 'fa-dollar-sign' },
        { id: SamplingMethod.Stratified, label: 'Estratificado', icon: 'fa-layer-group' },
        { id: SamplingMethod.CAV, label: 'Variables (CAV)', icon: 'fa-calculator' },
        { id: SamplingMethod.NonStatistical, label: 'No Estadístico', icon: 'fa-user-check' },
    ];

    // Helper para renderizar estado de datos
    const renderDataStatus = () => {
        const { status, count } = dataStatus;
        if (status === 'loading') return <span className="text-xs text-blue-500 font-bold"><i className="fas fa-circle-notch fa-spin mr-1"></i> Verificando conexión BD...</span>;
        if (status === 'success') return <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-200"><i className="fas fa-database mr-1"></i> Conectado: {count.toLocaleString()} registros reales disponibles</span>;
        if (status === 'empty') return <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200"><i className="fas fa-exclamation-triangle mr-1"></i> Población vacía en BD</span>;
        if (status === 'error') return <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-200"><i className="fas fa-times-circle mr-1"></i> Error de conexión</span>;
        return null;
    };

    return (
        <div className="animate-fade-in">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Selección del Método de Muestreo</h2>
                    <p className="text-gray-600">Elija el método de muestreo que mejor se adapte al objetivo de su prueba de auditoría e ingrese los parámetros requeridos.</p>
                </div>
                {/* Indicador de Estado de Datos */}
                <div className="mt-1">
                    {renderDataStatus()}
                </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 bg-gray-50/50">
                    <nav className="-mb-px flex space-x-0 overflow-x-auto" aria-label="Tabs">
                        {tabs.map(tab => {
                             const isActive = appState.samplingMethod === tab.id;
                             return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleMethodChange(tab.id)}
                                    className={`${
                                        isActive
                                            ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                    } whitespace-nowrap py-4 px-6 border-b-2 font-bold text-sm flex items-center transition-colors flex-1 justify-center`}
                                >
                                    <i className={`fas ${tab.icon} mr-2 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}></i>
                                    {tab.label}
                                </button>
                             );
                        })}
                    </nav>
                </div>
                <div className="p-8">
                    {appState.samplingMethod === SamplingMethod.Attribute && <AttributeSampling appState={appState} setAppState={setAppState} />}
                    {appState.samplingMethod === SamplingMethod.MUS && <MonetaryUnitSampling appState={appState} setAppState={setAppState} />}
                    {appState.samplingMethod === SamplingMethod.Stratified && <StratifiedSampling appState={appState} setAppState={setAppState} />}
                    {appState.samplingMethod === SamplingMethod.CAV && <ClassicalVariablesSampling appState={appState} setAppState={setAppState} />}
                    {appState.samplingMethod === SamplingMethod.NonStatistical && <NonStatisticalSampling appState={appState} setAppState={setAppState} />}
                </div>

                 <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                    <button 
                        onClick={handleBack} 
                        className="px-6 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-700 uppercase tracking-widest hover:text-blue-800 hover:border-blue-500 hover:shadow-xl transition-all transform hover:-translate-y-1 group flex items-center shadow-md"
                    >
                        <div className="bg-slate-100 group-hover:bg-blue-50 p-2 rounded-lg mr-3 transition-colors">
                            <i className="fas fa-chevron-left text-blue-600 transform group-hover:-translate-x-1 transition-transform"></i>
                        </div>
                        Atrás
                    </button>
                    <button 
                        onClick={handleRunSampling} 
                        disabled={loading || dataStatus.status === 'loading' || dataStatus.status === 'empty' || dataStatus.status === 'error'}
                        className="inline-flex items-center px-8 py-3 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 transform transition-all duration-200 hover:-translate-y-0.5 uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <i className="fas fa-circle-notch fa-spin mr-2"></i> : <i className="fas fa-play mr-2"></i>}
                        {loading ? 'Procesando Datos...' : 'Calcular Muestra Real'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Step3SamplingMethod;
