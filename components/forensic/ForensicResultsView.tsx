import React, { useState, useMemo } from 'react';
import { AdvancedAnalysis, AuditPopulation } from '../../types';
import Modal from '../ui/Modal';
import ForensicDetailsModal from './ForensicDetailsModal';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';
import { generateForensicReport } from '../../services/forensicReportService';

interface Props {
    population: AuditPopulation;
    analysis: AdvancedAnalysis;
    onClose: () => void;
    riskChartData?: {
        upperErrorLimit: number;
        tolerableError: number;
        method: string;
    };
}

interface ForensicMetric {
    id: string;
    title: string;
    value: number | string;
    description: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'INFO';
    hasDetails: boolean;
    icon: string;
}

const ForensicResultsView: React.FC<Props> = ({ population, analysis, onClose, riskChartData }) => {
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailType, setDetailType] = useState<string | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // Construir métricas forenses
    const forensicMetrics: ForensicMetric[] = useMemo(() => {
        const metrics: ForensicMetric[] = [];

        // 1. Análisis de Entropía
        if (analysis.entropy) {
            metrics.push({
                id: 'entropy_anomalies',
                title: 'Anomalías Categóricas',
                value: analysis.entropy.anomalousCount,
                description: `${analysis.entropy.highRiskCombinations} combinaciones de alto riesgo detectadas`,
                riskLevel: analysis.entropy.highRiskCombinations > 0 ? 'HIGH' : 'INFO',
                hasDetails: analysis.entropy.anomalousCount > 0,
                icon: 'fa-microchip'
            });

            metrics.push({
                id: 'entropy_info',
                title: 'Información Mutua',
                value: `${analysis.entropy.mutualInformation.toFixed(3)} bits`,
                description: 'Relación entre categorías principales y subcategorías',
                riskLevel: 'INFO',
                hasDetails: false,
                icon: 'fa-info-circle'
            });
        }

        // 2. Detección de Fraccionamiento
        if (analysis.splitting) {
            metrics.push({
                id: 'splitting_vendors',
                title: 'Proveedores Sospechosos',
                value: analysis.splitting.suspiciousVendors,
                description: `${analysis.splitting.highRiskGroups} grupos de alto riesgo por fraccionamiento`,
                riskLevel: analysis.splitting.highRiskGroups > 0 ? 'HIGH' : 
                          analysis.splitting.suspiciousVendors > 0 ? 'MEDIUM' : 'LOW',
                hasDetails: analysis.splitting.suspiciousVendors > 0,
                icon: 'fa-scissors'
            });

            metrics.push({
                id: 'splitting_transactions',
                title: 'Transacciones Fraccionadas',
                value: analysis.splitting.totalSuspiciousTransactions,
                description: `Score promedio de riesgo: ${analysis.splitting.averageRiskScore.toFixed(1)}`,
                riskLevel: analysis.splitting.averageRiskScore > 40 ? 'HIGH' : 
                          analysis.splitting.averageRiskScore > 20 ? 'MEDIUM' : 'LOW',
                hasDetails: analysis.splitting.totalSuspiciousTransactions > 0,
                icon: 'fa-exclamation-triangle'
            });
        }

        // 3. Integridad Secuencial
        if (analysis.sequential) {
            metrics.push({
                id: 'sequential_gaps',
                title: 'Gaps Secuenciales',
                value: analysis.sequential.totalGaps,
                description: `${analysis.sequential.totalMissingDocuments} documentos faltantes`,
                riskLevel: analysis.sequential.highRiskGaps > 0 ? 'HIGH' : 
                          analysis.sequential.totalGaps > 0 ? 'MEDIUM' : 'LOW',
                hasDetails: analysis.sequential.totalGaps > 0,
                icon: 'fa-barcode'
            });

            if (analysis.sequential.largestGap > 0) {
                metrics.push({
                    id: 'largest_gap',
                    title: 'Gap Más Grande',
                    value: analysis.sequential.largestGap,
                    description: `${analysis.sequential.suspiciousPatterns} patrones sospechosos detectados`,
                    riskLevel: analysis.sequential.largestGap > 50 ? 'HIGH' : 
                              analysis.sequential.largestGap > 10 ? 'MEDIUM' : 'LOW',
                    hasDetails: false,
                    icon: 'fa-exclamation'
                });
            }
        }

        // 4. Isolation Forest
        if (analysis.isolationForest) {
            metrics.push({
                id: 'isolation_forest',
                title: 'ML Anomalías',
                value: analysis.isolationForest.totalAnomalies,
                description: `${analysis.isolationForest.highRiskAnomalies} anomalías de alto riesgo detectadas por IA`,
                riskLevel: analysis.isolationForest.highRiskAnomalies > 0 ? 'HIGH' : 
                          analysis.isolationForest.totalAnomalies > 5 ? 'MEDIUM' : 'LOW',
                hasDetails: analysis.isolationForest.totalAnomalies > 0,
                icon: 'fa-brain'
            });
        }

        // 5. Actor Profiling
        if (analysis.actorProfiling) {
            metrics.push({
                id: 'actor_profiling',
                title: 'Actores Sospechosos',
                value: analysis.actorProfiling.totalSuspiciousActors,
                description: `${analysis.actorProfiling.highRiskActors} actores de alto riesgo identificados`,
                riskLevel: analysis.actorProfiling.highRiskActors > 0 ? 'HIGH' : 
                          analysis.actorProfiling.totalSuspiciousActors > 0 ? 'MEDIUM' : 'LOW',
                hasDetails: analysis.actorProfiling.totalSuspiciousActors > 0,
                icon: 'fa-user-secret'
            });
        }

        // 6. Enhanced Benford
        if (analysis.enhancedBenford) {
            metrics.push({
                id: 'enhanced_benford',
                title: 'Benford Mejorado',
                value: `${analysis.enhancedBenford.overallDeviation.toFixed(1)}%`,
                description: `MAD: ${analysis.enhancedBenford.overallDeviation.toFixed(2)}% - ${analysis.enhancedBenford.conformityLevel}`,
                riskLevel: analysis.enhancedBenford.conformityRiskLevel === 'HIGH' ? 'HIGH' : 
                          analysis.enhancedBenford.conformityRiskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW',
                hasDetails: true,
                icon: 'fa-chart-line'
            });
        }

        // 7. Análisis Tradicionales
        metrics.push({
            id: 'benford_anomalies',
            title: 'Anomalías de Benford',
            value: analysis.benford.filter(b => b.isSuspicious).length,
            description: 'Dígitos con frecuencias anómalas detectados',
            riskLevel: analysis.benford.filter(b => b.isSuspicious).length > 2 ? 'MEDIUM' : 'INFO',
            hasDetails: analysis.benford.filter(b => b.isSuspicious).length > 0,
            icon: 'fa-chart-bar'
        });

        metrics.push({
            id: 'outliers',
            title: 'Valores Atípicos',
            value: analysis.outliersCount,
            description: `Umbral IQR: ${analysis.outliersThreshold.toLocaleString()}`,
            riskLevel: analysis.outliersCount > 10 ? 'HIGH' : 
                      analysis.outliersCount > 5 ? 'MEDIUM' : 'LOW',
            hasDetails: analysis.outliersCount > 0,
            icon: 'fa-expand-arrows-alt'
        });

        metrics.push({
            id: 'duplicates',
            title: 'Duplicados',
            value: analysis.duplicatesCount,
            description: 'Transacciones potencialmente duplicadas',
            riskLevel: analysis.duplicatesCount > 5 ? 'HIGH' : 
                      analysis.duplicatesCount > 0 ? 'MEDIUM' : 'LOW',
            hasDetails: analysis.duplicatesCount > 0,
            icon: 'fa-copy'
        });

        metrics.push({
            id: 'round_numbers',
            title: 'Números Redondos',
            value: analysis.roundNumbersCount,
            description: 'Montos que son múltiplos exactos',
            riskLevel: analysis.roundNumbersCount > population.total_rows * 0.3 ? 'MEDIUM' : 'INFO',
            hasDetails: analysis.roundNumbersCount > 0,
            icon: 'fa-circle'
        });

        return metrics;
    }, [analysis, population]);

    // Generar conclusión automática
    const generateConclusion = (): string => {
        const highRiskMetrics = forensicMetrics.filter(m => m.riskLevel === 'HIGH');
        const mediumRiskMetrics = forensicMetrics.filter(m => m.riskLevel === 'MEDIUM');
        
        if (highRiskMetrics.length === 0 && mediumRiskMetrics.length === 0) {
            return "✅ La población presenta un perfil de riesgo BAJO. No se detectaron anomalías significativas que requieran atención inmediata. Se recomienda proceder con muestreo estadístico estándar.";
        }
        
        if (highRiskMetrics.length > 0) {
            const issues = highRiskMetrics.map(m => m.title.toLowerCase()).join(', ');
            return `🚨 La población presenta un perfil de riesgo ALTO debido a: ${issues}. Se recomienda muestreo dirigido enfocado en estas anomalías y revisión detallada de los hallazgos antes de proceder.`;
        }
        
        if (mediumRiskMetrics.length > 0) {
            const issues = mediumRiskMetrics.map(m => m.title.toLowerCase()).join(', ');
            return `⚠️ La población presenta un perfil de riesgo MEDIO con: ${issues}. Se recomienda aumentar el tamaño de muestra y considerar muestreo estratificado para abordar estas áreas de riesgo.`;
        }
        
        return "ℹ️ Análisis completado. Revisar métricas individuales para determinar estrategia de muestreo apropiada.";
    };

    const handleShowDetails = (metricId: string, title: string) => {
        // Mapear el metricId al tipo de análisis correspondiente
        let analysisType = '';
        
        switch (metricId) {
            case 'benford_anomalies':
                analysisType = 'Benford';
                break;
            case 'enhanced_benford':
                analysisType = 'EnhancedBenford';
                break;
            case 'isolation_forest':
                analysisType = 'IsolationForest';
                break;
            case 'entropy_anomalies':
                analysisType = 'Entropy';
                break;
            case 'splitting_vendors':
            case 'splitting_transactions':
                analysisType = 'Splitting';
                break;
            case 'sequential_gaps':
            case 'largest_gap':
                analysisType = 'Sequential';
                break;
            case 'actor_profiling':
                analysisType = 'ActorProfiling';
                break;
            case 'outliers':
                analysisType = 'Outliers';
                break;
            case 'duplicates':
                analysisType = 'Duplicates';
                break;
            default:
                analysisType = metricId;
        }
        
        setDetailType(analysisType);
        setDetailModalOpen(true);
    };

    const getRiskLevelColor = (level: string): string => {
        switch (level) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
            case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
            default: return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };

    const getRiskLevelIcon = (level: string): string => {
        switch (level) {
            case 'HIGH': return 'fa-exclamation-triangle text-red-500';
            case 'MEDIUM': return 'fa-exclamation-circle text-yellow-500';
            case 'LOW': return 'fa-check-circle text-green-500';
            default: return 'fa-info-circle text-blue-500';
        }
    };

    const handleExportReport = async () => {
        if (isGeneratingReport) return;
        
        setIsGeneratingReport(true);
        try {
            await generateForensicReport({
                population,
                analysis,
                riskChartData,
                generatedBy: 'Auditor Principal',
                generatedDate: new Date()
            });
            
            console.log('Reporte forense generado exitosamente');
        } catch (error) {
            console.error('Error generando reporte forense:', error);
            alert('Error al generar el reporte forense');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold">🔬 Análisis Forense Completo</h2>
                            <p className="text-purple-100 mt-1">
                                Población: {population.audit_name} • {population.total_rows.toLocaleString()} registros
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleExportReport}
                                disabled={isGeneratingReport}
                                className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-bold text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGeneratingReport ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin mr-2"></i>
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-file-pdf mr-2"></i>
                                        Exportar PDF
                                    </>
                                )}
                            </button>
                            <button
                                onClick={onClose}
                                className="text-white hover:text-purple-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Métricas Forenses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {forensicMetrics.map((metric) => (
                            <div
                                key={metric.id}
                                className={`border rounded-lg p-4 ${getRiskLevelColor(metric.riskLevel)} ${
                                    metric.hasDetails ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                                }`}
                                onClick={metric.hasDetails ? () => handleShowDetails(metric.id, metric.title) : undefined}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                        <i className={`fas ${metric.icon} mr-2`}></i>
                                        <h3 className="font-semibold">{metric.title}</h3>
                                    </div>
                                    <div className="flex items-center">
                                        <i className={`fas ${getRiskLevelIcon(metric.riskLevel)} mr-1`}></i>
                                        {metric.hasDetails && (
                                            <i className="fas fa-external-link-alt text-xs ml-1"></i>
                                        )}
                                    </div>
                                </div>
                                <div className="text-2xl font-bold mb-1">{metric.value}</div>
                                <div className="text-sm opacity-75">{metric.description}</div>
                            </div>
                        ))}
                    </div>

                    {/* Conclusión Automática */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                            Conclusión del Análisis Forense
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                            {generateConclusion()}
                        </p>
                    </div>

                    {/* Recomendaciones */}
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-3 flex items-center text-blue-800">
                            <i className="fas fa-clipboard-list mr-2"></i>
                            Recomendaciones de Muestreo
                        </h3>
                        <ul className="space-y-2 text-blue-700">
                            {forensicMetrics.filter(m => m.riskLevel === 'HIGH').length > 0 && (
                                <li className="flex items-start">
                                    <i className="fas fa-arrow-right text-blue-500 mr-2 mt-1"></i>
                                    Utilizar muestreo dirigido enfocado en las anomalías de alto riesgo detectadas
                                </li>
                            )}
                            {analysis.splitting && analysis.splitting.suspiciousVendors > 0 && (
                                <li className="flex items-start">
                                    <i className="fas fa-arrow-right text-blue-500 mr-2 mt-1"></i>
                                    Revisar manualmente los proveedores con patrones de fraccionamiento
                                </li>
                            )}
                            {analysis.sequential && analysis.sequential.totalGaps > 0 && (
                                <li className="flex items-start">
                                    <i className="fas fa-arrow-right text-blue-500 mr-2 mt-1"></i>
                                    Investigar los gaps secuenciales para determinar causa de documentos faltantes
                                </li>
                            )}
                            <li className="flex items-start">
                                <i className="fas fa-arrow-right text-blue-500 mr-2 mt-1"></i>
                                Considerar aumentar el tamaño de muestra en áreas de riesgo identificadas
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Modal de Detalles Forenses */}
            <ForensicDetailsModal
                isOpen={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                analysisType={detailType || ''}
                analysisData={analysis}
                title={`Detalles: ${detailType}`}
            />
        </div>
    );
};

export default ForensicResultsView;