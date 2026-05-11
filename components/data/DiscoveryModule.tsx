import React, { useState, useEffect } from 'react';
import { ForensicTest, ColumnMapping } from '../../types';
import { scanHeadersAndSuggestTests } from '../../services/discoveryService';
import { supabase } from '../../services/supabaseClient';
import Modal from '../ui/Modal';
import { ASSISTANT_CONTENT } from '../../constants';

interface Props {
    populationId: string;
    onComplete: (mapping: ColumnMapping, activeTests: string[]) => void;
}

type DiscoveryStage = 'depth_selector' | 'analyzing' | 'diagnostic' | 'mapping';

const DiscoveryModule: React.FC<Props> = (props) => {
    const populationId = props.populationId;
    const onComplete = props.onComplete;

    const [stage, setStage] = useState<DiscoveryStage>('depth_selector');
    const [headers, setHeaders] = useState<string[]>([]);
    const [tests, setTests] = useState<ForensicTest[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>({ uniqueId: '', monetaryValue: '', category: '', subcategory: '' });
    const [loadingTask, setLoadingTask] = useState<string>('Iniciando motores...');
    const [currentProgress, setCurrentProgress] = useState(0); // Nuevo estado para el progreso
    const [helpContent, setHelpContent] = useState<{ title: string; content: React.ReactNode } | null>(null);
    const [certified, setCertified] = useState(false);

    const tasks = [
        "Escaneando semántica de cabeceras...",
        "Detectando variables monetarias...",
        "Correlacionando categorías de riesgo...",
        "Configurando algoritmos forenses...",
        "Finalizando diagnóstico IA..."
    ];

    useEffect(function () {
        // Fix: In browser environments, setInterval and setTimeout return a number.
        let taskInterval: number;
        // Fix: In browser environments, setInterval and setTimeout return a number.
        let progressInterval: number;

        if (stage === 'analyzing') {
            setCurrentProgress(0); // Reset progress on entering stage
            let i = 0;
            taskInterval = setInterval(function () {
                setLoadingTask(tasks[i % tasks.length]);
                i++;
            }, 3000) as any; // Update task description every 3 seconds

            let currentP = 0;
            const totalVisualDuration = 15000; // Total simulation time for progress bar in ms
            const updateInterval = 150; // Update progress every 150ms
            const increment = (100 / (totalVisualDuration / updateInterval)); // Calculate increment per step

            progressInterval = setInterval(() => {
                currentP += increment;
                if (currentP >= 100) {
                    currentP = 100;
                    clearInterval(progressInterval);
                }
                // Cap at 99 to simulate "finalizing" state before moving to next stage
                setCurrentProgress(Math.min(99, Math.round(currentP)));
            }, updateInterval) as any;

        }
        return function () {
            clearInterval(taskInterval);
            clearInterval(progressInterval);
        };
    }, [stage]);

    const initDiscovery = async function (isDeep: boolean) {
        setStage('analyzing');
        setLoadingTask("Iniciando Escaneo Forense...");

        try {
            // FIREWALL EVASION: Use Vercel Proxy
            const res = await fetch(`/api/get_validation_data?id=${populationId}`);
            if (!res.ok) throw new Error("Error fetching discovery data via Proxy");

            const data = await res.json();
            const rows = data.rows ? data.rows.slice(0, 5) : [];

            if (rows && rows.length > 0) {
                const headList = Object.keys(rows[0].raw_json || {});
                const sampleList = rows.map((r: any) => r.raw_json);
                setHeaders(headList);

                setLoadingTask(isDeep ? "Analizando Patrones de Datos con el Motor de Análisis Inteligente..." : "Mapeando Cabeceras con el Motor de Análisis Inteligente...");

                const analysis = await scanHeadersAndSuggestTests(headList, isDeep, sampleList);

                setTests(analysis.suggestedTests);
                // Pre-poblar el mapeo con lo que sugirió la IA
                setMapping(function (prev) { return Object.assign({}, prev, analysis.suggestedMapping); });

                setLoadingTask("Generando estrategia de auditoría...");
                setTimeout(function () { setStage('diagnostic'); }, 1000);
            } else {
                throw new Error("Población sin registros detectada.");
            }
        } catch (e: any) {
            console.error("Discovery Error:", e);
            setLoadingTask("Error en análisis. Reintentando...");
            setTimeout(() => {
                setStage('diagnostic'); // Force diagnostic even on partial error to avoid loop
                setCurrentProgress(100);
            }, 1000);
        }
    };

    const toggleTest = function (id: string) {
        setTests(function (prev) {
            return prev.map(function (t) {
                return t.id === id ? Object.assign({}, t, { active: !t.active }) : t;
            });
        });
    };

    const handleMappingChange = function (key: keyof ColumnMapping, value: string) {
        setMapping(function (prev) {
            const n = Object.assign({}, prev);
            (n as any)[key] = value;
            return n;
        });
    };

    const activeTests = tests.filter(function (t) { return t.active; });

    // Identificar qué columnas requiere cada prueba para informar al usuario
    const columnRequirements: Record<string, string[]> = {};
    activeTests.forEach(test => {
        test.requiredColumns.forEach(col => {
            if (!columnRequirements[col]) columnRequirements[col] = [];
            columnRequirements[col].push(test.name);
        });
    });

    const keyIcons: Record<string, string> = {
        uniqueId: 'fa-fingerprint',
        monetaryValue: 'fa-dollar-sign',
        date: 'fa-calendar-alt',
        user: 'fa-user-shield',
        vendor: 'fa-truck',
        category: 'fa-tags',
        subcategory: 'fa-tag',
        timestamp: 'fa-clock'
    };

    // Las llaves base ahora son dinámicas. UniqueId siempre es obligatorio.
    // monetaryValue solo si las pruebas activas lo piden.
    const baseKeys: (keyof ColumnMapping)[] = ['uniqueId'];
    if (Object.keys(columnRequirements).includes('monetaryValue')) {
        baseKeys.push('monetaryValue');
    }

    // Solo exigimos lo que las pruebas activas requieren + uniqueId
    const requiredMappingKeys = Array.from(new Set(baseKeys.concat(Object.keys(columnRequirements) as (keyof ColumnMapping)[]))) as (keyof ColumnMapping)[];

    const getHelpContent = (key: string) => {
        const map: Record<string, any> = {
            uniqueId: ASSISTANT_CONTENT.mappingUniqueId,
            monetaryValue: ASSISTANT_CONTENT.mappingMonetary,
            category: ASSISTANT_CONTENT.mappingCategory,
            subcategory: ASSISTANT_CONTENT.mappingSubcategory,
            date: ASSISTANT_CONTENT.mappingDate,
            user: ASSISTANT_CONTENT.mappingUser,
            vendor: ASSISTANT_CONTENT.mappingVendor,
            timestamp: ASSISTANT_CONTENT.mappingTimestamp
        };
        return map[key] || null;
    };

    const missingFields = requiredMappingKeys.filter(k => !(mapping as any)[k]);
    const isMappingReady = missingFields.length === 0;

    if (stage === 'depth_selector') return (
        <div className="animate-fade-in-up max-w-4xl mx-auto space-y-8 py-10">
            <div className="text-center mb-12">
                <div className="h-20 w-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                    <i className="fas fa-brain text-white text-3xl"></i>
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Inteligencia Forense</h2>
                <p className="text-slate-500 font-medium mt-2">¿Cómo deseas que el Motor de Análisis Inteligente analice tu base de datos?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <button
                    onClick={function () { initDiscovery(false); }}
                    className="group bg-white p-10 rounded-[3rem] border-2 border-slate-100 hover:border-indigo-400 hover:shadow-2xl transition-all text-left relative overflow-hidden"
                >
                    <div className="h-14 w-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-8 group-hover:bg-indigo-600 group-hover:text-white">
                        <i className="fas fa-bolt"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase mb-2">Escaneo Básico</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Mapeo Semántico y sugerencias rápidas.</p>
                </button>

                <button
                    onClick={function () { initDiscovery(true); }}
                    className="group bg-slate-900 p-10 rounded-[3rem] border-2 border-slate-800 hover:border-cyan-400 hover:shadow-2xl transition-all text-left relative overflow-hidden"
                >
                    <div className="h-14 w-14 bg-white/5 rounded-2xl flex items-center justify-center text-cyan-400 mb-8 group-hover:bg-cyan-400 group-hover:text-slate-900">
                        <i className="fas fa-dna"></i>
                    </div>
                    <h3 className="text-xl font-black text-white uppercase mb-2">Escaneo Forense</h3>
                    <p className="text-xs text-cyan-400 font-black uppercase tracking-widest">Análisis Profundo con el Motor de Análisis Inteligente.</p>
                </button>
            </div>
        </div>
    );

    if (stage === 'analyzing') return (
        <div className="flex flex-col items-center justify-center py-40 animate-fade-in">
            <div className="w-full max-w-lg text-center">
                <div className="h-28 w-28 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-10 animate-pulse border-4 border-indigo-100 shadow-xl">
                    <i className="fas fa-microchip text-5xl animate-spin-slow"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-4">{loadingTask}</h3>
                <p className="text-slate-400 mb-12 text-xs font-bold uppercase tracking-widest italic">AAMA v6.0 / Motor de Análisis Inteligente</p>

                <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner border border-slate-200">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300 shadow-lg"
                        style={{ width: `${currentProgress}%` }}
                    ></div>
                </div>
                <p className="mt-6 text-[11px] font-black text-indigo-600 tracking-widest">{currentProgress}% COMPROBADO</p>
            </div>
        </div>
    );

    if (stage === 'diagnostic') return (
        <div className="animate-fade-in space-y-10">
            <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl">
                <h2 className="text-4xl font-black uppercase mb-4">Estrategia Forense</h2>
                <p className="text-slate-400 font-medium">Selecciona las pruebas recomendadas por la IA para este set de datos.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tests.map(function (test) {
                    return (
                        <div
                            key={test.id}
                            onClick={function () { toggleTest(test.id); }}
                            className={"group cursor-pointer p-8 rounded-[2.5rem] border-2 transition-all " + (test.active ? 'bg-indigo-600 border-indigo-400 shadow-2xl' : 'bg-white border-slate-100')}
                        >
                            <h5 className={"text-lg font-black uppercase " + (test.active ? 'text-white' : 'text-slate-800')}>{test.name}</h5>
                            <p className={"text-[11px] mt-2 " + (test.active ? 'text-indigo-100' : 'text-slate-400')}>{test.aiRecommendation || test.description}</p>
                            {test.requiredColumns.length > 0 && (
                                <div className={"mt-4 text-[9px] font-black uppercase tracking-widest " + (test.active ? 'text-indigo-200' : 'text-slate-300')}>
                                    Requiere: {test.requiredColumns.join(', ')}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-center gap-6">
                <button
                    onClick={function () { setStage('depth_selector'); }}
                    className="px-12 py-6 bg-white border border-slate-200 text-slate-400 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em]"
                >
                    Reiniciar
                </button>
                <button
                    onClick={function () { setStage('mapping'); }}
                    className="px-20 py-6 bg-slate-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.3em]"
                >
                    Configurar Mapeo Maestro
                </button>
            </div>
        </div>
    );

    return (
        <div className="animate-fade-in space-y-10 pb-40">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Mapeo de Variables</h2>
                    <p className="text-slate-500 font-medium mt-2">Asocia las columnas de tu archivo con los campos de auditoría.</p>
                </div>
                <button
                    onClick={function () { setStage('diagnostic'); }}
                    className="px-8 py-4 bg-slate-50 border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-indigo-600"
                >
                    <i className="fas fa-edit mr-2"></i> Ajustar Pruebas
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm space-y-8">
                    <div className="grid grid-cols-1 gap-6">
                        {requiredMappingKeys.map(function (key) {
                            const isCore = key === 'uniqueId';
                            const reqs = columnRequirements[key] || [];
                            const isMapped = !!(mapping as any)[key];
                            const icon = keyIcons[key] || 'fa-database';

                            return (
                                <div key={key} className={"group p-6 rounded-[2.5rem] border-2 transition-all " + (isMapped ? 'bg-slate-50 border-indigo-200 ring-4 ring-indigo-500/5' : 'bg-white border-slate-100 hover:border-indigo-100')}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className={"w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 " + (isMapped ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400')}>
                                                <i className={"fas " + icon + (isMapped ? " text-lg" : " text-sm")}></i>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-800 tracking-widest">{key}</label>
                                                    <button onClick={() => setHelpContent(getHelpContent(key))} className="text-slate-300 hover:text-indigo-600 transition-colors">
                                                        <i className="fas fa-info-circle text-[10px]"></i>
                                                    </button>
                                                </div>
                                                {!isCore ? (
                                                    <p className="text-[9px] font-bold text-indigo-400 uppercase mt-1">
                                                        {reqs.length > 0 ? `Uso en: ${reqs.join(', ')}` : 'Atributo Descriptivo'}
                                                    </p>
                                                ) : (
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Requerido Base</p>
                                                )}
                                            </div>
                                        </div>
                                        {isMapped && <i className="fas fa-check-circle text-emerald-500 text-lg"></i>}
                                    </div>
                                    <select
                                        value={(mapping as any)[key] || ''}
                                        onChange={function (e) { handleMappingChange(key, e.target.value); }}
                                        className="w-full bg-transparent border-0 focus:ring-0 text-sm font-bold text-slate-700 p-0 pl-2 cursor-pointer"
                                    >
                                        <option value="">-- Vincular Columna --</option>
                                        {headers.map(function (h) { return <option key={h} value={h}>{h}</option>; })}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-indigo-900 rounded-[3rem] p-12 text-white shadow-2xl">
                        <h4 className="text-xl font-black uppercase mb-6 tracking-widest flex items-center gap-4">
                            Validación de Mapeo
                            <i className="fas fa-shield-check text-cyan-400"></i>
                        </h4>

                        <div className="space-y-4 mb-10">
                            {requiredMappingKeys.map(function (key) {
                                const isMapped = !!(mapping as any)[key];
                                return (
                                    <div key={key} className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-indigo-300 uppercase">{key}</span>
                                        <span className={isMapped ? 'text-emerald-400' : 'text-rose-400'}>
                                            {isMapped ? 'MAPEADO' : 'PENDIENTE'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {!isMappingReady ? (
                            <div className="bg-rose-500/20 border border-rose-500/50 p-6 rounded-2xl mb-8">
                                <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                                    <i className="fas fa-exclamation-triangle mr-2"></i>
                                    Atención: Debes mapear los campos requeridos por las pruebas activas o desactivar las pruebas que no tengan columnas en tu archivo.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-emerald-500/20 border border-emerald-500/50 p-6 rounded-2xl mb-8">
                                <p className="text-[10px] font-black uppercase tracking-widest">
                                    <i className="fas fa-check-double mr-2"></i>
                                    Estructura completa. Listo para escaneo maestro.
                                </p>
                            </div>
                        )}

                        <div className="flex items-start gap-4 mb-10 p-6 bg-white/5 rounded-[2rem] border border-white/10 cursor-pointer group hover:bg-white/[0.08] transition-all" onClick={() => setCertified(!certified)}>
                            <div className={`mt-0.5 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${certified ? 'bg-cyan-500 border-cyan-500' : 'border-white/20 group-hover:border-white/40'}`}>
                                {certified && <i className="fas fa-check text-[10px] text-white"></i>}
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white">Certificar Mapeo de Datos</p>
                                <p className="text-[9px] font-medium text-indigo-200/60 mt-1 leading-relaxed">
                                    Confirmo que las columnas vinculadas son correctas. Entiendo que un error aquí anula la validez técnica de la auditoría.
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={function () { onComplete(mapping, activeTests.map(function (t) { return t.id; })); }}
                            disabled={!isMappingReady || !certified}
                            className="w-full py-7 bg-white text-indigo-900 rounded-3xl font-black text-sm uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                            Confirmar Escaneo Maestro
                        </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-[3rem] p-10">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Pruebas que se ejecutarán</h5>
                        <div className="flex flex-wrap gap-3">
                            {activeTests.map(function (t) {
                                return (
                                    <span key={t.id} className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-slate-500">
                                        {t.name}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={!!helpContent} onClose={() => setHelpContent(null)} title={helpContent?.title || ''}>
                {helpContent?.content}
            </Modal>
        </div>
    );
};

export default DiscoveryModule;
