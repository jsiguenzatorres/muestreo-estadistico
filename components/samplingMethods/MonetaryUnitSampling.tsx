
import React, { useState, useEffect } from 'react';
import { AppState } from '../../types';
import { ASSISTANT_CONTENT, WarningIcon } from '../../constants';
import { PremiumVariableCard, CustomGradientDropdown, DropdownOption } from '../ui/SamplingUI';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const MonetaryUnitSampling: React.FC<Props> = ({ appState, setAppState }) => {
    const params = appState.samplingParams.mus;

    const riaOptions: DropdownOption[] = [
        { value: 5, label: '5%', annotation: 'Alto Nivel (Confianza 95%)' },
        { value: 10, label: '10%', annotation: 'Estándar (Confianza 90%)' },
        { value: 15, label: '15%', annotation: 'Moderado (Confianza 85%)' },
        { value: 25, label: '25%', annotation: 'Bajo Nivel (NIA)' },
        { value: 50, label: '50%', annotation: 'Mínimo (Criterio Auditor)' },
    ];

    const handleCustomChange = (name: string, value: any) => {
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                mus: { ...prev.samplingParams.mus, [name]: value }
            }
        }));
    };

    const togglePilot = () => {
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                mus: { ...prev.samplingParams.mus, usePilotSample: !prev.samplingParams.mus.usePilotSample }
            }
        }));
    };

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

    // Cálculo dinámico del intervalo (simplificado para feedback inmediato)
    const getRFactor = (ria: number) => {
        if (ria <= 5) return 3.0;
        if (ria <= 10) return 2.31;
        if (ria <= 15) return 1.9;
        if (ria <= 25) return 1.39;
        return 0.7; // 50%
    };

    const rf = getRFactor(params.RIA);
    const intervalValue = params.TE / rf;
    const absV = Math.abs(params.V); // Handle negative population values (e.g. Liabilities)
    const theoreticalNRaw = Math.ceil(absV / intervalValue);
    
    // CORRECCIÓN: Si la muestra teórica excede la población, ajustar automáticamente
    const populationSize = appState.selectedPopulation?.total_rows || 1;
    const theoreticalN = theoreticalNRaw > populationSize ? populationSize : theoreticalNRaw;
    const isFullCensus = theoreticalNRaw > populationSize;
    
    const isPilotInefficient = params.usePilotSample && theoreticalN < 30;

    const adjustToStatisticalMin = () => {
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                mus: { ...prev.samplingParams.mus, usePilotSample: false }
            }
        }));
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {isPilotInefficient && (
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg animate-bounce-subtle">
                    <div className="flex items-center gap-4 text-center md:text-left">
                        <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-inner">
                            <i className="fas fa-exclamation-triangle text-xl"></i>
                        </div>
                        <div>
                            <h4 className="text-amber-900 font-black text-xs uppercase tracking-widest">Inconsistencia de Tamaño</h4>
                            <p className="text-[11px] text-amber-700 font-medium leading-relaxed max-w-md">
                                El piloto (30) es <span className="font-black underline">superior</span> al requerimiento estadístico calculado (<span className="text-amber-900 font-black">{theoreticalN}</span>). Recomendamos usar el cálculo directo.
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

            {/* Banner Premium: Calibración Científica */}
            <div className="relative group overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-md transition-all hover:shadow-lg">
                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-amber-100/50 to-transparent pointer-events-none"></div>
                <div className="absolute left-0 top-0 h-full w-1.5 bg-amber-500"></div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-white rounded-xl shadow-sm border border-amber-200 flex items-center justify-center text-amber-600">
                            <i className="fas fa-microscope text-2xl"></i>
                        </div>
                        <div>
                            <h4 className="text-amber-900 font-black text-lg tracking-tight flex items-center">
                                Calibración Científica
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-600 border border-amber-200 uppercase">Beta Testing</span>
                            </h4>
                            <p className="text-sm text-amber-700/80 font-medium">Utilice una muestra piloto (n=30) para validar sus estimaciones de error antes del cálculo final.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white shadow-inner">
                        <span className={`text-xs font-black uppercase tracking-widest ${params.usePilotSample ? 'text-amber-600' : 'text-slate-400'}`}>
                            Activar Piloto (n=30)
                        </span>
                        <button
                            onClick={togglePilot}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ${params.usePilotSample ? 'bg-amber-500 ring-amber-500' : 'bg-slate-300 ring-slate-200'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${params.usePilotSample ? 'translate-x-8' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <PremiumVariableCard
                    title="Valor de la Población (V)"
                    subtitle="Universo Monetario"
                    icon="fa-money-bill-wave"
                    colorTheme="slate"
                    infoKey="valorTotalPoblacion"
                    currentValue={formatCurrency(params.V)}
                >
                    <div className="relative rounded-lg shadow-inner bg-slate-100 p-1">
                        <div className="flex items-center bg-white rounded-md border border-slate-200 px-4 py-3">
                            <span className="flex-grow font-mono text-xl font-bold text-slate-700">{formatCurrency(params.V)}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">V</span>
                        </div>
                    </div>
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Error Tolerable (TE)"
                    subtitle="Ejecución / Materialidad"
                    icon="fa-crosshairs"
                    colorTheme="orange"
                    infoKey="errorTolerable"
                    currentValue={formatCurrency(params.TE)}
                >
                    <div className="flex items-center gap-2">
                        <div className="relative flex-grow">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                            <input
                                type="number"
                                value={params.TE}
                                onChange={(e) => handleCustomChange('TE', Number(e.target.value))}
                                className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-lg font-bold text-gray-800 focus:ring-2 focus:ring-orange-400 outline-none"
                            />
                        </div>
                    </div>
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Errores Previstos (EE)"
                    subtitle="Anticipación de Error"
                    icon="fa-history"
                    colorTheme="teal"
                    infoKey="erroresPrevistos"
                    currentValue={formatCurrency(params.EE)}
                >
                    <div className="relative flex-grow">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                        <input
                            type="number"
                            value={params.EE}
                            onChange={(e) => handleCustomChange('EE', Number(e.target.value))}
                            className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-lg font-bold text-gray-800 focus:ring-2 focus:ring-teal-400 outline-none"
                        />
                    </div>
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Riesgo Aceptación (RIA)"
                    subtitle="Confianza Estadística"
                    icon="fa-shield-alt"
                    colorTheme="blue"
                    infoKey="riesgoAceptacionIncorrecta"
                    currentValue={`${params.RIA}%`}
                >
                    <CustomGradientDropdown
                        value={params.RIA}
                        options={riaOptions}
                        onChange={(val) => handleCustomChange('RIA', val)}
                        colorTheme="blue"
                    />
                </PremiumVariableCard>

                <PremiumVariableCard
                    title="Semilla Estadística (Seed)"
                    subtitle="Control de Aleatoriedad"
                    icon="fa-random"
                    colorTheme="slate"
                    infoKey="semilla"
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
                            className="flex-grow px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold text-sm focus:ring-2 focus:ring-slate-400 outline-none shadow-sm"
                        />
                        <button
                            onClick={() => setAppState(prev => ({
                                ...prev,
                                generalParams: { ...prev.generalParams, seed: Math.floor(Math.random() * 1000000) }
                            }))}
                            className="px-4 py-3 bg-slate-800 text-white rounded-lg hover:bg-black transition-all shadow-md active:scale-95"
                            title="Sugerir Semilla Aleatoria"
                        >
                            <i className="fas fa-magic"></i>
                        </button>
                    </div>
                </PremiumVariableCard>

                <div className="bg-[#0f172a] rounded-xl p-8 text-white relative overflow-hidden flex flex-col justify-center border border-slate-800 shadow-2xl group transition-all hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <i className="fas fa-calculator text-6xl rotate-12"></i>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Proyección Técnica Estimates
                    </div>
                    <div className="flex flex-col gap-4">
                        <div>
                            <div className="text-3xl font-black text-white tracking-tighter">
                                {formatCurrency(intervalValue)}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Intervalo de Muestreo (J)</div>
                        </div>
                        <div className="pt-4 border-t border-slate-800">
                            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                                <span>Unidades Monetarias Requeridas</span>
                                <span className={`font-mono font-bold ${isFullCensus ? 'text-yellow-400' : 'text-emerald-400'}`}>
                                    ${theoreticalNRaw.toLocaleString()}
                                    {isFullCensus && <span className="ml-1 text-[10px]">(CENSO)</span>}
                                </span>
                            </div>
                            {isFullCensus && (
                                <div className="text-[9px] text-yellow-400 mb-2 font-medium">
                                    Requiere ${theoreticalNRaw.toLocaleString()} unidades → Censo de {populationSize} registros
                                </div>
                            )}
                            <div className="text-[9px] text-slate-500 mb-2">
                                Registros físicos a auditar: <span className="text-emerald-400 font-bold">{theoreticalN}</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                                <div className={`h-full shadow-[0_0_10px_rgba(16,185,129,0.5)] ${
                                    isFullCensus ? 'bg-yellow-500 w-full' : 'bg-emerald-500 w-[65%]'
                                }`}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Configuración de Estratificación y Tratamiento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-inner">
                <div className="space-y-4">
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Estrategia de Optimización</h5>
                    <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group hover:border-blue-200 transition-colors">
                        <div
                            onClick={() => handleCustomChange('optimizeTopStratum', !params.optimizeTopStratum)}
                            className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${params.optimizeTopStratum ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-200'}`}
                        >
                            {params.optimizeTopStratum && <i className="fas fa-check text-[10px] text-white"></i>}
                        </div>
                        <div className="flex-grow">
                            <label
                                onClick={() => handleCustomChange('optimizeTopStratum', !params.optimizeTopStratum)}
                                className="text-sm font-black text-slate-700 block cursor-pointer"
                            >
                                Estrato de Certeza
                            </label>
                            <p className="text-[10px] text-slate-500 font-medium">Extraer automáticamente ítems ≥ {formatCurrency(intervalValue)} al 100%.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Tratamiento de Negativos</h5>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors">
                        <select
                            name="handleNegatives"
                            value={params.handleNegatives}
                            onChange={(e) => handleCustomChange('handleNegatives', e.target.value)}
                            className="w-full bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="Separate">Segregar (Reporte Aparte)</option>
                            <option value="Zero">Tratar como Cero</option>
                            <option value="Absolute">Usar Valor Absoluto</option>
                        </select>
                        <p className="text-[10px] text-slate-500 font-medium mt-2">Define cómo se procesarán los saldos acreedores o negativos.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonetaryUnitSampling;
