import React, { useState, useEffect } from 'react';
import { AuditPopulation, RiskProfile, AdvancedAnalysis } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { performRiskProfiling, parseCurrency } from '../../services/riskAnalysisService';
import { analyzePopulationAndRecommend } from '../../services/recommendationService'; // Import Recommendation Service
import { useToast } from '../ui/ToastContext';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { generateRiskAnalysisReport } from '../../services/riskAnalysisReportService';
import { useAnalysisCache } from '../../services/cacheService';
import { useLazyLoading, LazyLoadState } from '../../services/lazyLoadingService';
import { useBackgroundProcessing } from '../../services/backgroundProcessingService';
import { useMobileOptimization } from '../../services/mobileOptimizationService';
import { useOfflineSync } from '../../services/offlineSyncService';
import { useMobileReports } from '../../services/mobileReportService';
import MobileRiskChart from '../mobile/MobileRiskChart';
import html2canvas from 'html2canvas';

interface Props {
    population: AuditPopulation;
    onComplete: (updatedPop: AuditPopulation) => void;
}

const RiskProfiler: React.FC<Props> = ({ population, onComplete }) => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<RiskProfile | null>(null);
    const [scatterData, setScatterData] = useState<any[]>([]);
    const [insight, setInsight] = useState<string>('');
    // New state to hold analysis for recommendation
    const [analysisData, setAnalysisData] = useState<AdvancedAnalysis | null>(null);
    const [selectedPoint, setSelectedPoint] = useState<any>(null);
    const [showPointModal, setShowPointModal] = useState(false);
    const [visibleRiskLevels, setVisibleRiskLevels] = useState({
        high: true,
        medium: true,
        low: true
    });
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Estados para optimizaciones de rendimiento
    const [lazyLoadState, setLazyLoadState] = useState<LazyLoadState | null>(null);
    const [backgroundTasks, setBackgroundTasks] = useState<string[]>([]);
    const [showProgressNotification, setShowProgressNotification] = useState(false);
    const [progressMessage, setProgressMessage] = useState('');
    const [isUsingCache, setIsUsingCache] = useState(false);

    // Estados para optimizaciones móviles
    const [showMobilePreview, setShowMobilePreview] = useState(false);
    const [offlineStatus, setOfflineStatus] = useState<any>(null);

    const { addToast } = useToast();
    const cache = useAnalysisCache();
    const lazyLoader = useLazyLoading();
    const backgroundProcessor = useBackgroundProcessing();
    const { deviceInfo, isMobile, responsiveClasses, adaptiveUI, isOffline } = useMobileOptimization();
    const offlineSync = useOfflineSync();
    const mobileReports = useMobileReports();

    // Función para obtener información detallada de un punto
    const getPointDetails = (point: any) => {
        if (!point || !analysisData) return null;

        return {
            id: point.name || point.id,
            score: point.y?.toFixed(1) || '0.0',
            alerts: point.x || 0,
            value: point.value?.toLocaleString('es-ES', {
                style: 'currency',
                currency: 'USD'
            }) || '$0',
            riskLevel: point.y > 75 ? 'ALTO' : point.y > 40 ? 'MEDIO' : 'BAJO',
            riskColor: point.y > 75 ? '#f43f5e' : point.y > 40 ? '#f59e0b' : '#10b981',
            // Simular factores de riesgo basados en el score
            riskFactors: point.y > 75 ?
                ['Valor atípico detectado', 'Patrón Benford anómalo', 'Proveedor sospechoso'] :
                point.y > 40 ?
                    ['Valor moderadamente alto', 'Requiere revisión'] :
                    ['Transacción normal', 'Sin anomalías detectadas']
        };
    };

    // Tooltip personalizado
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const details = getPointDetails(data);

            if (!details) return null;

            return (
                <div className="bg-white p-4 rounded-xl shadow-2xl border border-slate-200 min-w-[280px]">
                    <div className="flex items-center gap-3 mb-3">
                        <div
                            className="h-4 w-4 rounded-full"
                            style={{ backgroundColor: details.riskColor }}
                        ></div>
                        <div className="font-bold text-slate-800">
                            Transacción: {details.id}
                        </div>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Score de Riesgo:</span>
                            <span className="font-bold" style={{ color: details.riskColor }}>
                                {details.score}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Nivel:</span>
                            <span className="font-bold" style={{ color: details.riskColor }}>
                                {details.riskLevel}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Valor:</span>
                            <span className="font-bold text-slate-800">{details.value}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Alertas:</span>
                            <span className="font-bold text-slate-800">{details.alerts}</span>
                        </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="text-xs text-slate-500 mb-2">Factores de Riesgo:</div>
                        <div className="space-y-1">
                            {details.riskFactors.map((factor, index) => (
                                <div key={index} className="flex items-center gap-2 text-xs">
                                    <div className="h-1.5 w-1.5 rounded-full bg-slate-400"></div>
                                    <span className="text-slate-600">{factor}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100">
                        <div className="text-xs text-slate-400 italic">
                            Click para ver detalles completos
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Función para manejar click en punto
    const handlePointClick = (data: any) => {
        const details = getPointDetails(data);
        if (details) {
            setSelectedPoint(details);
            setShowPointModal(true);
        }
    };

    // Función para filtrar datos por nivel de riesgo
    const getFilteredScatterData = () => {
        return scatterData.filter(point => {
            if (point.y > 75 && !visibleRiskLevels.high) return false;
            if (point.y > 40 && point.y <= 75 && !visibleRiskLevels.medium) return false;
            if (point.y <= 40 && !visibleRiskLevels.low) return false;
            return true;
        });
    };

    // Función para toggle de filtros
    const toggleRiskLevel = (level: 'high' | 'medium' | 'low') => {
        setVisibleRiskLevels(prev => ({
            ...prev,
            [level]: !prev[level]
        }));
    };

    // Función para generar sugerencias inteligentes dinámicas
    const generateIntelligentSuggestions = () => {
        if (!analysisData) return [];

        const suggestions = [];

        // Sugerencias basadas en Análisis de Entropía
        if (analysisData.entropy) {
            if (analysisData.entropy.highRiskCombinations > 0) {
                suggestions.push({
                    id: 'entropy_high_risk',
                    type: 'CRITICAL',
                    icon: 'fa-microchip',
                    title: 'Combinaciones Categóricas Críticas Detectadas',
                    description: `Se identificaron ${analysisData.entropy.highRiskCombinations} combinaciones de categorías de alto riesgo. Estas representan patrones inusuales que pueden indicar transacciones ficticias o clasificaciones erróneas.`,
                    actions: [
                        'Revisar manualmente todas las combinaciones marcadas como alto riesgo',
                        'Verificar la validez de las clasificaciones categóricas inusuales',
                        'Investigar si existen nuevos tipos de transacciones no documentadas',
                        'Considerar muestreo dirigido en estas combinaciones específicas'
                    ],
                    priority: 'HIGH'
                });
            } else if (analysisData.entropy.anomalousCount > 5) {
                suggestions.push({
                    id: 'entropy_medium_risk',
                    type: 'WARNING',
                    icon: 'fa-microchip',
                    title: 'Diversidad Categórica Inusual',
                    description: `Se detectaron ${analysisData.entropy.anomalousCount} combinaciones categóricas poco frecuentes. Aunque no son críticas, merecen atención.`,
                    actions: [
                        'Revisar una muestra de las combinaciones menos frecuentes',
                        'Validar que las categorías estén siendo aplicadas correctamente',
                        'Documentar nuevos tipos de transacciones si son legítimas'
                    ],
                    priority: 'MEDIUM'
                });
            }
        }

        // Sugerencias basadas en Detección de Fraccionamiento
        if (analysisData.splitting) {
            if (analysisData.splitting.highRiskGroups > 0) {
                suggestions.push({
                    id: 'splitting_critical',
                    type: 'CRITICAL',
                    icon: 'fa-scissors',
                    title: 'Fraccionamiento de Alto Riesgo Detectado',
                    description: `Se identificaron ${analysisData.splitting.highRiskGroups} grupos de proveedores con patrones de fraccionamiento críticos. Score promedio: ${analysisData.splitting.averageRiskScore.toFixed(1)}.`,
                    actions: [
                        'URGENTE: Investigar inmediatamente los proveedores de alto riesgo',
                        'Revisar todas las transacciones de estos proveedores en el período',
                        'Verificar si existen aprobaciones gerenciales para montos agregados',
                        'Evaluar controles de autorización por límites de compra',
                        'Considerar auditoría especial de estos proveedores'
                    ],
                    priority: 'CRITICAL'
                });
            } else if (analysisData.splitting.suspiciousVendors > 0) {
                suggestions.push({
                    id: 'splitting_warning',
                    type: 'WARNING',
                    icon: 'fa-scissors',
                    title: 'Patrones de Fraccionamiento Detectados',
                    description: `${analysisData.splitting.suspiciousVendors} proveedores muestran patrones que podrían indicar fraccionamiento de transacciones.`,
                    actions: [
                        'Revisar los patrones de compra de estos proveedores',
                        'Verificar si los montos agregados exceden límites de autorización',
                        'Evaluar la justificación comercial de múltiples transacciones pequeñas'
                    ],
                    priority: 'MEDIUM'
                });
            }
        }

        // Sugerencias basadas en Integridad Secuencial
        if (analysisData.sequential) {
            if (analysisData.sequential.highRiskGaps > 0) {
                suggestions.push({
                    id: 'sequential_critical',
                    type: 'CRITICAL',
                    icon: 'fa-barcode',
                    title: 'Gaps Secuenciales Críticos Detectados',
                    description: `Se encontraron ${analysisData.sequential.highRiskGaps} gaps de alto riesgo en la secuencia. Gap más grande: ${analysisData.sequential.largestGap} documentos faltantes.`,
                    actions: [
                        'URGENTE: Investigar la causa de los gaps grandes en la numeración',
                        'Solicitar explicación formal sobre documentos faltantes',
                        'Revisar controles de custodia y archivo de documentos',
                        'Verificar si existen documentos anulados no reportados',
                        'Evaluar integridad del sistema de numeración automática'
                    ],
                    priority: 'CRITICAL'
                });
            } else if (analysisData.sequential.totalGaps > 0) {
                suggestions.push({
                    id: 'sequential_warning',
                    type: 'WARNING',
                    icon: 'fa-barcode',
                    title: 'Gaps en Numeración Secuencial',
                    description: `Se detectaron ${analysisData.sequential.totalGaps} gaps en la secuencia con ${analysisData.sequential.totalMissingDocuments} documentos faltantes en total.`,
                    actions: [
                        'Revisar la política de numeración secuencial',
                        'Verificar procedimientos de anulación de documentos',
                        'Evaluar controles sobre la custodia de documentos prenumerados'
                    ],
                    priority: 'MEDIUM'
                });
            }
        }

        // Sugerencias basadas en Isolation Forest
        if (analysisData.isolationForest) {
            if (analysisData.isolationForest.highRiskAnomalies > 0) {
                suggestions.push({
                    id: 'ml_critical',
                    type: 'CRITICAL',
                    icon: 'fa-brain',
                    title: 'Anomalías Multidimensionales Críticas',
                    description: `El algoritmo de Machine Learning detectó ${analysisData.isolationForest.highRiskAnomalies} transacciones con patrones altamente anómalos considerando múltiples variables simultáneamente.`,
                    actions: [
                        'Revisar detalladamente las transacciones marcadas como anomalías críticas',
                        'Analizar el contexto y justificación de estas transacciones inusuales',
                        'Verificar si representan nuevos tipos de operaciones o errores',
                        'Considerar estas transacciones como prioritarias en el muestreo'
                    ],
                    priority: 'HIGH'
                });
            } else if (analysisData.isolationForest.totalAnomalies > 10) {
                suggestions.push({
                    id: 'ml_warning',
                    type: 'INFO',
                    icon: 'fa-brain',
                    title: 'Patrones Inusuales Detectados por ML',
                    description: `Se identificaron ${analysisData.isolationForest.totalAnomalies} transacciones con patrones inusuales según análisis multidimensional.`,
                    actions: [
                        'Revisar una muestra de las anomalías detectadas',
                        'Evaluar si representan variaciones normales del negocio',
                        'Documentar nuevos patrones si son operaciones legítimas'
                    ],
                    priority: 'LOW'
                });
            }
        }

        // Sugerencias basadas en Actor Profiling
        if (analysisData.actorProfiling) {
            if (analysisData.actorProfiling.highRiskActors > 0) {
                suggestions.push({
                    id: 'actor_critical',
                    type: 'CRITICAL',
                    icon: 'fa-user-secret',
                    title: 'Comportamientos de Usuario Críticos',
                    description: `${analysisData.actorProfiling.highRiskActors} usuarios muestran patrones de comportamiento de alto riesgo. Score promedio: ${analysisData.actorProfiling.averageRiskScore.toFixed(1)}.`,
                    actions: [
                        'CONFIDENCIAL: Investigar discretamente los usuarios de alto riesgo',
                        'Revisar horarios y patrones de trabajo inusuales',
                        'Evaluar accesos y permisos de estos usuarios',
                        'Considerar monitoreo adicional de sus actividades',
                        'Verificar cumplimiento de políticas internas'
                    ],
                    priority: 'CRITICAL'
                });
            } else if (analysisData.actorProfiling.totalSuspiciousActors > 0) {
                suggestions.push({
                    id: 'actor_warning',
                    type: 'WARNING',
                    icon: 'fa-user-secret',
                    title: 'Patrones de Usuario Inusuales',
                    description: `${analysisData.actorProfiling.totalSuspiciousActors} usuarios presentan patrones de actividad que merecen atención.`,
                    actions: [
                        'Revisar patrones de trabajo de estos usuarios',
                        'Verificar justificación de actividades fuera de horario',
                        'Evaluar si requieren capacitación adicional'
                    ],
                    priority: 'MEDIUM'
                });
            }
        }

        // Sugerencias basadas en Enhanced Benford
        if (analysisData.enhancedBenford) {
            if (analysisData.enhancedBenford.conformityRiskLevel === 'HIGH') {
                suggestions.push({
                    id: 'benford_critical',
                    type: 'CRITICAL',
                    icon: 'fa-calculator',
                    title: 'Desviación Crítica de la Ley de Benford',
                    description: `MAD: ${analysisData.enhancedBenford.overallDeviation.toFixed(2)}% - ${analysisData.enhancedBenford.conformityDescription}. Se detectaron ${analysisData.enhancedBenford.highRiskPatterns} patrones críticos.`,
                    actions: [
                        'URGENTE: Investigar posible manipulación de datos financieros',
                        'Revisar procesos de captura y validación de datos',
                        'Analizar patrones específicos de dígitos anómalos',
                        'Verificar integridad de sistemas de información',
                        'Considerar auditoría forense especializada'
                    ],
                    priority: 'CRITICAL'
                });
            } else if (analysisData.enhancedBenford.conformityRiskLevel === 'MEDIUM') {
                suggestions.push({
                    id: 'benford_warning',
                    type: 'WARNING',
                    icon: 'fa-calculator',
                    title: 'Desviaciones en Distribución de Dígitos',
                    description: `MAD: ${analysisData.enhancedBenford.overallDeviation.toFixed(2)}% - Conformidad marginal con la Ley de Benford.`,
                    actions: [
                        'Revisar procesos de redondeo y aproximación',
                        'Verificar si existen sesgos en la captura de datos',
                        'Evaluar la naturaleza de las transacciones analizadas'
                    ],
                    priority: 'MEDIUM'
                });
            }
        }

        // Sugerencias generales basadas en múltiples hallazgos
        const totalHighRiskFindings = suggestions.filter(s => s.priority === 'CRITICAL' || s.priority === 'HIGH').length;

        if (totalHighRiskFindings >= 3) {
            suggestions.unshift({
                id: 'general_critical',
                type: 'CRITICAL',
                icon: 'fa-exclamation-triangle',
                title: 'Múltiples Hallazgos Críticos - Acción Inmediata Requerida',
                description: `Se detectaron ${totalHighRiskFindings} tipos diferentes de anomalías críticas. Esta combinación sugiere riesgos significativos que requieren atención inmediata.`,
                actions: [
                    'URGENTE: Escalar hallazgos a la gerencia inmediatamente',
                    'Suspender procesamiento de transacciones hasta investigación',
                    'Implementar muestreo dirigido con tamaño aumentado significativamente',
                    'Considerar auditoría forense especializada',
                    'Documentar todos los hallazgos para reporte gerencial',
                    'Evaluar controles internos de forma integral'
                ],
                priority: 'CRITICAL'
            });
        }

        // Sugerencias de muestreo específicas
        const totalAnomalies = (analysisData.entropy?.anomalousCount || 0) +
            (analysisData.splitting?.suspiciousVendors || 0) +
            (analysisData.sequential?.totalGaps || 0) +
            (analysisData.isolationForest?.totalAnomalies || 0) +
            (analysisData.actorProfiling?.totalSuspiciousActors || 0);

        if (totalAnomalies > 20) {
            suggestions.push({
                id: 'sampling_recommendation',
                type: 'INFO',
                icon: 'fa-random',
                title: 'Recomendación de Estrategia de Muestreo',
                description: `Dado el alto número de anomalías detectadas (${totalAnomalies}), se recomienda una estrategia de muestreo híbrida.`,
                actions: [
                    'Implementar muestreo dirigido en áreas de alto riesgo identificadas',
                    'Aumentar tamaño de muestra en 50-100% sobre lo inicialmente planeado',
                    'Considerar muestreo estratificado por nivel de riesgo',
                    'Incluir todas las transacciones marcadas como críticas',
                    'Documentar justificación del enfoque de muestreo modificado'
                ],
                priority: 'HIGH'
            });
        }

        return suggestions.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'WARNING': 1, 'INFO': 0 };
            return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
        });
    };
    const getForensicMetrics = () => {
        if (!analysisData) return [];

        const metrics = [];

        // Análisis de Entropía
        if (analysisData.entropy) {
            metrics.push({
                id: 'entropy',
                title: 'Anomalías Categóricas',
                value: analysisData.entropy.anomalousCount,
                subtitle: `${analysisData.entropy.highRiskCombinations} de alto riesgo`,
                icon: 'fa-microchip',
                color: analysisData.entropy.highRiskCombinations > 0 ? 'red' : 'blue',
                description: `Entropía: ${analysisData.entropy.categoryEntropy.toFixed(2)} bits`
            });
        }

        // Detección de Fraccionamiento
        if (analysisData.splitting) {
            metrics.push({
                id: 'splitting',
                title: 'Fraccionamiento',
                value: analysisData.splitting.suspiciousVendors,
                subtitle: `${analysisData.splitting.totalSuspiciousTransactions} transacciones`,
                icon: 'fa-scissors',
                color: analysisData.splitting.highRiskGroups > 0 ? 'red' :
                    analysisData.splitting.suspiciousVendors > 0 ? 'yellow' : 'green',
                description: `Score promedio: ${analysisData.splitting.averageRiskScore.toFixed(1)}`
            });
        }

        // Integridad Secuencial
        if (analysisData.sequential) {
            metrics.push({
                id: 'sequential',
                title: 'Gaps Secuenciales',
                value: analysisData.sequential.totalGaps,
                subtitle: `${analysisData.sequential.totalMissingDocuments} docs faltantes`,
                icon: 'fa-barcode',
                color: analysisData.sequential.highRiskGaps > 0 ? 'red' :
                    analysisData.sequential.totalGaps > 0 ? 'yellow' : 'green',
                description: `Gap más grande: ${analysisData.sequential.largestGap}`
            });
        }

        // Análisis Tradicionales
        metrics.push({
            id: 'benford',
            title: 'Ley de Benford',
            value: analysisData.benford.filter(b => b.isSuspicious).length,
            subtitle: 'dígitos anómalos',
            icon: 'fa-chart-bar',
            color: analysisData.benford.filter(b => b.isSuspicious).length > 2 ? 'yellow' : 'blue',
            description: 'Distribución de dígitos iniciales'
        });

        // Isolation Forest (Machine Learning)
        if (analysisData.isolationForest) {
            metrics.push({
                id: 'isolation_forest',
                title: 'ML Anomalías',
                value: analysisData.isolationForest.totalAnomalies,
                subtitle: `${analysisData.isolationForest.highRiskAnomalies} de alto riesgo`,
                icon: 'fa-brain',
                color: analysisData.isolationForest.highRiskAnomalies > 0 ? 'red' :
                    analysisData.isolationForest.totalAnomalies > 5 ? 'yellow' : 'green',
                description: `Umbral: ${analysisData.isolationForest.anomalyThreshold.toFixed(3)}`
            });
        }

        // Actor Profiling (Análisis de Comportamiento)
        if (analysisData.actorProfiling) {
            metrics.push({
                id: 'actor_profiling',
                title: 'Actores Sospechosos',
                value: analysisData.actorProfiling.totalSuspiciousActors,
                subtitle: `${analysisData.actorProfiling.highRiskActors} de alto riesgo`,
                icon: 'fa-user-secret',
                color: analysisData.actorProfiling.highRiskActors > 0 ? 'red' :
                    analysisData.actorProfiling.totalSuspiciousActors > 0 ? 'yellow' : 'green',
                description: `Score promedio: ${analysisData.actorProfiling.averageRiskScore.toFixed(1)}`
            });
        }

        // Enhanced Benford Analysis
        if (analysisData.enhancedBenford) {
            const conformityColor = analysisData.enhancedBenford.overallDeviation > 3 ? 'red' :
                analysisData.enhancedBenford.overallDeviation > 1.5 ? 'yellow' :
                    analysisData.enhancedBenford.overallDeviation > 1.2 ? 'yellow' : 'green';

            metrics.push({
                id: 'enhanced_benford',
                title: 'Benford Mejorado',
                value: analysisData.enhancedBenford.suspiciousPatterns,
                subtitle: `MAD: ${analysisData.enhancedBenford.overallDeviation.toFixed(2)}%`,
                icon: 'fa-calculator',
                color: conformityColor,
                description: `${analysisData.enhancedBenford.highRiskPatterns} patrones críticos`
            });
        }

        metrics.push({
            id: 'outliers',
            title: 'Valores Atípicos',
            value: analysisData.outliersCount,
            subtitle: 'outliers detectados',
            icon: 'fa-expand-arrows-alt',
            color: analysisData.outliersCount > 10 ? 'red' :
                analysisData.outliersCount > 5 ? 'yellow' : 'green',
            description: `Umbral: ${analysisData.outliersThreshold.toLocaleString()}`
        });

        metrics.push({
            id: 'duplicates',
            title: 'Duplicados',
            value: analysisData.duplicatesCount,
            subtitle: 'transacciones repetidas',
            icon: 'fa-copy',
            color: analysisData.duplicatesCount > 5 ? 'red' :
                analysisData.duplicatesCount > 0 ? 'yellow' : 'green',
            description: 'Detección inteligente por mapeo'
        });

        return metrics;
    };

    // Función para obtener el color de la métrica
    const getMetricColorClasses = (color: string) => {
        switch (color) {
            case 'red':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'yellow':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'green':
                return 'bg-green-50 border-green-200 text-green-800';
            default:
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    useEffect(() => {
        analyzeRisk();

        // Configurar sincronización offline si es móvil
        if (isMobile) {
            offlineSync.onSyncStatus('risk-analysis', (status) => {
                setOfflineStatus(status);
                if (status.status === 'success') {
                    addToast('Datos sincronizados correctamente', 'success');
                } else if (status.status === 'error') {
                    addToast('Error en sincronización - datos guardados offline', 'warning');
                }
            });
        }
    }, []);

    const analyzeRisk = async () => {
        setLoading(true);
        setProgressMessage('Iniciando análisis de riesgo...');
        setShowProgressNotification(true);

        try {
            // 1. Verificar cache primero
            console.log("🔍 Verificando cache de análisis...");
            if (cache.hasCache(population.id, population)) {
                const cachedData = cache.getCache(population.id, population);
                if (cachedData) {
                    console.log("⚡ Usando datos del cache");
                    setIsUsingCache(true);
                    setProfile(cachedData.riskProfile);
                    setAnalysisData(cachedData.analysisData);
                    setScatterData(cachedData.scatterData);
                    setInsight(cachedData.insight);
                    setProgressMessage('Análisis cargado desde cache');

                    addToast("Análisis cargado desde cache - Rendimiento optimizado", 'success');

                    setTimeout(() => {
                        setShowProgressNotification(false);
                        setLoading(false);
                    }, 1000);
                    return;
                }
            }

            setIsUsingCache(false);

            // 2. Determinar si usar lazy loading para poblaciones grandes
            const shouldUseLazyLoading = population.total_rows > 2000;

            if (shouldUseLazyLoading) {
                console.log(`🚀 Población grande (${population.total_rows} registros) - Usando lazy loading`);
                await analyzeWithLazyLoading();
            } else {
                console.log(`🚀 Población pequeña (${population.total_rows} registros) - Carga directa`);
                await analyzeDirectly();
            }

        } catch (err) {
            console.error('❌ Error en análisis de riesgo:', err);
            addToast('Error durante el análisis de riesgo', 'error');
        } finally {
            setLoading(false);
            setShowProgressNotification(false);
        }
    };

    // Análisis con lazy loading para poblaciones grandes
    const analyzeWithLazyLoading = async () => {
        setProgressMessage('Cargando datos progresivamente...');

        let allRows: any[] = [];
        let batchCount = 0;

        await lazyLoader.loadProgressively(
            population.id,
            population.total_rows,
            // onProgress
            (state: LazyLoadState) => {
                setLazyLoadState(state);
                setProgressMessage(
                    `Cargando lote ${state.currentBatch}/${Math.ceil(state.totalRows / 500)} - ${state.progress.toFixed(1)}%`
                );
            },
            // onBatchLoaded
            (batchData: any[], batchIndex: number) => {
                allRows.push(...batchData);
                batchCount++;

                // Procesar en background cada 3 lotes para mantener UI responsiva
                if (batchCount % 3 === 0) {
                    const taskId = backgroundProcessor.addTask(
                        'data_processing',
                        { data: batchData, operation: 'risk_scoring' },
                        'medium'
                    );
                    setBackgroundTasks(prev => [...prev, taskId]);
                }
            },
            // onComplete
            async (allData: any[]) => {
                console.log(`✅ Lazy loading completado: ${allData.length} registros`);
                setProgressMessage('Procesando análisis forense...');

                // Procesar análisis en background
                const taskId = backgroundProcessor.addTask(
                    'risk_analysis',
                    { populationId: population.id, rows: allData },
                    'high',
                    15000 // 15 segundos estimados
                );

                setBackgroundTasks(prev => [...prev, taskId]);

                // Simular procesamiento (en producción sería el análisis real)
                await processAnalysisData(allData);
            },
            // onError
            (error: string) => {
                console.error('❌ Error en lazy loading:', error);
                addToast(`Error cargando datos: ${error}`, 'error');
            }
        );
    };

    // Análisis directo para poblaciones pequeñas
    const analyzeDirectly = async () => {
        setProgressMessage('Cargando datos de población...');

        // Fetch data using existing API
        const res = await fetch(`/api/get_validation_data?id=${population.id}`);
        if (!res.ok) throw new Error('Failed to load analysis data via proxy');

        const { rows } = await res.json();
        if (!rows) throw new Error("Universo no disponible");

        setProgressMessage('Procesando análisis forense...');
        await processAnalysisData(rows);
    };

    // Procesa los datos de análisis (común para ambos métodos)
    const processAnalysisData = async (rows: any[]) => {
        // Ejecutar análisis de riesgo
        const { updatedRows, profile: newProfile, advancedAnalysis } = performRiskProfiling(rows, population);

        setProfile(newProfile);
        setAnalysisData(advancedAnalysis);

        // Generar datos del gráfico
        const mapping = population.column_mapping;
        const plotData = updatedRows.map((r, index) => {
            const rawVal = r.raw_json?.[mapping.monetaryValue || ''];
            let mValue = parseCurrency(rawVal);
            const zVal = mValue > 0 ? Math.log10(mValue + 1) * 10 : 10;

            return {
                id: r.id || `row-${index}`,
                x: r.alert_count ?? 0,
                y: r.risk_score ?? 0,
                z: zVal,
                name: r.unique_id_col || `ID-${index}`,
                value: mValue
            };
        });

        setScatterData(plotData);

        // Generar insight
        const riskLevel = newProfile.totalRiskScore > 70 ? 'CRÍTICA' : newProfile.totalRiskScore > 40 ? 'MODERADA' : 'BAJA';
        const insightMsg = `El motor forense ha detectado una vulnerabilidad ${riskLevel}. Se identificaron ${newProfile.gapAlerts} puntos críticos que requieren inspección manual obligatoria para cumplir con la NIA 530.`;
        setInsight(insightMsg);

        // Guardar en cache para futuras consultas
        const cacheData = {
            riskProfile: newProfile,
            analysisData: advancedAnalysis,
            scatterData: plotData,
            insight: insightMsg,
            metadata: {
                totalRows: rows.length,
                processedAt: Date.now(),
                version: '1.0'
            }
        };

        cache.setCache(population.id, population, cacheData);

        // 🔥 CRÍTICO: Actualizar appState.selectedPopulation.advanced_analysis INMEDIATAMENTE
        // para que NonStatisticalSampling vea los mismos datos sin esperar a guardar recomendación
        const updatedPopWithAnalysis = {
            ...population,
            advanced_analysis: advancedAnalysis
        };

        // Actualizar el appState para sincronizar con NonStatisticalSampling
        // onComplete(updatedPopWithAnalysis); // Removed to prevent auto-navigation


        // Guardar advanced_analysis en la base de datos INMEDIATAMENTE
        console.log("💾 Guardando advanced_analysis en DB...");
        try {
            const saveAnalysisRes = await fetch('/api/update_mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: population.id,
                    advanced_analysis: advancedAnalysis
                })
            });

            if (!saveAnalysisRes.ok) {
                console.warn("⚠️ Error guardando advanced_analysis:", await saveAnalysisRes.text());
            } else {
                console.log("✅ advanced_analysis guardado en DB correctamente");
            }
        } catch (error) {
            console.error("❌ Error al guardar advanced_analysis:", error);
        }

        // Guardar offline si es móvil
        if (isMobile) {
            offlineSync.saveOffline(
                `analysis_${population.id}`,
                'analysis',
                cacheData,
                'high'
            );
        }

        // Guardar risk_factors en la base de datos
        console.log(`💾 Guardando risk_factors para ${updatedRows.length} registros...`);
        try {
            // 🎯 FIX: Usar unique_id_col como id (es el PK real de audit_data_rows)
            // El backend espera 'id' como string, pero necesitamos mapear correctamente
            const updates = updatedRows
                .filter(r => r.unique_id_col) // Solo incluir rows con ID válido
                .map(r => ({
                    id: r.unique_id_col,  // ✅ Este es el PK real (string)
                    risk_score: r.risk_score || 0,
                    risk_factors: r.risk_factors || []
                }));

            if (updates.length === 0) {
                console.warn('⚠️ No hay registros con unique_id_col válido para actualizar');
                addToast('Advertencia: No se pudieron actualizar factores de riesgo', 'warning');
                return;
            }

            console.log(`📤 Enviando ${updates.length} actualizaciones de risk_factors...`);

            const response = await fetch('/api/update_risk_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates })
            });

            if (response.ok) {
                const result = await response.json();
                const updatedCount = result.count ?? updates.length;
                console.log(`✅ Risk factors guardados: ${updatedCount} registros actualizados`);
                addToast(`Análisis completado: ${updatedCount} registros actualizados con factores de riesgo`, 'success');
            } else {
                const errorText = await response.text();
                console.error('❌ Error guardando risk_factors:', errorText);
                addToast('Advertencia: Los factores de riesgo no se guardaron correctamente', 'warning');
            }
        } catch (error) {
            console.error('❌ Error en update_risk_batch:', error);
            addToast('Advertencia: Error al guardar factores de riesgo', 'warning');
        }

        // Notificar usuario
        if (newProfile.gapAlerts > 0 || newProfile.totalRiskScore > 40) {
            addToast("Patrones complejos detectados. Se ha activado la Estrategia Forense.", 'info');
        }

        console.log("✅ Análisis de riesgo completado");
    };

    const handleExportReport = async () => {
        if (isGeneratingReport) return;

        if (!profile || !analysisData) {
            addToast('No hay datos de análisis disponibles para exportar', 'error');
            return;
        }

        setIsGeneratingReport(true);
        try {
            // Capturar gráfico como imagen de alta calidad
            let chartImage: string | undefined;
            const chartElement = document.getElementById('risk-scatter-chart');

            if (chartElement && !isMobile) {
                try {
                    const canvas = await html2canvas(chartElement, {
                        scale: 2, // Alta resolución
                        backgroundColor: '#ffffff',
                        logging: false,
                        useCORS: true
                    });
                    chartImage = canvas.toDataURL('image/png');
                } catch (error) {
                    console.warn('No se pudo capturar el gráfico, usando versión dibujada:', error);
                }
            }

            // Generar reporte estándar con imagen del gráfico
            await generateRiskAnalysisReport({
                population,
                profile,
                analysisData,
                scatterData,
                insight,
                chartImage, // Nueva propiedad
                generatedBy: 'Auditor Principal',
                generatedDate: new Date()
            });

            // Si es móvil, generar también versión móvil
            if (isMobile) {
                await mobileReports.generateRiskAnalysis({
                    population,
                    profile,
                    analysisData,
                    scatterData,
                    insight,
                    generatedBy: 'Auditor Principal',
                    generatedDate: new Date()
                });

                addToast('Reportes generados: versión estándar y móvil', 'success');
            } else {
                addToast('Reporte de análisis de riesgo generado exitosamente', 'success');
            }
        } catch (error) {
            console.error('Error generando reporte de riesgo:', error);
            addToast('Error al generar el reporte de análisis de riesgo', 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleComplete = async () => {
        if (!population || !analysisData) {
            onComplete(population);
            return;
        }

        setLoading(true);
        try {
            // Generate AI Recommendation
            const recommendation = analyzePopulationAndRecommend(population.descriptive_stats, analysisData);

            // Update Population
            const updatedPop = {
                ...population,
                ai_recommendation: recommendation,
                advanced_analysis: analysisData // Save the calculated stats too
            };

            // Save to DB
            // Save to DB via Proxy (reuse update_mapping as it targets audit_populations)
            console.log("💾 Saving Final Profile via Proxy...");
            const saveRes = await fetch('/api/update_mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: population.id,
                    ai_recommendation: recommendation,
                    advanced_analysis: analysisData
                })
            });

            if (!saveRes.ok) {
                console.warn("⚠️ Proxy save warning:", await saveRes.text());
                // Proceed anyway as state is updated locally
            }

            onComplete(updatedPop);
        } catch (e) {
            console.error("Error saving recommendation", e);
            onComplete(population);
        }
        setLoading(false);
    };

    if (loading) return (
        <div className={`flex flex-col items-center justify-center py-40 bg-white rounded-[3rem] shadow-sm relative ${responsiveClasses}`}>
            <div className="h-24 w-24 border-8 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <h3 className={`mt-8 text-xl font-black text-slate-800 uppercase tracking-widest ${isMobile ? 'text-lg' : ''}`}>
                {isUsingCache ? 'Cargando desde Cache' : 'Iniciando Motor MA-RISK'}
            </h3>
            <p className={`text-slate-400 text-[10px] font-bold uppercase mt-2 tracking-[0.4em] ${isMobile ? 'text-center px-4' : ''}`}>
                {progressMessage || 'Cuantificando vectores de riesgo...'}
            </p>

            {/* Indicador de estado offline/online para móvil */}
            {isMobile && (
                <div className="mt-4 flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isOffline ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                    <span className="text-xs text-slate-600">
                        {isOffline ? 'Modo Offline' : 'Conectado'}
                    </span>
                </div>
            )}

            {/* Indicador de Cache */}
            {isUsingCache && (
                <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-xl text-sm font-bold">
                    <i className="fas fa-bolt text-green-600"></i>
                    Rendimiento Optimizado
                </div>
            )}

            {/* Progreso de Lazy Loading */}
            {lazyLoadState && (
                <div className="mt-6 w-full max-w-md">
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>Progreso: {lazyLoadState.progress.toFixed(1)}%</span>
                        <span>{lazyLoadState.loadedRows.toLocaleString()} / {lazyLoadState.totalRows.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${lazyLoadState.progress}%` }}
                        ></div>
                    </div>
                    {lazyLoadState.estimatedTimeRemaining > 0 && (
                        <div className="text-xs text-slate-500 mt-2 text-center">
                            Tiempo estimado: {lazyLoadState.estimatedTimeRemaining}s
                        </div>
                    )}
                </div>
            )}

            {/* Tareas en Background */}
            {backgroundTasks.length > 0 && (
                <div className="mt-4 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                        {backgroundTasks.length} tarea{backgroundTasks.length > 1 ? 's' : ''} en segundo plano
                    </div>
                </div>
            )}

            {/* Notificación de Progreso */}
            {showProgressNotification && (
                <div className="absolute top-4 right-4 bg-white rounded-xl shadow-lg border border-slate-200 p-4 max-w-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse"></div>
                        <div>
                            <div className="font-bold text-slate-800 text-sm">Procesando</div>
                            <div className="text-xs text-slate-600">{progressMessage}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className={`animate-fade-in space-y-10 pb-20 ${responsiveClasses}`}>
            {/* Header adaptativo */}
            <div className={`bg-slate-900 rounded-[3rem] ${isMobile ? 'p-6' : 'p-12'} text-white shadow-2xl relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-20 -mt-20"></div>
                <div className={`relative z-10 flex ${isMobile ? 'flex-col gap-4' : 'flex-col md:flex-row justify-between items-center gap-8'}`}>
                    <div className={`flex items-center ${isMobile ? 'flex-col text-center' : 'gap-8'}`}>
                        <div className={`${isMobile ? 'h-16 w-16 mb-4' : 'h-20 w-20'} rounded-[2rem] bg-indigo-600 flex items-center justify-center shadow-xl`}>
                            <i className={`fas fa-radar ${isMobile ? 'text-2xl' : 'text-3xl'}`}></i>
                        </div>
                        <div>
                            <span className={`text-cyan-400 ${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-[0.3em] mb-2 block`}>
                                Módulo de Perfilado AAMA v4.1 {isMobile ? 'Móvil' : ''}
                            </span>
                            <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black tracking-tighter uppercase leading-none`}>
                                Análisis de Riesgo NIA 530
                            </h2>
                        </div>
                    </div>

                    <div className={`flex items-center ${isMobile ? 'flex-col gap-4 w-full' : 'gap-6'}`}>
                        <div className={`flex ${isMobile ? 'justify-center w-full' : 'gap-10'} bg-white/5 ${isMobile ? 'p-4' : 'p-8'} rounded-[2.5rem] border border-white/10 backdrop-blur-xl`}>
                            <div className="text-center">
                                <div className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-white`}>
                                    {profile?.totalRiskScore.toFixed(1)}
                                </div>
                                <div className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black text-slate-500 uppercase tracking-widest mt-1`}>
                                    Score Promedio
                                </div>
                            </div>
                            <div className="w-px h-10 bg-white/10 mx-4"></div>
                            <div className="text-center">
                                <div className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-cyan-400`}>
                                    {profile?.gapAlerts}
                                </div>
                                <div className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black text-slate-500 uppercase tracking-widest mt-1`}>
                                    Alertas Detectadas
                                </div>
                            </div>
                        </div>

                        <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'gap-4'}`}>
                            <button
                                onClick={handleExportReport}
                                disabled={isGeneratingReport}
                                className={`${adaptiveUI.buttonSize} bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-100 transition-all transform hover:-translate-y-1 flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'justify-center w-full' : ''}`}
                            >
                                {isGeneratingReport ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin mr-3"></i>
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-file-pdf mr-3 text-red-600"></i>
                                        Exportar PDF {isMobile ? '+ Móvil' : ''}
                                    </>
                                )}
                            </button>

                            {/* Botón de vista previa móvil */}
                            {isMobile && (
                                <button
                                    onClick={() => setShowMobilePreview(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center w-full"
                                >
                                    <i className="fas fa-eye mr-2"></i>
                                    Vista Previa
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Indicador de estado offline para móvil */}
                {isMobile && isOffline && (
                    <div className="absolute top-4 right-4 bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold">
                        <i className="fas fa-wifi-slash mr-1"></i>
                        Offline
                    </div>
                )}
            </div>

            <div className={`grid grid-cols-1 ${isMobile ? '' : 'lg:grid-cols-3'} gap-10`}>
                <div className={`${isMobile ? 'col-span-1' : 'lg:col-span-2'} bg-white rounded-[3.5rem] ${isMobile ? 'p-6' : 'p-12'} shadow-sm border border-slate-100`}>
                    {/* Usar componente móvil optimizado si es dispositivo móvil */}
                    {isMobile ? (
                        <MobileRiskChart
                            scatterData={scatterData}
                            onPointClick={handlePointClick}
                            visibleRiskLevels={visibleRiskLevels}
                            onToggleRiskLevel={toggleRiskLevel}
                            getFilteredScatterData={getFilteredScatterData}
                            CustomTooltip={CustomTooltip}
                        />
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-10">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Red de Dispersión Forense</h4>
                            </div>

                            <div id="risk-scatter-chart" className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis type="number" dataKey="x" name="Alertas" hide />
                                        <YAxis type="number" dataKey="y" name="Score" domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                        <ZAxis type="number" dataKey="z" range={[50, 800]} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <ReferenceLine y={75} stroke="#f43f5e" strokeDasharray="5 5" label={{ position: 'right', value: 'ALTA PRIORIDAD', fill: '#f43f5e', fontSize: 8, fontWeight: 'bold' }} />
                                        <Scatter
                                            name="Hallazgos"
                                            data={getFilteredScatterData()}
                                            onClick={handlePointClick}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {getFilteredScatterData().map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.y > 75 ? '#f43f5e' : entry.y > 40 ? '#f59e0b' : '#10b981'}
                                                    fillOpacity={0.7}
                                                    stroke={entry.y > 75 ? '#dc2626' : entry.y > 40 ? '#d97706' : '#059669'}
                                                    strokeWidth={1}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            ))}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Controles de Filtro Desktop */}
                            <div className="mt-6 flex flex-wrap gap-3 justify-center">
                                <button
                                    onClick={() => toggleRiskLevel('high')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${visibleRiskLevels.high
                                        ? 'bg-red-100 text-red-800 border-2 border-red-300'
                                        : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                                        }`}
                                >
                                    <div className={`h-3 w-3 rounded-full ${visibleRiskLevels.high ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                                    Alto Riesgo ({scatterData.filter(p => p.y > 75).length})
                                </button>

                                <button
                                    onClick={() => toggleRiskLevel('medium')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${visibleRiskLevels.medium
                                        ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300'
                                        : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                                        }`}
                                >
                                    <div className={`h-3 w-3 rounded-full ${visibleRiskLevels.medium ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
                                    Riesgo Medio ({scatterData.filter(p => p.y > 40 && p.y <= 75).length})
                                </button>

                                <button
                                    onClick={() => toggleRiskLevel('low')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${visibleRiskLevels.low
                                        ? 'bg-green-100 text-green-800 border-2 border-green-300'
                                        : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                                        }`}
                                >
                                    <div className={`h-3 w-3 rounded-full ${visibleRiskLevels.low ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    Bajo Riesgo ({scatterData.filter(p => p.y <= 40).length})
                                </button>

                                <button
                                    onClick={() => setVisibleRiskLevels({ high: true, medium: true, low: true })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 border-2 border-slate-300 hover:bg-slate-200 transition-all"
                                >
                                    <i className="fas fa-eye text-xs"></i>
                                    Mostrar Todos ({scatterData.length})
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <div className={`space-y-8 ${isMobile ? 'mt-8' : ''}`}>
                    <div className={`bg-gradient-to-br from-indigo-50 to-blue-50 rounded-[3rem] ${isMobile ? 'p-6' : 'p-10'} border border-indigo-100 shadow-inner`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'} bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg`}>
                                <i className={`fas fa-microscope ${isMobile ? 'text-xs' : 'text-sm'}`}></i>
                            </div>
                            <span className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black text-indigo-900 uppercase tracking-widest`}>
                                Dictamen Forense
                            </span>
                        </div>
                        <p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-slate-700 leading-relaxed italic border-l-4 border-indigo-200 pl-6`}>
                            "{insight}"
                        </p>
                    </div>

                    {/* Panel de estado offline para móvil */}
                    {isMobile && (
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`h-3 w-3 rounded-full ${isOffline ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                    <span className="text-sm font-bold text-slate-800">
                                        {isOffline ? 'Modo Offline' : 'Conectado'}
                                    </span>
                                </div>
                                {offlineSync.stats.pendingSync > 0 && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">
                                        {offlineSync.stats.pendingSync} pendientes
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-xs">
                                <div className="text-center">
                                    <div className="font-bold text-slate-800">{offlineSync.stats.syncedItems}</div>
                                    <div className="text-slate-500">Sincronizados</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-slate-800">{offlineSync.stats.pendingSync}</div>
                                    <div className="text-slate-500">Pendientes</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-slate-800">{offlineSync.stats.storageUsed.toFixed(1)}MB</div>
                                    <div className="text-slate-500">Almacenado</div>
                                </div>
                            </div>

                            {isOffline && (
                                <div className="mt-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
                                    <div className="text-xs text-orange-800 flex items-center gap-2">
                                        <i className="fas fa-info-circle"></i>
                                        Los datos se guardan localmente y se sincronizarán automáticamente al restaurar la conexión.
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sección de Métricas Forenses */}
            {analysisData && (
                <div className={`bg-white rounded-[3.5rem] ${isMobile ? 'p-6' : 'p-12'} shadow-sm border border-slate-100`}>
                    <div className="flex items-center gap-4 mb-10">
                        <div className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg`}>
                            <i className={`fas fa-microscope ${isMobile ? 'text-sm' : 'text-lg'}`}></i>
                        </div>
                        <div>
                            <h4 className={`${isMobile ? 'text-base' : 'text-lg'} font-black text-slate-800 uppercase tracking-wide`}>
                                Análisis Forense Completo
                            </h4>
                            <p className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black text-slate-400 uppercase tracking-[0.3em]`}>
                                9 Modelos de Detección de Anomalías
                            </p>
                        </div>
                    </div>

                    <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'md:grid-cols-2 lg:grid-cols-3 gap-6'}`}>
                        {getForensicMetrics().map((metric) => (
                            <div
                                key={metric.id}
                                className={`border rounded-2xl ${isMobile ? 'p-4' : 'p-6'} transition-all hover:shadow-md ${getMetricColorClasses(metric.color)}`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center">
                                        <i className={`fas ${metric.icon} ${isMobile ? 'text-sm mr-2' : 'text-lg mr-3'}`}></i>
                                        <h5 className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'}`}>{metric.title}</h5>
                                    </div>
                                    <div className={`h-3 w-3 rounded-full ${metric.color === 'red' ? 'bg-red-500' :
                                        metric.color === 'yellow' ? 'bg-yellow-500' :
                                            metric.color === 'green' ? 'bg-green-500' : 'bg-blue-500'
                                        }`}></div>
                                </div>
                                <div className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-black mb-2`}>{metric.value}</div>
                                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium opacity-75 mb-2`}>{metric.subtitle}</div>
                                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} opacity-60`}>{metric.description}</div>
                            </div>
                        ))}
                    </div>

                    {/* Resumen de Riesgo */}
                    <div className={`mt-10 bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl ${isMobile ? 'p-6' : 'p-8'} border border-slate-200`}>
                        <div className="flex items-center gap-4 mb-6">
                            <div className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'} bg-slate-700 rounded-xl flex items-center justify-center text-white`}>
                                <i className={`fas fa-clipboard-check ${isMobile ? 'text-xs' : 'text-sm'}`}></i>
                            </div>
                            <h5 className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-slate-800`}>Resumen de Hallazgos Forenses</h5>
                        </div>

                        <div className={`grid grid-cols-1 ${isMobile ? 'gap-4' : 'md:grid-cols-3 gap-6'}`}>
                            <div className="text-center">
                                <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-black text-red-600`}>
                                    {getForensicMetrics().filter(m => m.color === 'red').length}
                                </div>
                                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold text-red-800 uppercase tracking-wide`}>Alto Riesgo</div>
                            </div>
                            <div className="text-center">
                                <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-black text-yellow-600`}>
                                    {getForensicMetrics().filter(m => m.color === 'yellow').length}
                                </div>
                                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold text-yellow-800 uppercase tracking-wide`}>Riesgo Medio</div>
                            </div>
                            <div className="text-center">
                                <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-black text-green-600`}>
                                    {getForensicMetrics().filter(m => m.color === 'green').length}
                                </div>
                                <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-bold text-green-800 uppercase tracking-wide`}>Bajo Riesgo</div>
                            </div>
                        </div>

                        {/* Recomendación Automática */}
                        <div className={`mt-6 ${isMobile ? 'p-4' : 'p-6'} bg-white rounded-xl border border-slate-200`}>
                            <div className="flex items-start gap-3">
                                <div className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} bg-blue-600 rounded-lg flex items-center justify-center text-white flex-shrink-0 mt-1`}>
                                    <i className={`fas fa-lightbulb ${isMobile ? 'text-[10px]' : 'text-xs'}`}></i>
                                </div>
                                <div>
                                    <h6 className={`font-bold text-slate-800 mb-2 ${isMobile ? 'text-sm' : ''}`}>Recomendación de Muestreo</h6>
                                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-slate-600 leading-relaxed`}>
                                        {getForensicMetrics().filter(m => m.color === 'red').length > 0
                                            ? "🚨 Se detectaron anomalías de ALTO RIESGO. Se recomienda muestreo dirigido enfocado en las áreas problemáticas identificadas y revisión manual detallada antes de proceder."
                                            : getForensicMetrics().filter(m => m.color === 'yellow').length > 0
                                                ? "⚠️ Se detectaron anomalías de RIESGO MEDIO. Se recomienda aumentar el tamaño de muestra y considerar muestreo estratificado para abordar estas áreas."
                                                : "✅ La población presenta un perfil de riesgo BAJO. Se puede proceder con muestreo estadístico estándar con confianza."
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sección de Sugerencias Inteligentes */}
            {analysisData && (
                <div className={`bg-white rounded-[3.5rem] ${isMobile ? 'p-6' : 'p-12'} shadow-sm border border-slate-100`}>
                    <div className="flex items-center gap-4 mb-10">
                        <div className={`${isMobile ? 'h-10 w-10' : 'h-12 w-12'} bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg`}>
                            <i className={`fas fa-brain ${isMobile ? 'text-sm' : 'text-lg'}`}></i>
                        </div>
                        <div>
                            <h4 className={`${isMobile ? 'text-base' : 'text-lg'} font-black text-slate-800 uppercase tracking-wide`}>
                                Sugerencias Inteligentes
                            </h4>
                            <p className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} font-black text-slate-400 uppercase tracking-[0.3em]`}>
                                Recomendaciones Dinámicas Basadas en Hallazgos
                            </p>
                        </div>
                    </div>

                    {(() => {
                        const suggestions = generateIntelligentSuggestions();

                        if (suggestions.length === 0) {
                            return (
                                <div className="text-center py-12">
                                    <div className={`${isMobile ? 'h-12 w-12' : 'h-16 w-16'} bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4`}>
                                        <i className={`fas fa-check-circle ${isMobile ? 'text-lg' : 'text-2xl'} text-green-600`}></i>
                                    </div>
                                    <h5 className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-slate-800 mb-2`}>
                                        Población Sin Anomalías Críticas
                                    </h5>
                                    <p className={`text-slate-600 ${isMobile ? 'text-xs' : ''}`}>
                                        No se detectaron patrones que requieran atención especial. La población presenta un perfil de riesgo normal.
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div className={`space-y-${isMobile ? '4' : '6'}`}>
                                {suggestions.slice(0, isMobile ? 3 : suggestions.length).map((suggestion, index) => {
                                    const getTypeColor = (type: string) => {
                                        switch (type) {
                                            case 'CRITICAL': return 'bg-red-50 border-red-200 text-red-800';
                                            case 'WARNING': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
                                            case 'INFO': return 'bg-blue-50 border-blue-200 text-blue-800';
                                            default: return 'bg-gray-50 border-gray-200 text-gray-800';
                                        }
                                    };

                                    const getIconColor = (type: string) => {
                                        switch (type) {
                                            case 'CRITICAL': return 'bg-red-600';
                                            case 'WARNING': return 'bg-yellow-600';
                                            case 'INFO': return 'bg-blue-600';
                                            default: return 'bg-gray-600';
                                        }
                                    };

                                    const getPriorityBadge = (priority: string) => {
                                        switch (priority) {
                                            case 'CRITICAL': return 'bg-red-600 text-white';
                                            case 'HIGH': return 'bg-orange-600 text-white';
                                            case 'MEDIUM': return 'bg-yellow-600 text-white';
                                            case 'LOW': return 'bg-blue-600 text-white';
                                            default: return 'bg-gray-600 text-white';
                                        }
                                    };

                                    return (
                                        <div key={suggestion.id} className={`border rounded-2xl ${isMobile ? 'p-4' : 'p-6'} ${getTypeColor(suggestion.type)}`}>
                                            <div className="flex items-start gap-4">
                                                <div className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'} ${getIconColor(suggestion.type)} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                                                    <i className={`fas ${suggestion.icon} ${isMobile ? 'text-xs' : 'text-sm'}`}></i>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <h5 className={`font-bold ${isMobile ? 'text-sm' : 'text-lg'}`}>{suggestion.title}</h5>
                                                        <span className={`px-2 py-1 rounded-full ${isMobile ? 'text-[10px]' : 'text-xs'} font-bold ${getPriorityBadge(suggestion.priority)}`}>
                                                            {suggestion.priority}
                                                        </span>
                                                    </div>
                                                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} leading-relaxed mb-4 opacity-90`}>
                                                        {suggestion.description}
                                                    </p>
                                                    <div className="space-y-2">
                                                        <h6 className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} opacity-90`}>Acciones Recomendadas:</h6>
                                                        <ul className="space-y-1">
                                                            {suggestion.actions.slice(0, isMobile ? 2 : suggestion.actions.length).map((action, actionIndex) => (
                                                                <li key={actionIndex} className={`flex items-start gap-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                                                    <div className="h-1.5 w-1.5 bg-current rounded-full mt-2 flex-shrink-0"></div>
                                                                    <span className="leading-relaxed opacity-80">{action}</span>
                                                                </li>
                                                            ))}
                                                            {isMobile && suggestion.actions.length > 2 && (
                                                                <li className="text-xs text-slate-500 italic">
                                                                    +{suggestion.actions.length - 2} acciones más...
                                                                </li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {isMobile && suggestions.length > 3 && (
                                    <div className="text-center">
                                        <button
                                            onClick={() => setShowMobilePreview(true)}
                                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                                        >
                                            Ver todas las sugerencias ({suggestions.length})
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Modal de Vista Previa Móvil */}
            {showMobilePreview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800">Vista Previa Móvil</h3>
                            <button
                                onClick={() => setShowMobilePreview(false)}
                                className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all"
                            >
                                <i className="fas fa-times text-slate-600"></i>
                            </button>
                        </div>

                        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                            <div
                                dangerouslySetInnerHTML={{
                                    __html: mobileReports.generatePreview({
                                        population,
                                        profile,
                                        analysisData,
                                        insight
                                    })
                                }}
                            />
                        </div>

                        <div className="p-4 border-t border-slate-200 flex gap-3">
                            <button
                                onClick={() => setShowMobilePreview(false)}
                                className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await mobileReports.generateRiskAnalysis({
                                            population,
                                            profile,
                                            analysisData,
                                            scatterData,
                                            insight,
                                            generatedBy: 'Auditor Principal',
                                            generatedDate: new Date()
                                        });
                                        addToast('Reporte móvil generado exitosamente', 'success');
                                        setShowMobilePreview(false);
                                    } catch (error) {
                                        addToast('Error generando reporte móvil', 'error');
                                    }
                                }}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-download"></i>
                                Descargar PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalles del Punto */}
            {showPointModal && selectedPoint && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className={`bg-white rounded-3xl ${adaptiveUI.modalSize} w-full max-h-[90vh] overflow-y-auto`}>
                        <div className={`flex items-center justify-between mb-6 ${isMobile ? 'p-4' : 'p-8'}`}>
                            <div className="flex items-center gap-4">
                                <div
                                    className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} rounded-full`}
                                    style={{ backgroundColor: selectedPoint.riskColor }}
                                ></div>
                                <h3 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-slate-800`}>
                                    Detalles de Transacción
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowPointModal(false)}
                                className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'} rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all`}
                            >
                                <i className="fas fa-times text-slate-600"></i>
                            </button>
                        </div>

                        <div className={`grid grid-cols-1 ${isMobile ? 'gap-4 px-4' : 'md:grid-cols-2 gap-6 px-8'} mb-8`}>
                            <div className={`bg-slate-50 rounded-2xl ${isMobile ? 'p-4' : 'p-6'}`}>
                                <h4 className={`font-bold text-slate-800 mb-4 flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
                                    <i className="fas fa-info-circle text-blue-600"></i>
                                    Información General
                                </h4>
                                <div className={`space-y-3 ${isMobile ? 'text-xs' : ''}`}>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">ID Transacción:</span>
                                        <span className="font-bold text-slate-800">{selectedPoint.id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Valor Monetario:</span>
                                        <span className="font-bold text-slate-800">{selectedPoint.value}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Alertas Detectadas:</span>
                                        <span className="font-bold text-slate-800">{selectedPoint.alerts}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-6">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <i className="fas fa-shield-alt" style={{ color: selectedPoint.riskColor }}></i>
                                    Evaluación de Riesgo
                                </h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Score de Riesgo:</span>
                                        <span className="font-bold text-2xl" style={{ color: selectedPoint.riskColor }}>
                                            {selectedPoint.score}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600">Nivel de Riesgo:</span>
                                        <span
                                            className="font-bold px-3 py-1 rounded-full text-sm text-white"
                                            style={{ backgroundColor: selectedPoint.riskColor }}
                                        >
                                            {selectedPoint.riskLevel}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-2xl p-6 mb-6">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <i className="fas fa-exclamation-triangle text-orange-600"></i>
                                Factores de Riesgo Identificados
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {selectedPoint.riskFactors.map((factor: string, index: number) => (
                                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-xl">
                                        <div
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: selectedPoint.riskColor }}
                                        ></div>
                                        <span className="text-slate-700">{factor}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-50 rounded-2xl p-6">
                            <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <i className="fas fa-lightbulb text-blue-600"></i>
                                Recomendaciones de Auditoría
                            </h4>
                            <div className="space-y-2 text-sm text-slate-700">
                                {selectedPoint.riskLevel === 'ALTO' && (
                                    <>
                                        <div className="flex items-start gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-2"></div>
                                            <span>Incluir obligatoriamente en la muestra de auditoría</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-2"></div>
                                            <span>Realizar procedimientos de auditoría extendidos</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-2"></div>
                                            <span>Solicitar documentación soporte adicional</span>
                                        </div>
                                    </>
                                )}
                                {selectedPoint.riskLevel === 'MEDIO' && (
                                    <>
                                        <div className="flex items-start gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-2"></div>
                                            <span>Considerar para inclusión en muestra dirigida</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 mt-2"></div>
                                            <span>Aplicar procedimientos de revisión analítica</span>
                                        </div>
                                    </>
                                )}
                                {selectedPoint.riskLevel === 'BAJO' && (
                                    <>
                                        <div className="flex items-start gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-2"></div>
                                            <span>Transacción con perfil de riesgo normal</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 mt-2"></div>
                                            <span>Aplicar procedimientos de auditoría estándar</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-8">
                            <button
                                onClick={() => setShowPointModal(false)}
                                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-all"
                            >
                                Cerrar
                            </button>
                            <button
                                onClick={() => {
                                    // Aquí podrías agregar funcionalidad para marcar para auditoría
                                    addToast(`Transacción ${selectedPoint.id} marcada para revisión detallada`, 'info');
                                    setShowPointModal(false);
                                }}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <i className="fas fa-bookmark"></i>
                                Marcar para Auditoría
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-center pt-10">
                <button
                    onClick={handleComplete}
                    className={`${isMobile ? 'px-12 py-5 w-full' : 'px-24 py-7'} bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-black transition-all transform hover:-translate-y-1 flex items-center justify-center`}
                >
                    Confirmar Perfilado <i className="fas fa-chevron-right ml-6 text-cyan-400"></i>
                </button>
            </div>
        </div>
    );
};

export default RiskProfiler;
