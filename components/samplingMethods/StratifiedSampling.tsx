
import React from 'react';
import { AppState } from '../../types';
import InfoHelper from '../ui/InfoHelper';
import { ASSISTANT_CONTENT } from '../../constants';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const StratifiedSampling: React.FC<Props> = ({ appState, setAppState }) => {
    const params = appState.samplingParams.stratified;
    const categoryColumn = appState.selectedPopulation?.column_mapping.category;
    const subcategoryColumn = appState.selectedPopulation?.column_mapping.subcategory;
    const populationSize = appState.selectedPopulation?.total_rows || 0;

    // Calcular estratos sugeridos usando regla de Sturges
    const calculateSuggestedStrata = (n: number): number => {
        if (n < 50) return 2;
        if (n < 100) return 3;
        // Regla de Sturges: k = 1 + 3.322 * log10(N)
        const k = Math.ceil(1 + 3.322 * Math.log10(n));
        return Math.min(Math.max(k, 2), 6); // Entre 2 y 6 estratos
    };

    const suggestedStrata = calculateSuggestedStrata(populationSize);

    // Determinar si debe usar estratos automáticos o manuales
    const shouldUseAutoStrata = params.basis !== 'Monetary';

    // Mensaje informativo según la base seleccionada
    const getStrataInfo = () => {
        if (params.basis === 'Category' || params.selectedVariables?.includes('Category')) {
            return {
                type: 'auto',
                message: 'Se creará un estrato por cada categoría única detectada en los datos (Basado en regla de Sturges).',
                icon: 'fa-tags',
                color: 'purple'
            };
        }
        if (params.basis === 'Subcategory' || params.selectedVariables?.includes('Subcategory')) {
            return {
                type: 'auto',
                message: 'Se creará un estrato por cada subcategoría única detectada en los datos (Basado en regla de Sturges).',
                icon: 'fa-tag',
                color: 'pink'
            };
        }
        if (params.basis === 'MultiVariable') {
            return {
                type: 'auto',
                message: 'Se creará un estrato por cada combinación única de categoría y subcategoría (Basado en regla de Sturges).',
                icon: 'fa-magic',
                color: 'indigo'
            };
        }
        return {
            type: 'manual',
            message: `Basado en la regla de Sturges, se sugieren ${suggestedStrata} estratos para ${populationSize} registros.`,
            icon: 'fa-coins',
            color: 'indigo'
        };
    };

    const strataInfo = getStrataInfo();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? Number(value) : (type === 'checkbox' ? (e.target as HTMLInputElement).checked : value);
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                stratified: { ...prev.samplingParams.stratified, [name]: val }
            }
        }));
    };

    const togglePilot = () => {
        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                stratified: { ...prev.samplingParams.stratified, usePilotSample: !prev.samplingParams.stratified.usePilotSample }
            }
        }));
    };

    const handleBasisChange = (basis: 'Monetary' | 'Category' | 'Subcategory' | 'MultiVariable') => {
        setAppState(prev => {
            const currentBasis = prev.samplingParams.stratified.basis;
            let selectedVariables = prev.samplingParams.stratified.selectedVariables || [];
            let finalBasis = basis;

            if (basis === 'Monetary') {
                selectedVariables = [];
            } else {
                if (currentBasis === 'Monetary') {
                    selectedVariables = [basis as 'Category' | 'Subcategory'];
                } else if (selectedVariables.includes(basis as any)) {
                    selectedVariables = selectedVariables.filter(v => v !== basis);
                    if (selectedVariables.length === 0) finalBasis = 'Monetary';
                    else finalBasis = selectedVariables[0] as any;
                } else {
                    selectedVariables = [...selectedVariables, basis as 'Category' | 'Subcategory'];
                    finalBasis = 'MultiVariable';
                }
            }

            return {
                ...prev,
                samplingParams: {
                    ...prev.samplingParams,
                    stratified: {
                        ...prev.samplingParams.stratified,
                        basis: finalBasis as any,
                        selectedVariables
                    }
                }
            };
        });
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Banner Premium: Calibración Científica */}
            <div className="relative group overflow-hidden bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6 shadow-md transition-all hover:shadow-lg">
                <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-indigo-100/50 to-transparent pointer-events-none"></div>
                <div className="absolute left-0 top-0 h-full w-1.5 bg-indigo-500"></div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 bg-white rounded-xl shadow-sm border border-indigo-200 flex items-center justify-center text-indigo-600">
                            <i className="fas fa-layer-group text-2xl"></i>
                        </div>
                        <div>
                            <h4 className="text-indigo-900 font-black text-lg tracking-tight flex items-center">
                                Análisis de Dispersión
                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-600 border border-indigo-200 uppercase">Pre-Muestreo</span>
                                <span className="ml-2"><InfoHelper title={ASSISTANT_CONTENT.muestraPiloto.title} content={ASSISTANT_CONTENT.muestraPiloto.content} /></span>
                            </h4>
                            <p className="text-sm text-indigo-700/80 font-medium">Calibración automática de límites para maximizar precisión estadística.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white shadow-inner">
                        <span className={`text-xs font-black uppercase tracking-widest ${params.usePilotSample ? 'text-indigo-600' : 'text-slate-400'}`}>
                            Activar Diagnóstico
                        </span>
                        <button
                            onClick={togglePilot}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ring-2 ring-offset-2 ${params.usePilotSample ? 'bg-indigo-500 ring-indigo-500' : 'bg-slate-300 ring-slate-200'}`}
                        >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-lg ${params.usePilotSample ? 'translate-x-8' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Panel Proyectivo Technical Alignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#0f172a] p-8 rounded-3xl text-white border border-slate-800 relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Modelo Proyectivo NIA 530</h4>
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-[8px] font-black rounded border border-indigo-500/30">DETERMINISTA</span>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Fórmula de Tamaño base (n)</span>
                                <code className="text-xs text-indigo-200 font-mono">n = (Z² × σ²) / e²</code>
                            </div>

                            <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Ajuste Población Finita (FPCF)</span>
                                <code className="text-xs text-indigo-200 font-mono">n' = n / (1 + n/N)</code>
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-500 uppercase block">Proyección Sugerida</span>
                                        <p className="text-3xl font-black text-white">
                                            {Math.ceil(Math.pow(((appState.selectedPopulation?.total_rows || 1000) * (params.NC >= 95 ? 1.96 : 1.645) * (appState.selectedPopulation?.descriptive_stats?.std_dev || 1000)) / (Math.max(1, (params.ET / 100) * (appState.selectedPopulation?.total_monetary_value || 1000000))), 2))}
                                            <span className="text-xs font-medium text-slate-500 ml-2">unidades</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] font-black text-slate-500 uppercase block">Confianza</span>
                                        <p className="text-lg font-black text-indigo-400">{params.NC}%</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Lógica de Distribución</h4>
                        <div className="space-y-4">
                            <div className={`p-4 rounded-2xl border ${params.allocationMethod === 'Óptima (Neyman)' ? 'bg-purple-50 border-purple-100' : 'bg-slate-50 border-slate-100'}`}>
                                <p className="text-[10px] font-black text-slate-800 uppercase mb-1">Neyman Allocation</p>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Asigna más ítems a los estratos con mayor varianza ($\sigma_h$), optimizando la precisión para fraudes de alto valor.</p>
                            </div>
                            <div className={`p-4 rounded-2xl border ${params.allocationMethod === 'Proporcional' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                                <p className="text-[10px] font-black text-slate-800 uppercase mb-1">Proportional Distribution</p>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Distribución equitativa basada en el peso poblacional ($N_h$). Ideal para auditorías de cumplimiento general.</p>
                            </div>
                        </div>
                    </div>
                    <p className="text-[9px] text-slate-400 italic mt-4 text-center">
                        <i className="fas fa-shield-alt mr-2"></i> Implementación estricta de NIA-ES 530 para mitigar alucinaciones estadísticas.
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                <label className="block text-sm font-bold text-slate-800 mb-6 uppercase tracking-[0.15em] text-center">Base de Estratificación Seleccionada</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button onClick={() => handleBasisChange('Monetary')} className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center transition-all transform hover:scale-[1.02] ${params.basis === 'Monetary' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md ring-4 ring-indigo-50' : 'border-gray-100 bg-slate-50 text-gray-400 opacity-60'}`}>
                        <i className="fas fa-coins text-3xl mb-3"></i>
                        <span className="font-black text-sm uppercase">Monetario (Clásico)</span>
                    </button>
                    <button onClick={() => handleBasisChange('Category')} disabled={!categoryColumn} className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center transition-all transform hover:scale-[1.02] ${params.selectedVariables?.includes('Category') ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md ring-4 ring-purple-50' : 'border-gray-100 bg-slate-50 text-gray-400 opacity-60'} disabled:cursor-not-allowed`}>
                        <i className="fas fa-tag text-3xl mb-3"></i>
                        <span className="font-black text-sm uppercase">Variable 1 (Cat.)</span>
                    </button>
                    <button onClick={() => handleBasisChange('Subcategory')} disabled={!subcategoryColumn} className={`p-6 rounded-2xl border-2 flex flex-col items-center justify-center transition-all transform hover:scale-[1.02] ${params.selectedVariables?.includes('Subcategory') ? 'border-pink-500 bg-pink-50 text-pink-700 shadow-md ring-4 ring-pink-50' : 'border-gray-100 bg-slate-50 text-gray-400 opacity-60'} disabled:cursor-not-allowed`}>
                        <i className="fas fa-tags text-3xl mb-3"></i>
                        <span className="font-black text-sm uppercase">Variable 2 (Subcat.)</span>
                    </button>
                </div>
                {params.basis === 'MultiVariable' && (
                    <div className="mt-4 p-4 bg-indigo-900 rounded-xl text-white text-center animate-bounce-subtle">
                        <p className="text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            <i className="fas fa-magic text-cyan-400"></i> Análisis Multivariable Activo: Combinando Criterios
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Cantidad de Estratos - Sistema Híbrido */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg border-t-4 border-t-indigo-500">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-4">
                        Cantidad de Estratos
                        <span className="ml-2"><InfoHelper title={ASSISTANT_CONTENT.cantidadEstratos.title} content={ASSISTANT_CONTENT.cantidadEstratos.content} /></span>
                    </label>

                    {strataInfo.type === 'auto' ? (
                        // Modo Automático (Categoría/Subcategoría)
                        <div className="space-y-4">
                            <div className={`p-4 rounded-xl bg-${strataInfo.color}-50 border border-${strataInfo.color}-200`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <i className={`fas ${strataInfo.icon} text-${strataInfo.color}-600 text-xl`}></i>
                                    <span className="text-xs font-black text-${strataInfo.color}-900 uppercase">Automático</span>
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed">
                                    {strataInfo.message}
                                </p>
                            </div>
                            <div className="text-center p-3 bg-slate-50 rounded-xl">
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">Estratos se calcularán al generar</p>
                                <p className="text-2xl font-black text-slate-700">
                                    <i className="fas fa-magic text-indigo-500"></i>
                                </p>
                            </div>
                        </div>
                    ) : (
                        // Modo Manual (Monetario)
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                                <i className="fas fa-lightbulb text-indigo-600"></i>
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-indigo-900 uppercase tracking-wider">Sugerido</p>
                                    <p className="text-xs text-indigo-700 font-medium">{suggestedStrata} estratos (Regla de Sturges)</p>
                                </div>
                                <button
                                    onClick={() => handleChange({ target: { name: 'strataCount', value: suggestedStrata, type: 'number' } } as any)}
                                    className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-indigo-700 transition-all"
                                >
                                    Aplicar
                                </button>
                            </div>
                            <input 
                                type="number" 
                                name="strataCount" 
                                value={params.strataCount} 
                                onChange={handleChange} 
                                min="2" 
                                max="10" 
                                className="w-full text-3xl font-black text-slate-800 border-none p-0 focus:ring-0" 
                            />
                            <div className="mt-2 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${(params.strataCount / 10) * 100}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg border-t-4 border-t-purple-500">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-4">
                        Método Asignación
                        <span className="ml-2"><InfoHelper title={ASSISTANT_CONTENT.metodoAsignacion.title} content={ASSISTANT_CONTENT.metodoAsignacion.content} /></span>
                    </label>
                    <select name="allocationMethod" value={params.allocationMethod} onChange={handleChange} className="w-full text-sm font-bold border-gray-200 rounded-xl focus:ring-purple-500">
                        <option>Proporcional</option>
                        <option>Óptima (Neyman)</option>
                        <option>Igualitaria</option>
                    </select>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-lg border-t-4 border-t-emerald-500">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-4">
                        Umbral Certeza ($)
                        <span className="ml-2"><InfoHelper title={ASSISTANT_CONTENT.umbralCerteza.title} content={ASSISTANT_CONTENT.umbralCerteza.content} /></span>
                    </label>
                    <input type="number" name="certaintyStratumThreshold" value={params.certaintyStratumThreshold} onChange={handleChange} className="w-full text-sm font-bold border-gray-200 rounded-xl focus:ring-emerald-500" />
                </div>
            </div>

            {/* Parámetros Estadísticos Adicionales para Análisis de Dispersión */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                    <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                        Nivel de Confianza (%)
                        <span className="ml-2"><InfoHelper title={ASSISTANT_CONTENT.nivelConfianza.title} content={ASSISTANT_CONTENT.nivelConfianza.content} /></span>
                    </label>
                    <select
                        name="NC"
                        value={params.NC}
                        onChange={handleChange}
                        className="w-full bg-white border-none text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    >
                        <option value={90}>90% (Riesgo 10%)</option>
                        <option value={95}>95% (Riesgo 5%)</option>
                        <option value={99}>99% (Riesgo 1%)</option>
                    </select>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                    <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                        Error Tolerable (ET %)
                        <span className="ml-2"><InfoHelper title={ASSISTANT_CONTENT.desviacionTolerable.title} content={ASSISTANT_CONTENT.desviacionTolerable.content} /></span>
                    </label>
                    <input
                        type="number"
                        name="ET"
                        value={params.ET}
                        onChange={handleChange}
                        step="0.1"
                        className="w-full bg-white border-none text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                    <label className="flex items-center text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                        Error Esperado (PE %)
                        <span className="ml-2"><InfoHelper title={ASSISTANT_CONTENT.desviacionEsperada.title} content={ASSISTANT_CONTENT.desviacionEsperada.content} /></span>
                    </label>
                    <input
                        type="number"
                        name="PE"
                        value={params.PE}
                        onChange={handleChange}
                        step="0.1"
                        className="w-full bg-white border-none text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                </div>
            </div>
        </div>
    );
};

export default StratifiedSampling;
