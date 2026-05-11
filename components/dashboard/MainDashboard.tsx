import React, { useEffect, useState } from 'react';
import { useAuth } from '../../services/AuthContext';
import { AppView, AuditPopulation } from '../../types';
import { supabase } from '../../services/supabaseClient';
import Modal from '../ui/Modal';

interface MainDashboardProps {
    userName: string;
    onNavigate: (view: AppView) => void;
    onLoadPopulation: (id: string) => void;
}

type KpiType = 'proyectos' | 'hallazgos' | 'monto' | 'fraude';

interface KpiDetailItem {
    id: string;
    projectName: string;
    area: string;
    mainMetric: string;
    secondaryMetric: string;
    status: string;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ userName, onNavigate, onLoadPopulation }) => {
    const { user } = useAuth(); // Hook de autenticación
    const [recentProjects, setRecentProjects] = useState<AuditPopulation[]>([]);
    const [loading, setLoading] = useState(true);

    // Restaurando estados perdidos
    const [stats, setStats] = useState({
        proyectosFinalizados: 0,
        proyectosEnProceso: 0,
        totalHallazgos: 0,
        montoObservado: 0,
        alertasFraude: 0
    });

    const [allProjects, setAllProjects] = useState<AuditPopulation[]>([]);
    const [allResults, setAllResults] = useState<any[]>([]);
    const [selectedKpi, setSelectedKpi] = useState<KpiType | null>(null);
    const [modalTab, setModalTab] = useState<'info' | 'list'>('info');

    // Función auxiliar para normalizar estados legacy y actuales
    const normalizeStatus = (status: string) => {
        const s = status?.toUpperCase();
        if (s === 'FINALIZADO' || s === 'ARCHIVADO') return 'FINALIZADO';
        // Cualquier otro estado se considera 'EN PROGRESO' para el contador del dashboard
        return 'EN PROGRESO';
    };

    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!user) {
                console.warn("⚠️ MainDashboard: Usuario no identificado. Esperando sesión...");
                setLoading(false);
                return;
            }

            if (!isMounted) return;
            setLoading(true);
            setLoadError(null);

            const timeout = setTimeout(() => {
                if (isMounted && loading) {
                    console.warn("⚠️ Dashboard: Fetch timeout reached.");
                    setLoading(false);
                    setLoadError("Tiempo de espera agotado. Intente recargar.");
                }
            }, 12000);

            try {
                let popData = [];
                let resultsData = [];

                // ATTEMPT 1: PROXY (Preferred)
                try {
                    const popRes = await fetch('/api/sampling_proxy?action=get_populations');
                    if (!popRes.ok) throw new Error(`Proxy Populations Failed (${popRes.status})`);
                    const { populations } = await popRes.json();
                    popData = populations || [];

                    const resultsRes = await fetch('/api/sampling_proxy?action=get_all_results');
                    if (!resultsRes.ok) throw new Error(`Proxy Results Failed (${resultsRes.status})`);
                    const { results } = await resultsRes.json();
                    resultsData = results || [];

                } catch (proxyError) {
                    console.warn("⚠️ Proxy Fail/Localhost detected. Switching to Direct Supabase...", proxyError);

                    // ATTEMPT 2: DIRECT SUPABASE (Fallback)
                    const { data: directPop, error: popErr } = await supabase
                        .from('audit_populations')
                        .select('*')
                        .order('created_at', { ascending: false });
                    if (popErr) throw popErr;
                    popData = directPop || [];

                    const { data: directRes, error: resErr } = await supabase
                        .from('audit_results')
                        .select('results_json, population_id');
                    if (resErr) throw resErr;
                    resultsData = directRes || [];
                }

                if (isMounted) {
                    setAllProjects(popData);
                    setRecentProjects(popData.slice(0, 5));

                    let completed = 0;
                    let inProgress = 0;
                    popData.forEach((p: any) => {
                        if (normalizeStatus(p.status) === 'FINALIZADO') completed++;
                        else inProgress++;
                    });

                    const fraudAlerts = popData.reduce((acc: number, p: any) => {
                        return acc + (p.advanced_analysis?.outliersCount || 0);
                    }, 0);

                    let findingsCount = 0;
                    let observedSum = 0;

                    if (resultsData) {
                        setAllResults(resultsData);
                        resultsData.forEach((res: any) => {
                            const json = res.results_json as any;
                            if (json) {
                                if (Array.isArray(json.findings)) findingsCount += json.findings.length;
                                if (json.totalErrorProjection > 0) observedSum += json.totalErrorProjection;
                            }
                        });
                    }

                    setStats({
                        proyectosFinalizados: completed,
                        proyectosEnProceso: inProgress,
                        totalHallazgos: findingsCount,
                        montoObservado: observedSum,
                        alertasFraude: fraudAlerts
                    });
                }
            } catch (error: any) {
                console.error("💥 Dashboard: Fallo crítico en fetch:", error);
                if (isMounted) setLoadError(error.message || "Error de conexión");
            } finally {
                if (isMounted) {
                    clearTimeout(timeout);
                    setLoading(false);
                }
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [user, refreshTrigger]); // Refresh trigger re-runs fetch

    // ... (rest of component) ...

    const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("¿Está seguro de eliminar este proyecto permanentemente?")) return;

        try {
            const { error } = await supabase
                .from('audit_populations')
                .delete()
                .eq('id', projectId);

            if (error) throw error;

            console.log("✅ Proyecto eliminado:", projectId);
            setRecentProjects(prev => prev.filter(p => p.id !== projectId));
            setAllProjects(prev => prev.filter(p => p.id !== projectId));

            // Recalcular estadísticas básicas localmente para feedback inmediato
            setStats(prev => ({
                ...prev,
                proyectosEnProceso: Math.max(0, prev.proyectosEnProceso - 1)
            }));

        } catch (err: any) {
            console.error("❌ Error al eliminar proyecto:", err.message);
            alert("No se pudo eliminar el proyecto. Verifique sus permisos.");
        }
    };

    const getKpiContent = (type: KpiType) => {
        const content = {
            proyectos: {
                title: 'Estado de Proyectos',
                icon: 'fa-diagram-project',
                color: 'indigo',
                explanation: 'Métrica de gestión operativa. Compara proyectos con dictamen final emitido (FINALIZADO/ARCHIVADO) vs proyectos activos en cualquier etapa de carga o análisis.',
                details: allProjects.map(p => ({
                    id: p.id,
                    projectName: p.audit_name || p.file_name,
                    area: p.area || 'GENERAL',
                    mainMetric: p.status, // Mostramos el estado real
                    secondaryMetric: new Date(p.created_at).toLocaleDateString(),
                    status: normalizeStatus(p.status)
                }))
            },
            hallazgos: {
                title: 'Hallazgos Totales',
                icon: 'fa-file-circle-exclamation',
                color: 'emerald',
                explanation: 'Consolidado de excepciones detectadas en las muestras. Se extrae directamente de la base de datos de resultados (audit_results), contando cada hallazgo documentado bajo metodología NIA 530.',
                details: allResults.map(res => {
                    const project = allProjects.find(p => p.id === res.population_id);
                    const json = res.results_json as any;
                    return {
                        id: res.population_id,
                        projectName: project?.audit_name || 'Proyecto Desconocido',
                        area: project?.area || 'N/A',
                        mainMetric: `${json?.findings?.length || 0} Hallazgos`,
                        secondaryMetric: json?.method || 'Cualitativo',
                        status: 'INFO'
                    };
                }).filter(i => i.mainMetric !== '0 Hallazgos')
            },
            monto: {
                title: 'Monto Observado',
                icon: 'fa-sack-dollar',
                color: 'amber',
                explanation: 'Valorización del riesgo monetario. Suma las proyecciones de error calculadas estadísticamente en cada informe de resultados. Representa el impacto potencial en la población total.',
                details: allResults.map(res => {
                    const project = allProjects.find(p => p.id === res.population_id);
                    const json = res.results_json as any;
                    return {
                        id: res.population_id,
                        projectName: project?.audit_name || 'Proyecto Desconocido',
                        area: project?.area || 'N/A',
                        mainMetric: json?.totalErrorProjection ? `$${json.totalErrorProjection.toLocaleString()}` : '$0',
                        secondaryMetric: 'Proyección de Error',
                        status: 'MONEY'
                    };
                }).filter(i => i.mainMetric !== '$0')
            },
            fraude: {
                title: 'Alertas de Fraude',
                icon: 'fa-mask',
                color: 'rose',
                explanation: 'Detección proactiva de anomalías. Este contador suma los registros atípicos (outliers) identificados durante el análisis de integridad inicial de cada base de datos cargada.',
                details: allProjects.map(p => ({
                    id: p.id,
                    projectName: p.audit_name || p.file_name,
                    area: p.area || 'GENERAL',
                    mainMetric: `${p.advanced_analysis?.outliersCount || 0} Alertas`,
                    secondaryMetric: 'Técnica: Outliers',
                    status: 'FRAUD'
                })).filter(i => i.mainMetric !== '0 Alertas')
            }
        };
        return content[type];
    };

    const kpis = [
        { id: 'proyectos' as KpiType, label: 'Estado de Proyectos', value: `${stats.proyectosFinalizados} / ${stats.proyectosEnProceso + stats.proyectosFinalizados}`, sub: `${stats.proyectosEnProceso} en ejecución`, icon: 'fa-diagram-project', color: 'indigo' },
        { id: 'hallazgos' as KpiType, label: 'Hallazgos Totales', value: stats.totalHallazgos.toString(), sub: 'Consolidado NIA 530', icon: 'fa-file-circle-exclamation', color: 'emerald' },
        { id: 'monto' as KpiType, label: 'Monto Observado', value: stats.montoObservado > 1000000 ? `${(stats.montoObservado / 1000000).toFixed(1)} M` : stats.montoObservado.toLocaleString(), sub: 'Impacto proyectado', icon: 'fa-sack-dollar', color: 'amber' },
        { id: 'fraude' as KpiType, label: 'Alertas de Fraude', value: stats.alertasFraude.toString(), sub: 'Anomalías detectadas', icon: 'fa-mask', color: 'rose' },
    ];



    const getStatusBtnColor = (status: string) => {
        const s = normalizeStatus(status);
        if (s === 'FINALIZADO') return 'emerald';
        return 'blue';
    };

    return (
        <div className="animate-fade-in p-8 space-y-10 max-w-[1600px] mx-auto">
            {/* HERO SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                        Bienvenido de nuevo, <span className="text-indigo-600">{userName}</span>.
                    </h2>
                    <p className="text-slate-500 font-medium flex items-center gap-2">
                        Tu equipo de auditoría ha detectado <span className="text-indigo-600 font-extrabold">{stats.totalHallazgos} hallazgos</span> en el ciclo actual.
                        {loading && <i className="fas fa-circle-notch fa-spin text-indigo-400"></i>}
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                        className="px-4 py-4 bg-white text-slate-400 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-2"
                        title="Recargar Datos"
                    >
                        <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                    </button>
                    <button onClick={() => onNavigate('data_upload')} className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-3">
                        <i className="fas fa-plus text-sm"></i> Nuevo Proyecto
                    </button>
                    <button onClick={() => onNavigate('population_manager')} className="px-6 py-4 bg-slate-900 text-cyan-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-3">
                        <i className="fas fa-bolt text-sm"></i> Muestreo Rápido
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {loadError && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3 text-rose-600">
                        <i className="fas fa-exclamation-circle text-xl"></i>
                        <span className="text-xs font-bold uppercase tracking-wide">{loadError}</span>
                    </div>
                    <button
                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                        className="px-4 py-2 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            )}

            {/* ZONA B: KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map((kpi) => (
                    <div
                        key={kpi.id}
                        onClick={() => { setSelectedKpi(kpi.id); setModalTab('info'); }}
                        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-2xl bg-${kpi.color}-50 flex items-center justify-center text-${kpi.color}-600 group-hover:bg-${kpi.color}-600 group-hover:text-white transition-all`}>
                                <i className={`fas ${kpi.icon} text-lg`}></i>
                            </div>
                            <i className="fas fa-arrow-up-right text-[10px] text-slate-300"></i>
                        </div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{kpi.label}</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900 tracking-tight">{kpi.value}</span>
                            <span className="text-[9px] font-bold text-slate-500 underline decoration-slate-200 underline-offset-4">{kpi.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="w-full">
                {/* PANEL: PROYECTOS RECIENTES */}
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                            <i className="fas fa-clock-rotate-left text-indigo-500"></i> Proyectos Recientes
                        </h3>
                        <button onClick={() => onNavigate('population_manager')} className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest">Ver todos</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre de Auditoría</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Área</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Archivo Base</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Actualización</th>
                                    <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                    <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <i className="fas fa-circle-notch fa-spin text-2xl text-indigo-600"></i>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Proyectos...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : recentProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <i className="fas fa-folder-open text-3xl text-slate-200"></i>
                                                <p className="text-xs text-slate-400 font-bold">No hay proyectos registrados aún.</p>
                                                <button onClick={() => onNavigate('data_upload')} className="mt-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Iniciar Primera Carga</button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : recentProjects.map(project => (
                                    <tr key={project.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-black text-indigo-900 truncate max-w-xs">{project.audit_name || 'SIN NOMBRE'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-tight">{project.area || 'GENERAL'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs text-slate-400 font-medium truncate max-w-[150px] italic">{project.file_name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs text-slate-500 font-medium">{new Date(project.created_at).toLocaleDateString()}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full bg-${getStatusBtnColor(project.status)}-500 shadow-sm ${normalizeStatus(project.status) === 'EN PROGRESO' ? 'animate-pulse' : ''}`}></div>
                                                <span className={`text-[10px] font-black text-${getStatusBtnColor(project.status)}-600 uppercase`}>{project.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => handleDeleteProject(project.id, e)}
                                                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm group-hover:opacity-100 opacity-0 group-hover:translate-x-0 -translate-x-2"
                                                    title="Eliminar Proyecto"
                                                >
                                                    <i className="fas fa-trash-alt text-[10px]"></i>
                                                </button>
                                                <button onClick={() => onLoadPopulation(project.id)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                                    <i className="fas fa-chevron-right text-[10px]"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* MODAL DE DETALLE KPI */}
            {selectedKpi && (() => {
                const kpi = getKpiContent(selectedKpi);
                return (
                    <Modal
                        isOpen={true}
                        onClose={() => setSelectedKpi(null)}
                        title={`${kpi.title}`}
                    >
                        <div className="space-y-6">
                            {/* Tabs */}
                            <div className="flex border-b border-slate-100">
                                <button
                                    onClick={() => setModalTab('info')}
                                    className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${modalTab === 'info' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Explicación
                                </button>
                                <button
                                    onClick={() => setModalTab('list')}
                                    className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${modalTab === 'list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    Detalle del Cálculo
                                </button>
                            </div>

                            {modalTab === 'info' ? (
                                <div className="p-4 space-y-6 animate-fade-in-up">
                                    <div className={`p-6 bg-${kpi.color}-50 rounded-3xl border border-${kpi.color}-100 flex gap-6 items-center`}>
                                        <div className={`w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-${kpi.color}-600 shadow-sm`}>
                                            <i className={`fas ${kpi.icon} text-3xl`}></i>
                                        </div>
                                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                                            "{kpi.explanation}"
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Metodológico</h4>
                                            <p className="text-xs font-bold text-slate-700">Asegura el cumplimiento de normativas locales e internacionales.</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Muestreo Aplicado</h4>
                                            <p className="text-xs font-bold text-slate-700">NIA 530, MUS, CAV y Atributos.</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 animate-fade-in-up">
                                    <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                        <div className="space-y-3">
                                            {kpi.details.length === 0 ? (
                                                <div className="text-center py-10 text-slate-400">
                                                    <i className="fas fa-inbox text-2xl mb-2"></i>
                                                    <p className="text-xs font-bold">Sin datos para mostrar en este KPI.</p>
                                                </div>
                                            ) : kpi.details.map((item, idx) => (
                                                <div key={idx} className="bg-white border border-slate-100 p-4 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                                            <i className="fas fa-file-invoice text-sm"></i>
                                                        </div>
                                                        <div>
                                                            <h5 className="text-sm font-black text-slate-800 leading-tight">{item.projectName}</h5>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{item.area} <span className="mx-1">•</span> {item.secondaryMetric}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-xs font-black uppercase ${item.status === 'FINALIZADO' ? 'text-emerald-600' : 'text-indigo-600'}`}>{item.mainMetric}</p>
                                                        <button
                                                            onClick={() => onLoadPopulation(item.id)}
                                                            className="text-[9px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest mt-1"
                                                        >
                                                            Abrir Análisis
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal>
                );
            })()}
        </div>
    );
};

export default MainDashboard;
