import React from 'react';
import Modal from '../ui/Modal';

interface ForensicDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysisType: string;
    analysisData: any;
    title: string;
}

const ForensicDetailsModal: React.FC<ForensicDetailsModalProps> = ({
    isOpen,
    onClose,
    analysisType,
    analysisData,
    title
}) => {
    const renderBenfordDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-bold text-amber-800 mb-2">📊 Análisis de Distribución de Dígitos</h4>
                <p className="text-sm text-amber-700 mb-3">
                    La Ley de Benford establece que en conjuntos de datos naturales, el dígito 1 aparece ~30.1% de las veces, 
                    el 2 ~17.6%, etc. Desviaciones significativas pueden indicar manipulación.
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="px-3 py-2 text-left">Dígito</th>
                            <th className="px-3 py-2 text-right">Esperado</th>
                            <th className="px-3 py-2 text-right">Observado</th>
                            <th className="px-3 py-2 text-right">Desviación</th>
                            <th className="px-3 py-2 text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.benford?.map((digit: any, idx: number) => {
                            const deviation = Math.abs(digit.actual - digit.expected);
                            return (
                                <tr key={idx} className={digit.isSuspicious ? 'bg-red-50' : 'bg-white'}>
                                    <td className="px-3 py-2 font-mono font-bold">{digit.digit}</td>
                                    <td className="px-3 py-2 text-right">{digit.expected.toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right">{digit.actual.toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right">
                                        <span className={deviation > 5 ? 'text-red-600 font-bold' : 'text-slate-600'}>
                                            {deviation > 0 ? '+' : ''}{(digit.actual - digit.expected).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {digit.isSuspicious ? (
                                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">
                                                🚨 SOSPECHOSO
                                            </span>
                                        ) : (
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                                ✅ Normal
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-600">
                    <strong>Interpretación:</strong> Dígitos marcados como "SOSPECHOSO" tienen desviaciones &gt; 5% 
                    respecto a la distribución natural esperada. Esto puede indicar manipulación manual de datos.
                </p>
            </div>
        </div>
    );

    const renderEnhancedBenfordDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <h4 className="font-bold text-violet-800 mb-2">📈 Benford Avanzado - Análisis de Segundo Dígito</h4>
                <p className="text-sm text-violet-700 mb-3">
                    El análisis de segundo dígito es más sensible para detectar manipulación sutil. 
                    MAD (Mean Absolute Deviation) &lt; 4% = Aceptable, 4-8% = Marginal, &gt; 8% = No conforme.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border rounded-lg p-4">
                    <h5 className="font-bold text-slate-800 mb-2">Primer Dígito</h5>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span>MAD:</span>
                            <span className="font-mono">{data?.enhancedBenford?.firstDigitDeviation?.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Significativo:</span>
                            <span className={data?.enhancedBenford?.isFirstDigitSignificant ? 'text-red-600' : 'text-green-600'}>
                                {data?.enhancedBenford?.isFirstDigitSignificant ? '⚠️ Sí' : '✅ No'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border rounded-lg p-4">
                    <h5 className="font-bold text-slate-800 mb-2">Segundo Dígito</h5>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span>MAD:</span>
                            <span className="font-mono">{data?.enhancedBenford?.secondDigitDeviation?.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Significativo:</span>
                            <span className={data?.enhancedBenford?.isSecondDigitSignificant ? 'text-red-600' : 'text-green-600'}>
                                {data?.enhancedBenford?.isSecondDigitSignificant ? '⚠️ Sí' : '✅ No'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-100 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">Desviación General (MAD):</span>
                    <span className="text-2xl font-mono font-bold">{data?.enhancedBenford?.overallDeviation?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">Nivel de Conformidad:</span>
                    <span className={`px-3 py-1 rounded font-bold text-sm ${
                        data?.enhancedBenford?.conformityRiskLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                        data?.enhancedBenford?.conformityRiskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                    }`}>
                        {data?.enhancedBenford?.conformityLevel}
                    </span>
                </div>
                <p className="text-sm text-slate-600 mt-2">
                    {data?.enhancedBenford?.conformityDescription}
                </p>
            </div>
        </div>
    );

    const renderIsolationForestDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-bold text-green-800 mb-2">🧠 Machine Learning - Isolation Forest</h4>
                <p className="text-sm text-green-700 mb-3">
                    Algoritmo de IA que detecta anomalías multidimensionales construyendo árboles de decisión aleatorios. 
                    Las anomalías requieren menos divisiones para ser aisladas.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{data?.isolationForest?.totalAnomalies || 0}</div>
                    <div className="text-sm text-slate-600">Total Anomalías</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{data?.isolationForest?.highRiskAnomalies || 0}</div>
                    <div className="text-sm text-slate-600">Alto Riesgo</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-600">{data?.isolationForest?.averagePathLength?.toFixed(2) || 0}</div>
                    <div className="text-sm text-slate-600">Path Length Promedio</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="font-bold text-slate-800 mb-2">Criterios de Clasificación:</h5>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>🔴 Alto Riesgo:</span>
                        <span>Anomaly Score &gt; 0.6</span>
                    </div>
                    <div className="flex justify-between">
                        <span>🟡 Riesgo Medio:</span>
                        <span>Anomaly Score 0.4 - 0.6</span>
                    </div>
                    <div className="flex justify-between">
                        <span>🟢 Riesgo Bajo:</span>
                        <span>Anomaly Score &lt; 0.4</span>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                    <strong>Variables analizadas:</strong> Monto, fecha, categoría, subcategoría, usuario. 
                    El algoritmo identifica patrones complejos que métodos tradicionales no detectan.
                </p>
            </div>
        </div>
    );

    const renderEntropyDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h4 className="font-bold text-indigo-800 mb-2">🔍 Análisis de Entropía Categórica</h4>
                <p className="text-sm text-indigo-700 mb-3">
                    Mide la "sorpresa" o irregularidad en combinaciones de categorías. 
                    Combinaciones muy raras pueden indicar errores de clasificación o manipulación.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border rounded-lg p-4">
                    <h5 className="font-bold text-slate-800 mb-3">Métricas de Entropía</h5>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Entropía Categoría:</span>
                            <span className="font-mono">{data?.entropy?.categoryEntropy?.toFixed(2) || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Entropía Subcategoría:</span>
                            <span className="font-mono">{data?.entropy?.subcategoryEntropy?.toFixed(2) || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Información Mutua:</span>
                            <span className="font-mono">{data?.entropy?.mutualInformation?.toFixed(2) || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border rounded-lg p-4">
                    <h5 className="font-bold text-slate-800 mb-3">Anomalías Detectadas</h5>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Total Anomalías:</span>
                            <span className="font-bold text-indigo-600">{data?.entropy?.anomalousCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Alto Riesgo:</span>
                            <span className="font-bold text-red-600">{data?.entropy?.highRiskCombinations || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="font-bold text-slate-800 mb-2">Criterios de Detección:</h5>
                <div className="space-y-1 text-sm text-slate-600">
                    <div>• <strong>Alto Riesgo:</strong> Combinaciones únicas (aparecen solo 1 vez)</div>
                    <div>• <strong>Riesgo Medio:</strong> Combinaciones muy raras (&lt; 1% del total)</div>
                    <div>• <strong>Riesgo Bajo:</strong> Combinaciones raras (&lt; 2% del total)</div>
                </div>
            </div>
        </div>
    );

    const renderSplittingDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-800 mb-2">✂️ Detección de Fraccionamiento</h4>
                <p className="text-sm text-red-700 mb-3">
                    Identifica compras divididas artificialmente para evadir umbrales de autorización. 
                    Analiza múltiples transacciones del mismo proveedor en ventanas de tiempo.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{data?.splitting?.highRiskGroups || 0}</div>
                    <div className="text-sm text-slate-600">Grupos Alto Riesgo</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{data?.splitting?.suspiciousVendors || 0}</div>
                    <div className="text-sm text-slate-600">Proveedores Sospechosos</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{data?.splitting?.totalSuspiciousTransactions || 0}</div>
                    <div className="text-sm text-slate-600">Transacciones Sospechosas</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-600">{data?.splitting?.averageRiskScore?.toFixed(1) || 0}</div>
                    <div className="text-sm text-slate-600">Score Promedio</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="font-bold text-slate-800 mb-2">Umbrales de Detección:</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div className="bg-white p-2 rounded">$1,000</div>
                    <div className="bg-white p-2 rounded">$5,000</div>
                    <div className="bg-white p-2 rounded">$10,000</div>
                    <div className="bg-white p-2 rounded">$25,000</div>
                    <div className="bg-white p-2 rounded">$50,000</div>
                    <div className="bg-white p-2 rounded">$100,000</div>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                    Se detecta fraccionamiento cuando la suma de transacciones de un proveedor en 30 días 
                    excede un umbral, pero cada transacción individual está por debajo del 90% del umbral.
                </p>
            </div>
        </div>
    );

    const renderSequentialDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-bold text-yellow-800 mb-2">📋 Análisis de Integridad Secuencial</h4>
                <p className="text-sm text-yellow-700 mb-3">
                    Detecta saltos en la numeración secuencial de documentos que pueden indicar 
                    eliminación, manipulación o documentos faltantes.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{data?.sequential?.highRiskGaps || 0}</div>
                    <div className="text-sm text-slate-600">Gaps Críticos</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{data?.sequential?.totalGaps || 0}</div>
                    <div className="text-sm text-slate-600">Total Gaps</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{data?.sequential?.largestGap || 0}</div>
                    <div className="text-sm text-slate-600">Gap Más Grande</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-600">{data?.sequential?.totalMissingDocuments || 0}</div>
                    <div className="text-sm text-slate-600">Docs. Faltantes</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="font-bold text-slate-800 mb-2">Criterios de Clasificación:</h5>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span>🔴 Gap Crítico:</span>
                        <span>Salto &gt; 10 documentos consecutivos</span>
                    </div>
                    <div className="flex justify-between">
                        <span>🟡 Gap Medio:</span>
                        <span>Salto 5-10 documentos</span>
                    </div>
                    <div className="flex justify-between">
                        <span>🟢 Gap Menor:</span>
                        <span>Salto &lt; 5 documentos</span>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                    <strong>Variable analizada:</strong> {data?.sequential?.fieldAnalyzed || 'Cod_solicitud'}. 
                    Se extraen los números secuenciales y se detectan saltos anómalos en la numeración.
                </p>
            </div>
        </div>
    );

    const renderActorProfilingDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <h4 className="font-bold text-pink-800 mb-2">🕵️ Perfilado de Actores</h4>
                <p className="text-sm text-pink-700 mb-3">
                    Analiza patrones de comportamiento de usuarios para identificar actividad anómala, 
                    transacciones fuera de horario o volúmenes inusuales.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{data?.actorProfiling?.highRiskActors || 0}</div>
                    <div className="text-sm text-slate-600">Actores Alto Riesgo</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">{data?.actorProfiling?.totalSuspiciousActors || 0}</div>
                    <div className="text-sm text-slate-600">Total Sospechosos</div>
                </div>
                <div className="bg-white border rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-600">{data?.actorProfiling?.averageRiskScore?.toFixed(1) || 0}</div>
                    <div className="text-sm text-slate-600">Score Promedio</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="font-bold text-slate-800 mb-2">Patrones Analizados:</h5>
                <div className="space-y-2 text-sm text-slate-600">
                    <div>• <strong>Actividad Temporal:</strong> Transacciones en fines de semana y fuera de horario</div>
                    <div>• <strong>Volumen de Transacciones:</strong> Cantidad inusual de operaciones</div>
                    <div>• <strong>Montos Promedio:</strong> Desviaciones significativas del comportamiento normal</div>
                    <div>• <strong>Patrones de Comportamiento:</strong> {data?.actorProfiling?.behaviorPatterns || 0} patrones detectados</div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                    <strong>Variables analizadas:</strong> Usuario, monto, fecha/hora de transacción. 
                    Se compara el comportamiento individual contra patrones normales del grupo.
                </p>
            </div>
        </div>
    );

    const renderOutliersDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-bold text-purple-800 mb-2">📊 Análisis de Valores Atípicos (IQR)</h4>
                <p className="text-sm text-purple-700 mb-3">
                    Utiliza el método del Rango Intercuartílico (IQR) para identificar valores que se desvían 
                    significativamente de la distribución normal de la población.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border rounded-lg p-4">
                    <h5 className="font-bold text-slate-800 mb-3">Estadísticas de Distribución</h5>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Outliers Detectados:</span>
                            <span className="font-bold text-purple-600">{data?.outliersCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Umbral IQR:</span>
                            <span className="font-mono">${(data?.outliersThreshold || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border rounded-lg p-4">
                    <h5 className="font-bold text-slate-800 mb-3">Método de Cálculo</h5>
                    <div className="space-y-1 text-xs text-slate-600">
                        <div>Q1 = Percentil 25</div>
                        <div>Q3 = Percentil 75</div>
                        <div>IQR = Q3 - Q1</div>
                        <div>Umbral = Q3 + (1.5 × IQR)</div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-600">
                    <strong>Interpretación:</strong> Los valores que exceden el umbral IQR son considerados atípicos 
                    y pueden representar transacciones inusuales que requieren investigación adicional.
                </p>
            </div>
        </div>
    );

    const renderDuplicatesDetails = (data: any) => (
        <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-bold text-orange-800 mb-2">🔄 Detección Inteligente de Duplicados</h4>
                <p className="text-sm text-orange-700 mb-3">
                    Utiliza estrategia adaptativa basada en el mapeo de columnas disponible para detectar 
                    transacciones potencialmente duplicadas.
                </p>
            </div>

            <div className="bg-white border rounded-lg p-4">
                <h5 className="font-bold text-slate-800 mb-3">Duplicados Encontrados</h5>
                <div className="text-center">
                    <div className="text-4xl font-bold text-orange-600 mb-2">{data?.duplicatesCount || 0}</div>
                    <div className="text-sm text-slate-600">Transacciones Repetidas</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
                <h5 className="font-bold text-slate-800 mb-2">Estrategia de Detección:</h5>
                <div className="space-y-2 text-sm text-slate-600">
                    <div>• <strong>Nivel 1:</strong> Campo Único + Monto (si hay valor monetario)</div>
                    <div>• <strong>Nivel 2:</strong> Campo Único + Categoría + Subcategoría (si no hay monto)</div>
                    <div>• <strong>Nivel 3:</strong> Solo Campo Único (configuración básica)</div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    La estrategia se adapta automáticamente según las columnas mapeadas en la configuración.
                </p>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (analysisType) {
            case 'Benford':
                return renderBenfordDetails(analysisData);
            case 'EnhancedBenford':
                return renderEnhancedBenfordDetails(analysisData);
            case 'IsolationForest':
                return renderIsolationForestDetails(analysisData);
            case 'Entropy':
                return renderEntropyDetails(analysisData);
            case 'Splitting':
                return renderSplittingDetails(analysisData);
            case 'Sequential':
                return renderSequentialDetails(analysisData);
            case 'ActorProfiling':
                return renderActorProfilingDetails(analysisData);
            case 'Outliers':
                return renderOutliersDetails(analysisData);
            case 'Duplicates':
                return renderDuplicatesDetails(analysisData);
            default:
                return (
                    <div className="text-center py-8">
                        <p className="text-slate-500">Detalles no disponibles para este tipo de análisis.</p>
                    </div>
                );
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="max-w-4xl mx-auto">
                {renderContent()}
            </div>
        </Modal>
    );
};

export default ForensicDetailsModal;