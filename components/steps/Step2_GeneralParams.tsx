
import React from 'react';
import { AppState, Step } from '../../types';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    setCurrentStep: (step: Step) => void;
}

const Step2GeneralParams: React.FC<Props> = ({ appState, setAppState, setCurrentStep }) => {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setAppState(prev => ({
            ...prev,
            generalParams: { 
                ...prev.generalParams, 
                [name]: name === 'seed' ? Number(value) : value 
            }
        }));
    };

    const handleNext = () => setCurrentStep(Step.SamplingMethod);
    const handleBack = () => setCurrentStep(Step.Connection);

    return (
        <div className="animate-fade-in max-w-6xl mx-auto space-y-8">
            {/* SECCIÓN 1: PARÁMETROS GENERALES DE LA AUDITORÍA */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 bg-white border-b border-slate-100">
                    <h3 className="text-slate-700 font-bold text-sm tracking-tight">Parámetros Generales de la Auditoría</h3>
                </div>
                
                <div className="p-8 space-y-8">
                    {/* Objetivo Específico */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Objetivo Específico del Muestreo</label>
                        <textarea 
                            name="objective" 
                            value={appState.generalParams.objective} 
                            onChange={handleChange} 
                            rows={3} 
                            className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all text-slate-700 font-medium placeholder-slate-300 shadow-sm"
                            placeholder="Ej. Verificar la validez de las transacciones de venta superiores a $1,000 (prueba sustantiva)."
                        />
                    </div>

                    {/* Fila de Controles */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Estándar de Referencia</label>
                            <select 
                                name="standard" 
                                value={appState.generalParams.standard} 
                                onChange={handleChange}
                                className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm"
                            >
                                <option value="NIA 530">NIA 530</option>
                                <option value="AICPA">AICPA AU-C 530</option>
                                <option value="COSO">COSO Framework</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Plantilla de Documentación</label>
                            <select 
                                name="template" 
                                value={appState.generalParams.template} 
                                onChange={handleChange}
                                className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm"
                            >
                                <option value="NIA 530 Detalle">NIA 530 Detalle</option>
                                <option value="Resumen Ejecutivo">Resumen Ejecutivo</option>
                                <option value="Memorando Técnico">Memorando Técnico</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
                                Semilla (Seed) <i className="fas fa-info-circle text-blue-400 ml-1"></i>
                            </label>
                            <input 
                                type="number" 
                                name="seed" 
                                value={appState.generalParams.seed} 
                                onChange={handleChange}
                                className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* BOTONES DE NAVEGACIÓN */}
            <div className="flex justify-between items-center bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                <button 
                    onClick={handleBack} 
                    className="px-8 py-3 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-100"
                >
                    <i className="fas fa-chevron-left mr-3"></i> Conexión
                </button>
                <button 
                    onClick={handleNext} 
                    className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all transform hover:-translate-y-1"
                >
                    Seleccionar Método <i className="fas fa-arrow-right ml-3 text-cyan-400"></i>
                </button>
            </div>
        </div>
    );
};

export default Step2GeneralParams;
