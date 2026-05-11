
import React from 'react';
import { SamplingMethod, AuditPopulation, AppView } from '../../types';
import { SamplingMethodCard, MethodConfig } from './SamplingMethodCard';

interface Props {
    onMethodSelect: (method: SamplingMethod) => void;
    population: AuditPopulation;
    onNavigate: (view: AppView) => void;
}

const methods: MethodConfig[] = [
    {
        id: SamplingMethod.Attribute,
        title: 'Muestreo de Atributos',
        description: 'Ideal para pruebas de controles y estimar tasas de desviación.',
        icon: 'fa-check-circle',
        colors: {
            bg: 'bg-sky-600',
            hoverBg: 'hover:bg-sky-700',
            iconBg: 'bg-sky-500',
            iconText: 'text-white',
            titleText: 'text-white',
            descriptionText: 'text-sky-200',
            linkText: 'text-sky-100'
        }
    },
    {
        id: SamplingMethod.MUS,
        title: 'Unidad Monetaria (MUS)',
        description: 'Utilizado para pruebas sustantivas para estimar el error monetario.',
        icon: 'fa-dollar-sign',
        colors: {
            bg: 'bg-amber-500',
            hoverBg: 'hover:bg-amber-600',
            iconBg: 'bg-amber-400',
            iconText: 'text-white',
            titleText: 'text-white',
            descriptionText: 'text-amber-200',
            linkText: 'text-amber-100'
        }
    },
    {
        id: SamplingMethod.Stratified,
        title: 'Muestreo Estratificado',
        description: 'Divide la población en subgrupos homogéneos para eficiencia.',
        icon: 'fa-layer-group',
        colors: {
            bg: 'bg-violet-700',
            hoverBg: 'hover:bg-violet-800',
            iconBg: 'bg-violet-600',
            iconText: 'text-white',
            titleText: 'text-white',
            descriptionText: 'text-violet-100',
            linkText: 'text-violet-50'
        }
    },
    {
        id: SamplingMethod.CAV,
        title: 'Variables Clásicas (CAV)',
        description: 'Estima el valor monetario total mediante distribución normal.',
        icon: 'fa-calculator',
        colors: {
            bg: 'bg-orange-500',
            hoverBg: 'hover:bg-orange-600',
            iconBg: 'bg-orange-400',
            iconText: 'text-white',
            titleText: 'text-white',
            descriptionText: 'text-orange-200',
            linkText: 'text-orange-100'
        }
    },
    {
        id: SamplingMethod.NonStatistical,
        title: 'No Estadístico / de Juicio',
        description: 'Para insights cualitativos, basado en la experiencia del auditor.',
        icon: 'fa-user-check',
        colors: {
            bg: 'bg-teal-500',
            hoverBg: 'hover:bg-teal-600',
            iconBg: 'bg-teal-400',
            iconText: 'text-white',
            titleText: 'text-white',
            descriptionText: 'text-teal-200',
            linkText: 'text-teal-100'
        }
    },
];

const Dashboard: React.FC<Props> = ({ onMethodSelect, population, onNavigate }) => {
    const recommendation = population.ai_recommendation;
    const recommendedMethodConfig = recommendation
        ? methods.find(m => m.id === recommendation.recommendedMethod)
        : null;

    return (
        <div className="animate-fade-in">
            {/* Header / Population Summary */}
            <div className="mb-8 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition-all relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-50 -mr-16 -mt-16"></div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-black text-slate-800">Población Activa: <span className="text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 ml-2">{population.file_name}</span></h3>
                        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 mt-3 font-bold uppercase tracking-wider">
                            <span className="flex items-center"><i className="fas fa-list-ol mr-2 text-blue-400"></i>{(population.total_rows || 0).toLocaleString()} Registros</span>
                            <span className="flex items-center"><i className="fas fa-coins mr-2 text-amber-400"></i>${(population.total_monetary_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Total</span>
                        </div>
                    </div>
                    <button
                        onClick={() => onNavigate('population_manager')}
                        className="px-8 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:bg-blue-800 hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center group shadow-xl"
                    >
                        <div className="bg-white/10 p-2 rounded-lg mr-3 group-hover:rotate-180 transition-transform duration-500">
                            <i className="fas fa-exchange-alt text-cyan-400"></i>
                        </div>
                        Cambiar Población
                    </button>
                </div>
            </div>

            {/* AI Recommendation Card */}
            {recommendation && recommendedMethodConfig && (
                <div className="mb-10 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 rounded-xl p-1 shadow-xl transform transition-all hover:scale-[1.01]">
                    <div className="bg-slate-900 rounded-lg p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse"></div>
                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            <div className="col-span-1 md:col-span-2">
                                <div className="flex items-center mb-3">
                                    <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/50 rounded text-purple-300 text-[10px] font-bold uppercase tracking-wider mr-3">
                                        <i className="fas fa-brain mr-1"></i> AAMA AI Engine
                                    </span>
                                    <h4 className="text-white font-bold text-lg">Recomendación Inteligente</h4>
                                </div>
                                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 mb-4">
                                    {recommendedMethodConfig.title}
                                </h2>
                                <div className="space-y-2">
                                    {recommendation.reasoning.map((reason, idx) => (
                                        <div key={idx} className="flex items-start">
                                            <i className="fas fa-check-circle text-purple-400 mt-1 mr-2 text-sm"></i>
                                            <p className="text-slate-300 text-sm leading-relaxed">{reason}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="col-span-1 flex flex-col items-center justify-center p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                                <div className="text-center mb-4">
                                    <span className="block text-4xl font-black text-white">{recommendation.confidenceScore}%</span>
                                    <span className="text-xs text-slate-400 uppercase tracking-widest">Score de Confianza</span>
                                </div>
                                <button
                                    onClick={() => onMethodSelect(recommendation.recommendedMethod)}
                                    className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-lg shadow-lg shadow-purple-900/50 transition-all flex items-center justify-center group"
                                >
                                    Aplicar Recomendación
                                    <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">
                    Panel de Control de Muestreo
                    <span className="ml-3 text-lg font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-lg border-2 border-emerald-500">[v2.5 DEPLOYED ✓]</span>
                </h2>
                <p className="text-slate-500 text-lg">Seleccione un método estadístico para iniciar su prueba de auditoría.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {methods.map(method => (
                    <SamplingMethodCard
                        key={method.id}
                        method={method}
                        onClick={onMethodSelect}
                        isRecommended={recommendation?.recommendedMethod === method.id}
                    />
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
