
import React, { useState, useCallback } from 'react';
import { read, utils, WorkSheet } from 'xlsx';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../services/AuthContext'; // Re-added for current DB requirements
import { ColumnMapping, DescriptiveStats, AdvancedAnalysis, BenfordAnalysis } from '../../types';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
// import { analyzePopulationAndRecommend } from '../../services/recommendationService'; // Commented out to reduce dependencies risks
import { ASSISTANT_CONTENT } from '../../constants';

interface Props {
    onComplete: (populationId: string) => void;
    onCancel: () => void;
}

// Agregamos 'create_population' al flujo
type Stage = 'select_file' | 'map_columns' | 'preview' | 'create_population' | 'uploading' | 'error';
type DataRow = { [key: string]: string | number };

const DataUploadFlow: React.FC<Props> = ({ onComplete, onCancel }) => {
    const { user } = useAuth(); // Re-added
    const [stage, setStage] = useState<Stage>('select_file');
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<DataRow[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>({ uniqueId: '', monetaryValue: '', category: '', subcategory: '', user: '', vendor: '', date: '', timestamp: '' });
    const [hasMonetaryCols, setHasMonetaryCols] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [populationName, setPopulationName] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0); // 0 to 100
    const [helpContent, setHelpContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

    // LOGGER SYSTEM (Minimal version restoration for debugging functionality without overhead)
    const [logs, setLogs] = useState<string[]>([]);
    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
        console.log(msg);
    };


    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            try {
                const buffer = await selectedFile.arrayBuffer();
                const workbook = read(buffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = utils.sheet_to_json<DataRow>(worksheet, { defval: null });
                const fileHeaders = Object.keys(jsonData[0]);
                setHeaders(fileHeaders);
                setData(jsonData);
                setStage('map_columns');
            } catch (err: any) {
                setError(`Error: ${err.message}`);
                setStage('error');
            }
        }
    };

    const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
        setMapping(prev => ({ ...prev, [field]: value }));
    };

    const validateMapping = () => {
        if (!mapping.uniqueId) return "Debe seleccionar una columna para el ID Único.";
        if (hasMonetaryCols && !mapping.monetaryValue) return "Debe seleccionar una columna para el Valor Monetario.";
        // NUEVO: Si no hay dinero, OBLIGAR a elegir Categoría para tener qué contar
        if (!hasMonetaryCols && !mapping.category) return "Para cargas sin montos, DEBE seleccionar una columna de Categoría para generar estadísticas.";
        return null;
    };

    const handleUpload = async () => {
        addLog("🚀 INICIANDO UPLOAD (Restored Logic)...");
        if (!file) return;
        const validationError = validateMapping();
        if (validationError) {
            setError(validationError);
            return;
        }

        if (!user || !user.id) {
            setError("Error de sesión: Usuario no identificado.");
            setStage('error');
            return;
        }

        setStage('uploading');
        setError(null);
        setUploadProgress(0);

        try {
            // 1. Crear registro de Población
            // Helper para parsear moneda
            const parseMoney = (val: any): number => {
                if (typeof val === 'number') return val;
                if (!val) return 0;
                // Eliminar todo excepto números, puntos y menos (soporte básico)
                const str = String(val).replace(/[^0-9.-]+/g, "");
                return parseFloat(str) || 0;
            };

            // Calcular Total Monetario y Estadísticas PREVIO a la inserción
            let totalMonetaryValue = 0;
            let descriptiveStats: DescriptiveStats = { min: 0, max: 0, sum: 0, avg: 0, std_dev: 0, cv: 0 };

            if (hasMonetaryCols && mapping.monetaryValue) {
                // Extraer valores válidos
                const values = data.map(row => parseMoney(row[mapping.monetaryValue!]));
                const validValues = values.filter(v => !isNaN(v)); // Asegurar que no haya NaNs

                if (validValues.length > 0) {
                    totalMonetaryValue = validValues.reduce((a, b) => a + b, 0);
                    const min = Math.min(...validValues);
                    const max = Math.max(...validValues);
                    const avg = totalMonetaryValue / validValues.length;

                    // Calcular Desviación Estándar (Std Dev)
                    const squareDiffs = validValues.map(value => Math.pow(value - avg, 2));
                    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / validValues.length;
                    const stdDev = Math.sqrt(avgSquareDiff);

                    descriptiveStats = {
                        min,
                        max,
                        sum: totalMonetaryValue,
                        avg,
                        std_dev: stdDev,
                        cv: avg !== 0 ? stdDev / avg : 0
                    };
                }
            }

            addLog("📊 Estadísticas calculadas.");

            // 1. Preparar datos para enviar al backend
            addLog("🚀 Creando población vía backend proxy...");

            const popPayload = {
                file_name: populationName || file.name,
                audit_name: populationName || file.name.split('.')[0],
                area: 'GENERAL',
                status: 'pendiente_validacion',
                upload_timestamp: new Date().toISOString(),
                total_rows: data.length,
                total_monetary_value: totalMonetaryValue,
                descriptive_stats: descriptiveStats,
                column_mapping: mapping
            };

            const dataRows = data.map(row => ({
                unique_id_col: String(row[mapping.uniqueId]),
                monetary_value_col: hasMonetaryCols && mapping.monetaryValue ? parseMoney(row[mapping.monetaryValue]) : 0,
                category_col: mapping.category ? String(row[mapping.category]) : null,
                subcategory_col: mapping.subcategory ? String(row[mapping.subcategory]) : null,
                raw_json: row
            }));

            addLog(`📦 Enviando ${dataRows.length} filas al backend...`);

            // 2. Llamar al backend proxy que usa service_role
            const response = await fetch('/api/sampling_proxy?action=create_population', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    population: popPayload,
                    data_rows: dataRows,
                    user_id: user.id
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            const populationId = result.population_id;

            addLog(`✅ Población creada (ID: ${populationId})`);
            addLog(`✅ ${result.inserted_rows} filas insertadas`);

            // 3. Completar con progreso del 100%
            setUploadProgress(100);
            addLog("✅ Carga Completada vía Backend Proxy.");

            //4. Finalizar
            onComplete(populationId);

        } catch (err: any) {
            console.error("Upload error:", err);
            addLog(`❌ ERROR: ${err.message}`);
            setError("Error al subir los datos: " + err.message);
            setStage('error');
        }
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold gradient-text">Carga de Población</h2>
                <button onClick={onCancel} className="text-sm text-slate-400 hover:text-white">Cancelar</button>
            </div>

            <Card className="border-t-4 border-t-slate-900">
                {stage === 'select_file' && (
                    <div className="text-center p-12">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
                            <i className="fas fa-file-excel text-5xl text-slate-300"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Seleccione su Origen de Datos</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">Soporta Excel (.xlsx) y CSV. Asegúrese de incluir encabezados en la primera fila.</p>

                        <div className="mb-6 flex justify-center gap-4">
                            <button
                                onClick={async () => {
                                    try {
                                        addLog("📡 Probando Conectividad Proxy...");
                                        // @ts-ignore
                                        const url = `${window.location.origin}/supaproxy/auth/v1/health`;
                                        const t0 = performance.now();
                                        const res = await fetch(url);
                                        const t1 = performance.now();
                                        addLog(`📡 Status: ${res.status} (${(t1 - t0).toFixed(0)}ms)`);
                                        const txt = await res.text();
                                        addLog(`📡 Response: ${txt.substring(0, 100)}...`);
                                        if (!res.ok) alert(`Error Proxy: ${res.status}`);
                                        else alert("¡Conexión Exitosa! El Proxy funciona.");
                                    } catch (e: any) {
                                        addLog(`❌ Error Conectividad: ${e.message}`);
                                        alert("Fallo de Conexión: " + e.message);
                                    }
                                }}
                                className="px-4 py-2 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200"
                            >
                                📡 Probar Conexión (Ping)
                            </button>
                        </div>

                        <input type="file" id="file-upload" className="hidden" accept=".xlsx, .csv" onChange={handleFileChange} />
                        <label
                            htmlFor="file-upload"
                            className="cursor-pointer inline-flex items-center px-8 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:bg-slate-800 transition-all transform hover:-translate-y-1"
                        >
                            <i className="fas fa-search mr-2 text-cyan-400"></i> Buscar Archivo
                        </label>
                    </div>
                )}

                {stage === 'map_columns' && (
                    <div className="p-8 animate-fade-in-up">
                        {/* Simplified Mapping UI from Old Version */}
                        <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Mapeo de Estructura</h3>
                                <p className="text-sm text-slate-500">Vincule las columnas de su archivo.</p>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <input type="checkbox" checked={hasMonetaryCols} onChange={() => setHasMonetaryCols(!hasMonetaryCols)} />
                                    Tiene columnas de dinero
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">ID Único *</label>
                                <select className="w-full p-2 border rounded" value={mapping.uniqueId} onChange={(e) => handleMappingChange('uniqueId', e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>

                            {hasMonetaryCols && (
                                <div className="p-4 bg-slate-50 rounded-lg">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Valor Monetario *</label>
                                    <select className="w-full p-2 border rounded" value={mapping.monetaryValue} onChange={(e) => handleMappingChange('monetaryValue', e.target.value)}>
                                        <option value="">Seleccionar...</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {['category', 'subcategory', 'user', 'vendor', 'date'].map(field => (
                                <div key={field} className="p-3 border rounded">
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{field}</label>
                                    <select className="w-full p-1 text-sm bg-white"
                                        // @ts-ignore
                                        value={mapping[field] || ''}
                                        // @ts-ignore
                                        onChange={(e) => handleMappingChange(field, e.target.value)}>
                                        <option value="">(Opcional)</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 flex justify-between items-center border-t border-slate-100 pt-8">
                            <button onClick={onCancel} className="text-slate-500">Cancelar</button>
                            <button
                                onClick={() => {
                                    const err = validateMapping();
                                    if (err) { setError(err); setStage('error'); }
                                    else { setError(null); setStage('create_population'); }
                                }}
                                className="px-8 py-3 bg-slate-900 text-white rounded-lg font-bold shadow-lg"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}

                {stage === 'create_population' && (
                    <div className="p-8 max-w-lg mx-auto">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Confirmar Carga</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Nombre de la Auditoría</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border rounded-lg"
                                    placeholder={file?.name || "Ej. Auditoría 2024Q1"}
                                    value={populationName}
                                    onChange={(e) => setPopulationName(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleUpload}
                                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg"
                            >
                                Iniciar Carga Real
                            </button>
                            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                        </div>
                    </div>
                )}

                {stage === 'uploading' && (
                    <div className="relative min-h-[600px] bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-3xl overflow-hidden border border-slate-200 shadow-2xl">
                        {/* Header con icono y título */}
                        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 p-8 text-center">
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>

                            <div className="relative z-10">
                                {/* Icono animado */}
                                <div className="mb-6 flex justify-center">
                                    <div className="relative">
                                        <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center shadow-2xl border border-white/30">
                                            <div className="relative">
                                                <i className="fas fa-database text-4xl text-white animate-pulse"></i>
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
                                            </div>
                                        </div>
                                        {/* Anillos animados */}
                                        <div className="absolute inset-0 rounded-3xl border-2 border-white/30 animate-ping"></div>
                                        <div className="absolute inset-0 rounded-3xl border-2 border-white/20 animate-pulse"></div>
                                    </div>
                                </div>

                                {/* Título principal */}
                                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
                                    Procesando Población de Auditoría
                                </h2>
                                <p className="text-indigo-100 text-sm font-medium">
                                    {populationName || file?.name || 'Cargando datos...'}
                                </p>
                            </div>
                        </div>

                        {/* Contenido principal */}
                        <div className="p-8">
                            {/* Barra de progreso principal */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">Progreso General</span>
                                    <span className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                        {uploadProgress}%
                                    </span>
                                </div>
                                <div className="relative w-full bg-slate-200 rounded-full h-4 shadow-inner overflow-hidden">
                                    <div
                                        className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 h-full transition-all duration-500 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 animate-shimmer"></div>
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 text-center font-medium">
                                    {uploadProgress < 30 ? 'Validando estructura de datos...' :
                                        uploadProgress < 60 ? 'Procesando registros...' :
                                            uploadProgress < 90 ? 'Calculando estadísticas...' :
                                                'Finalizando carga...'}
                                </p>
                            </div>

                            {/* Panel de logs con diseño profesional */}
                            <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                            Registro de Actividad
                                        </span>
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono">
                                        {logs.length} evento{logs.length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                                    <div className="space-y-2">
                                        {logs.map((log, i) => {
                                            const isError = log.includes('❌') || log.includes('ERROR');
                                            const isSuccess = log.includes('✅') || log.includes('Completada');
                                            const isWarning = log.includes('⚠️') || log.includes('Reintentando');
                                            const isInfo = log.includes('📊') || log.includes('🚀') || log.includes('💾');

                                            return (
                                                <div
                                                    key={i}
                                                    className={`group flex items-start gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] ${isError ? 'bg-red-500/10 border border-red-500/20' :
                                                        isSuccess ? 'bg-emerald-500/10 border border-emerald-500/20' :
                                                            isWarning ? 'bg-yellow-500/10 border border-yellow-500/20' :
                                                                isInfo ? 'bg-blue-500/10 border border-blue-500/20' :
                                                                    'bg-slate-800/50 border border-slate-700/50'
                                                        }`}
                                                >
                                                    {/* Número de línea */}
                                                    <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isError ? 'bg-red-500/20 text-red-400' :
                                                        isSuccess ? 'bg-emerald-500/20 text-emerald-400' :
                                                            isWarning ? 'bg-yellow-500/20 text-yellow-400' :
                                                                isInfo ? 'bg-blue-500/20 text-blue-400' :
                                                                    'bg-slate-700 text-slate-400'
                                                        }`}>
                                                        {String(i + 1).padStart(2, '0')}
                                                    </span>

                                                    {/* Contenido del log */}
                                                    <span className={`flex-1 text-sm font-mono leading-relaxed ${isError ? 'text-red-300' :
                                                        isSuccess ? 'text-emerald-300' :
                                                            isWarning ? 'text-yellow-300' :
                                                                isInfo ? 'text-blue-300' :
                                                                    'text-slate-300'
                                                        }`}>
                                                        {log}
                                                    </span>

                                                    {/* Indicador de estado */}
                                                    {isSuccess && (
                                                        <i className="fas fa-check-circle text-emerald-400 text-sm animate-bounce"></i>
                                                    )}
                                                    {isError && (
                                                        <i className="fas fa-exclamation-circle text-red-400 text-sm animate-pulse"></i>
                                                    )}
                                                    {isWarning && (
                                                        <i className="fas fa-exclamation-triangle text-yellow-400 text-sm animate-pulse"></i>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Footer con información adicional */}
                            <div className="mt-6 grid grid-cols-3 gap-4">
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <i className="fas fa-clock text-indigo-600 text-sm"></i>
                                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Tiempo</span>
                                    </div>
                                    <p className="text-sm text-indigo-700 font-medium">Procesando...</p>
                                </div>

                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <i className="fas fa-shield-alt text-emerald-600 text-sm"></i>
                                        <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Seguridad</span>
                                    </div>
                                    <p className="text-sm text-emerald-700 font-medium">Conexión cifrada</p>
                                </div>

                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <i className="fas fa-database text-purple-600 text-sm"></i>
                                        <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">Registros</span>
                                    </div>
                                    <p className="text-sm text-purple-700 font-medium">{data.length.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* Efecto de brillo animado */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/5 to-transparent pointer-events-none"></div>
                    </div>
                )}

                {stage === 'error' && (
                    <div className="p-8 text-center text-red-600">
                        <h3 className="font-bold text-xl">Error</h3>
                        <p>{error}</p>
                        <button onClick={() => setStage('select_file')} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded">Reintentar</button>
                    </div>
                )}
            </Card>

            <Modal isOpen={!!helpContent} onClose={() => setHelpContent(null)} title={helpContent?.title || ''}>
                {helpContent?.content}
            </Modal>
        </div>
    );
};

export default DataUploadFlow;
