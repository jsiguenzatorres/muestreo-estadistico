
import React, { useState, useEffect } from 'react';
import { AppState } from '../../types';
import { ASSISTANT_CONTENT, WarningIcon } from '../../constants';
import { PremiumVariableCard, CustomGradientDropdown, DropdownOption } from '../ui/SamplingUI';

// --- Main Component ---

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const AttributeSampling: React.FC<Props> = ({ appState, setAppState }) => {
    const params = appState.samplingParams.attribute;

    const confidenceOptions: DropdownOption[] = [
        { value: 90, label: '90%', annotation: 'Moderado (Bajo Riesgo)' },
        { value: 92, label: '92%', annotation: 'Intermedio' },
        { value: 95, label: '95%', annotation: 'Estándar (Alto Riesgo)' },
        { value: 98, label: '98%', annotation: 'Muy Alto' },
        { value: 99, label: '99%', annotation: 'Crítico / Forense' },
    ];

    const tolerableOptions: DropdownOption[] = [
        { value: 2, label: '2%', annotation: 'Muy Estricto' },
        { value: 3, label: '3%', annotation: 'Estricto' },
        { value: 4, label: '4%', annotation: 'Control Clave' },
        { value: 5, label: '5%', annotation: 'Estándar (NIA)' },
        { value: 6, label: '6%', annotation: 'Moderado' },
        { value: 7, label: '7%', annotation: 'Flexible' },
        { value: 8, label: '8%', annotation: 'Bajo Riesgo' },
        { value: 9, label: '9%', annotation: 'Bajo Riesgo' },
        { value: 10, label: '10%', annotation: 'Muy Flexible' },
    ];

    const expectedOptions: DropdownOption[] = [
        { value: 0, label: '0%', annotation: 'Sin Errores Previstos' },
        { value: 0.25, label: '0.25%', annotation: 'Mínimo' },
        { value: 0.5, label: '0.5%', annotation: 'Muy Bajo' },
        { value: 1, label: '1.0%', annotation: 'Bajo' },
        { value: 1.25, label: '1.25%', annotation: 'Moderado Bajo' },
        { value: 1.5, label: '1.5%', annotation: 'Moderado' },
        { value: 2, label: '2.0%', annotation: 'Significativo' },
        { value: 2.5, label: '2.5%', annotation: 'Alto' },
        { value: 3, label: '3.0%', annotation: 'Muy Alto' },
        { value: 3.5, label: '3.5%', annotation: 'Crítico' },
        { value: 4, label: '4.0%', annotation: 'Excesivo' },
        { value: 5, label: '5.0%', annotation: 'No Recomendado' },
    ];

    const handleCustomChange = (name: string, value: number) => {
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                attribute: {
                    ...prev.samplingParams.attribute,
                    [name]: value
                }
            }
        }));
    };

    const toggleSequential = () => {
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                attribute: {
                    ...prev.samplingParams.attribute,
                    useSequential: !prev.samplingParams.attribute.useSequential
                }
            }
        }));
    };

    // --- Validación Inteligente Stop-or-Go ---
    const getRFactorAttr = (nc: number) => {
        if (nc >= 99) return 4.6;
        if (nc >= 95) return 3.0;
        return 2.3; // 90% y otros
    };

    const rf = getRFactorAttr(params.NC);
    const theoreticalN = Math.ceil((rf * 100) / (Math.max(0.1, params.ET - params.PE)));
    const isPilotInefficient = params.useSequential && theoreticalN < 25;

    const adjustToStatisticalMin = () => {
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                attribute: { ...prev.samplingParams.attribute, useSequential: false }
            }
        }));
    };

    const isPeCloseToEt = params.PE >= params.ET / 2 && params.PE < params.ET;
    const isPeInvalid = params.PE >= params.ET;

    return (
        <div className="space-y-8 animate-fade-in">
            {isPilotInefficient && (
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg animate-bounce-subtle">
                    <div className="flex items-center gap-4 text-center md:text-left">
                        <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-inner">
                            <i className="fas fa-exclamation-triangle text-xl"></i>
                        </div>
                        <div>
                            <h4 className="text-amber-900 font-black text-xs uppercase tracking-widest">Inconsistencia Stop-or-Go</h4>
                            <p className="text-[11px] text-amber-700 font-medium leading-relaxed max-w-md">
                                El tamaño inicial secuencial (25) es <span className="font-black underline">superior</span> al requerimiento estadístico calculado (<span className="text-amber-900 font-black">{theoreticalN}</span>).
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={adjustToStatisticalMin}
                        className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-amber-700 transition-all transform hover:-translate-y-0.5 whitespace-nowrap"
                    >
                        <i className="fas fa-magic mr-2"></i> Usar {theoreticalN} ítems
                    </button>
                </div>
            )}

            {/* Banner Premium: Calibración Científica (Sequential Stop-or-Go) */}
            <div className="relative group overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-md transition-all hover:shadow-lg">
                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-100/50 to-transparent pointer-events-none"></div>
                <div className="absolute left-0 top-0 h-full w-1.5 bg-blue-500"></div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-white rounded-xl shadow-sm border border-blue-200 flex items-center justify-center text-blue-600">
                            <i className="fas fa-step-forward text-2xl"></i>
                        </div>
                        <div>
                            <h4 className="text-blue-900 font-black text-lg tracking-tight flex items-center">
                                Muestreo Secuencial
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600 border border-blue-200 uppercase">Stop-or-Go</span>
                            </h4>
                            <p className="text-sm text-blue-700/80 font-medium">Comience con una muestra pequeña (n=25). Si hay 0 errores, el proceso se detiene.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white shadow-inner">
                        <span className={`text-xs font-black uppercase tracking-widest ${params.useSequential ? 'text-blue-600' : 'text-slate-400'}`}>
                            Activar Secuencial
                        </span>
                        <button
                            onClick={toggleSequential}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ${params.useSequential ? 'bg-blue-500 ring-blue-500' : 'bg-slate-300 ring-slate-200'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${params.useSequential ? 'translate-x-8' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <PremiumVariableCard
                    title="Población (N)"
                    subtitle="Universo Total"
                    icon="fa-users"
                    colorTheme="slate"
                    infoKey="poblacionTotal"
                    currentValue={params.N.toLocaleString()}
                >
                    <div className="relative rounded-lg shadow-inner bg-slate-100 p-1">
                        <div className="flex items-center bg-white rounded-md border border-slate-200 px-4 py-3">
                            <span className="flex-grow font-mono text-xl font-bold text-slate-700">{params.N.toLocaleString()}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">Registros</span>
                        </div>
                    </div>
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Nivel de Confianza (NC)"
                    subtitle="Seguridad Estadística"
                    icon="fa-shield-alt"
                    colorTheme="blue"
                    infoKey="nivelConfianza"
                    currentValue={`${params.NC}%`}
                >
                    <CustomGradientDropdown
                        value={params.NC}
                        options={confidenceOptions}
                        onChange={(val) => handleCustomChange('NC', val)}
                        colorTheme="blue"
                    />
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Desviación Tolerable (ET)"
                    subtitle="Umbral de Riesgo"
                    icon="fa-exclamation-triangle"
                    colorTheme="amber"
                    infoKey="desviacionTolerable"
                    currentValue={`${params.ET}%`}
                >
                    <CustomGradientDropdown
                        value={params.ET}
                        options={tolerableOptions}
                        onChange={(val) => handleCustomChange('ET', val)}
                        colorTheme="amber"
                    />
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Desviación Esperada (PE)"
                    subtitle="Anticipación de Error"
                    icon="fa-history"
                    colorTheme="teal"
                    infoKey="desviacionEsperada"
                    currentValue={`${params.PE}%`}
                >
                    <div className={`${isPeInvalid ? 'ring-2 ring-red-500 rounded-lg' : ''}`}>
                        <CustomGradientDropdown
                            value={params.PE}
                            options={expectedOptions}
                            onChange={(val) => handleCustomChange('PE', val)}
                            colorTheme="teal"
                        />
                    </div>
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Semilla Estadística (Seed)"
                    subtitle="Control de Aleatoriedad"
                    icon="fa-random"
                    colorTheme="slate"
                    infoKey="poblacionTotal"
                    currentValue={appState.generalParams.seed}
                >
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={appState.generalParams.seed}
                            onChange={(e) => setAppState(prev => ({
                                ...prev,
                                generalParams: { ...prev.generalParams, seed: Number(e.target.value) }
                            }))}
                            className="flex-grow px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 outline-none shadow-sm"
                        />
                        <button
                            onClick={() => setAppState(prev => ({
                                ...prev,
                                generalParams: { ...prev.generalParams, seed: Math.floor(Math.random() * 1000000) }
                            }))}
                            className="px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-black transition-all shadow-md group-hover:shadow-lg active:scale-95"
                            title="Sugerir Semilla Aleatoria"
                        >
                            <i className="fas fa-magic"></i>
                        </button>
                    </div>
                </PremiumVariableCard>
            </div>

            {(isPeCloseToEt || isPeInvalid) && (
                <div className={`mt-6 p-5 rounded-xl flex items-start border shadow-md animate-fade-in-up ${isPeInvalid ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex-shrink-0 mt-1">
                        <div className={`p-2 rounded-full ${isPeInvalid ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                            <WarningIcon />
                        </div>
                    </div>
                    <div className="ml-4">
                        <h3 className={`text-sm font-bold uppercase tracking-wide ${isPeInvalid ? 'text-red-800' : 'text-amber-800'}`}>
                            {isPeInvalid ? 'Configuración Crítica Inválida' : 'Advertencia de Eficiencia'}
                        </h3>
                        <div className={`mt-2 text-sm leading-relaxed ${isPeInvalid ? 'text-red-700' : 'text-amber-700'}`}>
                            <p>
                                {isPeInvalid
                                    ? 'La Desviación Esperada (PE) debe ser estricamente menor que la Desviación Tolerable (ET) para que el muestreo sea estadísticamente viable.'
                                    : 'La Desviación Esperada está próxima a la Tolerable. Esto resultará en un tamaño de muestra considerablemente mayor para mantener la confianza estadística.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttributeSampling;
