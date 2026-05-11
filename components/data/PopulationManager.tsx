
import React, { useState, useEffect } from 'react';
import { AuditPopulation } from '../../types';
import { supabase } from '../../services/supabaseClient';
import Card from '../ui/Card';
import { useToast } from '../ui/ToastContext';
import Modal from '../ui/Modal';
import { useAuth } from '../../services/AuthContext';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';

interface Props {
    onPopulationSelected: (population: AuditPopulation) => void;
    onAddNew: () => void;
}

const PopulationManager: React.FC<Props> = ({ onPopulationSelected, onAddNew }) => {
    const { user, loading: authLoading } = useAuth();
    const [populations, setPopulations] = useState<AuditPopulation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, fileName: string } | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false); // Prevenir múltiples requests
    const { addToast } = useToast();

    useEffect(() => {
        if (authLoading) return;

        if (user && user.id) {
            fetchPopulations();
        } else {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, authLoading]); // USAMOS user.id (primitivo) PARA EVITAR LOOPS INFINITOS

    const fetchPopulations = async () => {
        // Prevenir múltiples requests simultáneos
        if (isRefreshing) {
            console.log("⚠️ Ya hay una consulta en progreso, ignorando...");
            return;
        }
        
        setIsRefreshing(true);
        setLoading(true);
        setError(null);
        
        try {
            console.log("🌐 Cargando poblaciones vía proxy...");
            
            const { populations: data } = await samplingProxyFetch('get_populations', {}, {
                timeout: 60000 // Timeout de 60 segundos para poblaciones
            });
            
            setPopulations(data || []);
            
        } catch (error: any) {
            console.error("Error fetching populations:", error);
            
            let errorMessage = "No se pudieron cargar los proyectos";
            
            if (error instanceof FetchTimeoutError) {
                errorMessage = "Timeout: La carga tardó más de 60 segundos. Intente nuevamente.";
            } else if (error instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + error.message;
            } else {
                errorMessage += ": " + (error.message || "Error desconocido");
            }
            
            setError(errorMessage);
            
            // Fallback: Intentar conexión directa como último recurso (solo si no es timeout)
            if (!(error instanceof FetchTimeoutError)) {
                console.warn("⚠️ Intentando fallback directo a Supabase...");
                try {
                    const { data, error: directError } = await supabase
                        .from('audit_populations')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(100); // Limitar para evitar sobrecarga

                    if (directError) throw directError;
                    
                    setPopulations(data as AuditPopulation[]);
                    setError(null); // Limpiar error si el fallback funciona
                    console.log("✅ Fallback directo exitoso");
                    
                } catch (directErr: any) {
                    console.error("❌ Fallback directo también falló:", directErr);
                    // Mantener el error original del proxy
                }
            }
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;
        const { id } = deleteConfirm;
        setDeleteConfirm(null);

        try {
            await samplingProxyFetch('delete_population', {
                population_id: id
            }, { 
                method: 'POST',
                timeout: 30000 // 30 segundos para eliminación
            });

            // Actualizar estado local eliminando el item
            setPopulations(prev => prev.filter(p => p.id !== id));
            addToast("Población eliminada correctamente", 'success');

        } catch (error: any) {
            console.error("Error deleting:", error);
            
            let errorMessage = "Error al eliminar el registro";
            
            if (error instanceof FetchTimeoutError) {
                errorMessage = "Timeout: La eliminación tardó más de 30 segundos";
            } else if (error instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + error.message;
            } else {
                errorMessage += ": " + (error.message || "Error desconocido");
            }
            
            addToast(errorMessage, 'error');
        }
    };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'validado':
                return <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wide">Validado</span>;
            case 'pendiente_validacion':
                return <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">Pendiente</span>;
            default:
                return <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-gray-100 text-gray-800 border border-gray-200 uppercase tracking-wide">{status}</span>;
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Gestor de Poblaciones</h2>
                    <p className="text-slate-500 mt-1 text-lg">Seleccione un universo de datos o cargue un nuevo archivo para auditar.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchPopulations}
                        disabled={isRefreshing}
                        className="p-3 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-indigo-600 hover:border-indigo-400 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Recargar Lista"
                    >
                        <i className={`fas fa-sync-alt ${(loading || isRefreshing) ? 'fa-spin' : ''}`}></i>
                    </button>
                    <button
                        onClick={onAddNew}
                        className="group relative inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 uppercase tracking-wide"
                    >
                        <i className="fas fa-cloud-upload-alt mr-2 text-lg group-hover:animate-bounce"></i>
                        Cargar Nueva Población
                    </button>
                </div>
            </div>

            <Card className="bg-white border-t-4 border-t-blue-500">
                {loading && (
                    <div className="flex justify-center items-center h-48">
                        <div className="flex flex-col items-center">
                            <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-4"></i>
                            <p className="text-slate-500 font-medium">Sincronizando datos...</p>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="p-6 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-start">
                            <i className="fas fa-exclamation-circle text-2xl text-red-500 mr-4 mt-1"></i>
                            <div className="flex-1">
                                <h3 className="text-red-800 font-bold text-sm mb-2">Error al cargar poblaciones</h3>
                                <p className="text-red-700 text-sm mb-4">{error}</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={fetchPopulations}
                                        className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-all"
                                    >
                                        <i className="fas fa-redo mr-2"></i>Reintentar
                                    </button>
                                    <button
                                        onClick={() => setError(null)}
                                        className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-all"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {!loading && !error && populations.length === 0 && (
                    <div className="text-center py-16 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                            <i className="fas fa-folder-open text-3xl text-slate-300"></i>
                        </div>
                        <h3 className="text-xl font-bold text-slate-700">No hay poblaciones disponibles</h3>
                        <p className="text-slate-500 mt-2 mb-6 max-w-sm mx-auto">Comience cargando un archivo Excel o CSV para realizar su primer muestreo.</p>
                        <button onClick={onAddNew} className="text-blue-600 font-bold hover:text-blue-800 hover:underline">
                            Cargar mi primer archivo
                        </button>
                    </div>
                )}
                {!loading && !error && populations.length > 0 && (
                    <div className="overflow-x-auto overflow-y-visible rounded-lg border border-slate-200 max-w-full">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Nombre de Auditoría</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap">Área</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Archivo Original</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Registros (N)</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Valor Total</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Fecha Carga</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Estado</th>
                                    <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {populations.map(pop => (
                                    <tr key={pop.id} className="hover:bg-blue-50/50 transition-colors duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-black text-indigo-900">{pop.audit_name || 'SIN NOMBRE'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase">{pop.area || 'GENERAL'}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-6 w-6 bg-slate-100 text-slate-400 rounded flex items-center justify-center mr-2">
                                                    <i className="fas fa-file-excel text-[10px]"></i>
                                                </div>
                                                <div className="text-[11px] font-medium text-slate-500 truncate max-w-[120px] italic">{pop.file_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{(pop.total_rows || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600 font-bold">${(pop.total_monetary_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(pop.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{getStatusChip(pop.status)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end items-center space-x-2">
                                                <button
                                                    onClick={() => setDeleteConfirm({ id: pop.id, fileName: pop.file_name })}
                                                    className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-xs font-bold text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all uppercase tracking-wider"
                                                    title="Eliminar Población"
                                                >
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>

                                                <button
                                                    onClick={() => onPopulationSelected(pop)}
                                                    disabled={pop.status !== 'validado'}
                                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
                                                >
                                                    Seleccionar
                                                    <i className="fas fa-chevron-right ml-2"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Modal de Confirmación de Eliminación */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Confirmar Eliminación"
            >
                <div className="p-2">
                    <div className="flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mx-auto mb-6">
                        <i className="fas fa-exclamation-triangle text-3xl text-red-600 animate-pulse"></i>
                    </div>

                    <div className="text-center space-y-4">
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">¿Eliminar permanentemente?</h3>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic font-medium text-slate-600 break-all">
                            "{deleteConfirm?.fileName}"
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Esta acción eliminará todos los registros de la base de datos, incluyendo el historial de muestreos y hallazgos asociados. <span className="text-red-600 font-bold block mt-2 px-4 py-1 bg-red-50 rounded-full text-[10px] uppercase tracking-widest inline-block">Esta acción es irreversible</span>
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-8">
                        <button
                            onClick={() => setDeleteConfirm(null)}
                            className="py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 hover:border-slate-300 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleDelete}
                            className="py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-200 uppercase text-[10px] tracking-widest transition-all transform hover:-translate-y-1 hover:bg-red-700"
                        >
                            <i className="fas fa-trash-alt mr-2"></i>
                            Eliminar Ahora
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PopulationManager;
