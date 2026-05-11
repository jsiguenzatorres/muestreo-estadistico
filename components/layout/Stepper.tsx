import React from 'react';
import { AppState, AppView } from '../../types';

interface StepperProps {
    currentView: AppView;
    appState: AppState;
}

const Stepper: React.FC<StepperProps> = ({ currentView, appState }) => {
    // Iconos actualizados "Premium Auditor" con mayor carga simbólica
    const steps = [
        { name: 'Integridad de Datos', id: 0, icon: 'fa-shield-halved', subtitle: 'Validación & Mapeo' },
        { name: 'Perfilado Forense', id: 1, icon: 'fa-fingerprint', subtitle: 'Riesgos & EDA' },
        { name: 'Diseño de Muestreo', id: 2, icon: 'fa-compass-drafting', subtitle: 'Planificación NIA 530' },
        { name: 'Ejecución Técnica', id: 3, icon: 'fa-microscope', subtitle: 'Revisión de Evidencia' },
        { name: 'Dictamen & Cierre', id: 4, icon: 'fa-file-signature', subtitle: 'Inferencia Final' },
    ];

    const getViewIndex = (view: AppView) => {
        if (view === 'data_upload' || view === 'validation_workspace' || view === 'discovery_analysis') return 0;
        if (view === 'risk_profiling') return 1;
        if (view === 'dashboard' || view === 'sampling_config') return 2;
        if (view === 'results') {
            const isApproved = appState.results?.findings?.[0]?.isApproved;
            return isApproved ? 4 : 3;
        }
        return 0;
    };

    const currentIndex = getViewIndex(currentView);

    return (
        <div className="w-full max-w-7xl mx-auto py-10 px-6">
            <div className="flex items-start justify-between relative isolate">

                {steps.map((step, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isPending = index > currentIndex;
                    const isLast = index === steps.length - 1;

                    let colorClass = '';
                    let iconBgClass = '';
                    let iconColorClass = '';
                    let badgeClass = '';
                    let statusText = '';
                    let cardBorderClass = '';

                    if (isCompleted) {
                        colorClass = 'text-emerald-700';
                        iconBgClass = 'bg-white border-2 border-emerald-500/30';
                        iconColorClass = 'text-emerald-600';
                        badgeClass = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                        statusText = 'COMPLETADO';
                        cardBorderClass = 'border-b-emerald-400';
                    } else if (isCurrent) {
                        colorClass = 'text-indigo-700';
                        iconBgClass = 'bg-white border-[3px] border-indigo-600 shadow-indigo-100 ring-8 ring-indigo-50/50';
                        iconColorClass = 'text-indigo-600';
                        badgeClass = 'bg-indigo-50 border-indigo-200 text-indigo-700';
                        statusText = 'EN PROCESO';
                        cardBorderClass = 'border-b-indigo-500';
                    } else {
                        colorClass = 'text-slate-400';
                        iconBgClass = 'bg-white border border-slate-200/50';
                        iconColorClass = 'text-slate-300';
                        badgeClass = 'bg-slate-50 border-slate-200 text-slate-400';
                        statusText = 'PENDIENTE';
                        cardBorderClass = 'border-b-slate-100';
                    }

                    return (
                        <div key={step.id} className="relative flex-1 flex flex-col items-center">

                            {!isLast && (
                                <div className="hidden md:block absolute top-8 left-1/2 w-full h-1 z-0">
                                    <div className="relative w-full h-full flex items-center">
                                        <div className={`
                                            w-full h-[3px] transform transition-all duration-1000
                                            ${isCompleted
                                                ? 'bg-emerald-400'
                                                : isCurrent
                                                    ? 'bg-gradient-to-r from-indigo-500 to-slate-100'
                                                    : 'bg-slate-100'
                                            }
                                        `}></div>

                                        <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-10 
                                            ${isCompleted ? 'text-emerald-400' : 'text-slate-100'}
                                        `}>
                                            <i className="fas fa-chevron-right text-[8px]"></i>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CONTENEDOR DEL ICONO */}
                            <div className={`
                                w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-700 z-10 relative
                                ${iconBgClass} shadow-md
                                ${isCurrent ? 'scale-115 -translate-y-2' : isCompleted ? 'opacity-80' : 'opacity-60'}
                            `}>
                                {/* ICONO ORIGINAL (Siempre visible) */}
                                <i className={`fas ${step.icon} text-2xl ${iconColorClass}`}></i>

                                {/* BADGE DE FINALIZADO (Discreto) */}
                                {isCompleted && (
                                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg animate-bounce-in">
                                        <i className="fas fa-check text-[10px] text-white"></i>
                                    </div>
                                )}

                                {/* INDICADOR DE "EN PROCESO" */}
                                {isCurrent && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border border-white animate-pulse"></div>
                                )}
                            </div>

                            {/* TARJETA DE TEXTO */}
                            <div className={`
                                relative bg-white rounded-2xl p-4 w-[90%] flex flex-col items-center 
                                border border-slate-100 shadow-sm transition-all duration-500 z-10
                                ${isCurrent ? 'bg-gradient-to-b from-white to-indigo-50/30 ring-1 ring-indigo-100 shadow-indigo-100/50' : 'opacity-80'}
                            `}>
                                <h3 className={`text-[10px] font-black uppercase tracking-widest text-center mb-1 ${colorClass}`}>
                                    {step.name}
                                </h3>
                                <p className={`text-[9px] font-bold text-slate-400 text-center mb-3 line-clamp-1`}>
                                    {isCompleted ? 'Validado con éxito' : step.subtitle}
                                </p>

                                <div className={`
                                    px-3 py-1 rounded-full text-[8px] font-black border uppercase tracking-[0.1em]
                                    ${badgeClass}
                                `}>
                                    {isCompleted ? (
                                        <span className="flex items-center gap-1">
                                            <i className="fas fa-check-circle"></i> OK
                                        </span>
                                    ) : statusText}
                                </div>

                                <div className={`absolute bottom-0 left-6 right-6 h-[4px] rounded-t-full ${cardBorderClass}`}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Stepper;
