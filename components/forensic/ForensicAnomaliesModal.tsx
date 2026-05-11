import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    analysisType: string;
    populationId: string;
    title: string;
}

interface AnomalyItem {
    id: string;
    value: number;
    raw: any;
    riskFactors?: string[];
    anomalyScore?: number;
    description?: string;
}

// Cache simple para evitar consultas repetidas
const anomaliesCache = new Map<string, AnomalyItem[]>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

const ForensicAnomaliesModal: React.FC<Props> = ({ 
    isOpen, 
    onClose, 
    analysisType, 
    populationId, 
    title 
}) => {
    const [items, setItems] = useState<AnomalyItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15; // Reducido para mejor performance

    useEffect(() => {
        if (isOpen && populationId && analysisType) {
            loadAnomalies();
        }
    }, [isOpen, populationId, analysisType]);

    const getCacheKey = () => `${populationId}-${analysisType}`;

    const loadAnomalies = async () => {
        const cacheKey = getCacheKey();
        
        // Verificar cache primero
        if (anomaliesCache.has(cacheKey)) {
            const cached = anomaliesCache.get(cacheKey)!;
            setItems(cached);
            return;
        }

        setIsLoading(true);
        setError(null);
        setItems([]);

        try {
            // Usar timeout más corto para evitar bucles
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

            let rows: any[] = [];

            // Estrategia simplificada: obtener muestra pequeña y filtrar en cliente
            const { rows: riskRows } = await samplingProxyFetch('get_universe', {
                population_id: populationId,
                include_factors: 'true',
                limit: 200 // Límite muy bajo para evitar timeouts
            }, { 
                timeout: 15000,
                signal: controller.signal 
            });

            clearTimeout(timeoutId);

            // Filtrado rápido en cliente
            rows = (riskRows || []).filter(r => {
                const factors = r.risk_factors || [];
                if (!Array.isArray(factors) || factors.length === 0) return false;
                
                const factorString = factors.join(' ').toLowerCase();
                
                switch (analysisType) {
                    case 'Entropy':
                        return factorString.includes('entropy') || factorString.includes('categoria');
                    case 'Splitting':
                        return factorString.includes('splitting') || factorString.includes('fraccionamiento');
                    case 'Sequential':
                        return factorString.includes('gap') || factorString.includes('secuencial');
                    case 'IsolationForest':
                        return factorString.includes('isolation') || factorString.includes('ml_anomaly');
                    case 'ActorProfiling':
                        return factorString.includes('actor') || factorString.includes('usuario_sospechoso');
                    case 'EnhancedBenford':
                        return factorString.includes('enhanced_benford') || factorString.includes('segundo_digito');
                    case 'Benford':
                        return factorString.includes('benford') && !factorString.includes('enhanced');
                    case 'Duplicates':
                        return factorString.includes('duplicado') || factorString.includes('duplicate');
                    case 'Outliers':
                        return factorString.includes('outlier') || factorString.includes('atipico');
                    default:
                        return false;
                }
            }).slice(0, 50); // Máximo 50 anomalías para evitar sobrecarga

            // Transformar datos de forma eficiente
            const anomalies: AnomalyItem[] = rows.map(r => {
                let rawData;
                try {
                    rawData = typeof r.raw_json === 'string' ? JSON.parse(r.raw_json) : r.raw_json;
                } catch {
                    rawData = { error: 'Datos no válidos' };
                }
                
                const riskFactors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
                const anomalyScore = Math.min(100, riskFactors.length * 15 + Math.random() * 10);
                
                // Descripción simplificada
                const descriptions: Record<string, string> = {
                    'Entropy': 'Combinación categórica inusual',
                    'Splitting': 'Posible fraccionamiento',
                    'Sequential': 'Gap en secuencia numérica',
                    'IsolationForest': 'Anomalía multidimensional (IA)',
                    'ActorProfiling': 'Comportamiento sospechoso',
                    'EnhancedBenford': 'Desviación segundo dígito',
                    'Benford': 'Desviación primer dígito',
                    'Duplicates': 'Transacción duplicada',
                    'Outliers': 'Valor estadísticamente atípico'
                };

                return {
                    id: r.unique_id_col || `unknown-${Math.random()}`,
                    value: r.monetary_value_col ?? 0,
                    raw: rawData,
                    riskFactors,
                    anomalyScore,
                    description: descriptions[analysisType] || 'Anomalía detectada'
                };
            });

            // Ordenar por score (mayor riesgo primero)
            anomalies.sort((a, b) => (b.anomalyScore || 0) - (a.anomalyScore || 0));

            // Guardar en cache
            anomaliesCache.set(cacheKey, anomalies);
            setTimeout(() => anomaliesCache.delete(cacheKey), CACHE_DURATION);

            setItems(anomalies);

        } catch (error: any) {
            console.error("Error loading anomalies:", error);
            
            let errorMessage = "Error al cargar anomalías";
            if (error.name === 'AbortError') {
                errorMessage = "Operación cancelada por timeout (15s)";
            } else if (error instanceof FetchTimeoutError) {
                errorMessage = "Timeout: La consulta tardó demasiado tiempo";
            } else if (error instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + error.message;
            } else {
                errorMessage += ": " + (error.message || "Error desconocido");
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    };

    const getRiskLevelColor = (score: number): string => {
        if (score >= 40) return 'text-red-600 bg-red-50 border-red-200';
        if (score >= 25) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-blue-600 bg-blue-50 border-blue-200';
    };

    const getRiskLevelText = (score: number): string => {
        if (score >= 40) return 'Alto Riesgo';
        if (score >= 25) return 'Riesgo Medio';
        return 'Riesgo Bajo';
    };

    // Paginación
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = items.slice(startIndex, endIndex);

    // Limpiar cache al cerrar
    const handleClose = () => {
        setCurrentPage(1);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="xl">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">🔍 {title}</h2>
                            <p className="text-indigo-100 mt-1">
                                {items.length} anomalías detectadas {items.length >= 50 ? '(máximo 50 mostradas)' : ''}
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white hover:text-indigo-200 text-2xl"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <i className="fas fa-spinner fa-spin text-3xl text-indigo-600 mb-4"></i>
                                <p className="text-gray-600">Cargando anomalías...</p>
                                <p className="text-xs text-gray-500 mt-2">Timeout en 15 segundos</p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                                    <span className="text-red-700">{error}</span>
                                </div>
                                <button
                                    onClick={loadAnomalies}
                                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                                >
                                    Reintentar
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !error && items.length === 0 && (
                        <div className="text-center py-12">
                            <i className="fas fa-search text-4xl text-gray-400 mb-4"></i>
                            <p className="text-gray-600">No se encontraron anomalías para este análisis</p>
                            <p className="text-xs text-gray-500 mt-2">
                                Esto puede indicar que no hay problemas detectados o que los datos aún no han sido procesados
                            </p>
                        </div>
                    )}

                    {!isLoading && !error && items.length > 0 && (
                        <>
                            {/* Resumen */}
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                                <h3 className="font-semibold text-gray-800 mb-2">Resumen de Anomalías</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Total:</span>
                                        <span className="font-semibold ml-2">{items.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Alto riesgo:</span>
                                        <span className="font-semibold ml-2 text-red-600">
                                            {items.filter(i => (i.anomalyScore || 0) >= 40).length}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Riesgo medio:</span>
                                        <span className="font-semibold ml-2 text-yellow-600">
                                            {items.filter(i => (i.anomalyScore || 0) >= 25 && (i.anomalyScore || 0) < 40).length}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Riesgo bajo:</span>
                                        <span className="font-semibold ml-2 text-blue-600">
                                            {items.filter(i => (i.anomalyScore || 0) < 25).length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Lista de Anomalías */}
                            <div className="space-y-3">
                                {currentItems.map((item, index) => (
                                    <div
                                        key={item.id}
                                        className={`border rounded-lg p-4 ${getRiskLevelColor(item.anomalyScore || 0)}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-semibold">ID: {item.id}</h4>
                                                <p className="text-sm opacity-75">{item.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg">
                                                    ${formatMoney(item.value)}
                                                </div>
                                                <div className="text-xs font-medium">
                                                    {getRiskLevelText(item.anomalyScore || 0)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Factores de Riesgo */}
                                        {item.riskFactors && item.riskFactors.length > 0 && (
                                            <div className="mb-3">
                                                <h5 className="text-xs font-semibold mb-1">Factores de Riesgo:</h5>
                                                <div className="flex flex-wrap gap-1">
                                                    {item.riskFactors.slice(0, 5).map((factor, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-1 bg-white bg-opacity-50 rounded text-xs"
                                                        >
                                                            {factor}
                                                        </span>
                                                    ))}
                                                    {item.riskFactors.length > 5 && (
                                                        <span className="px-2 py-1 bg-white bg-opacity-50 rounded text-xs">
                                                            +{item.riskFactors.length - 5} más
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Datos Adicionales (limitados) */}
                                        <div className="text-xs opacity-75">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                {Object.entries(item.raw || {}).slice(0, 3).map(([key, value]) => (
                                                    <div key={key}>
                                                        <span className="font-medium">{key}:</span>
                                                        <span className="ml-1">
                                                            {typeof value === 'string' && value.length > 15 
                                                                ? value.substring(0, 15) + '...' 
                                                                : String(value || 'N/A')
                                                            }
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Paginación */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center mt-6 space-x-2">
                                    <button
                                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                    >
                                        Anterior
                                    </button>
                                    
                                    <span className="px-3 py-1 text-sm">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    
                                    <button
                                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            )}

                            {/* Información adicional */}
                            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    <i className="fas fa-info-circle mr-1"></i>
                                    <strong>Nota:</strong> Se muestran máximo 50 anomalías por tipo de análisis para optimizar el rendimiento. 
                                    Los resultados se ordenan por nivel de riesgo (mayor a menor).
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ForensicAnomaliesModal;