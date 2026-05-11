
import React, { useState, useMemo } from 'react';
import { AppState, AdvancedAnalysis, InsightType } from '../../types';
import Modal from '../ui/Modal';
import ForensicResultsView from '../forensic/ForensicResultsView';
import ForensicConfigModal from '../forensic/ForensicConfigModal';
import ForensicExplanationModal, { FORENSIC_METHODS } from '../forensic/ForensicExplanationModal';
import ForensicAnomaliesModal from '../forensic/ForensicAnomaliesModal';
import {
    BarChart, Bar, ResponsiveContainer, Cell
} from 'recharts';
import { supabase } from '../../services/supabaseClient';
import { utils, writeFile } from 'xlsx';
import { samplingProxyFetch, FetchTimeoutError, FetchNetworkError } from '../../services/fetchUtils';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const NonStatisticalSampling: React.FC<Props> = ({ appState, setAppState }) => {
    const params = appState.samplingParams.nonStatistical;
    const analysis = appState.selectedPopulation?.advanced_analysis;



    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailType, setDetailType] = useState<string | null>(null);
    const [detailItems, setDetailItems] = useState<any[]>([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [selectedInsight, setSelectedInsight] = useState<InsightType | null>(null);

    const [explanationOpen, setExplanationOpen] = useState(false);
    const [explanationContent, setExplanationContent] = useState({ title: '', text: '', auditImpact: '' });

    // Estados para análisis forense
    const [forensicResultsOpen, setForensicResultsOpen] = useState(false);
    const [forensicConfigOpen, setForensicConfigOpen] = useState(false);
    const [isRunningForensicAnalysis, setIsRunningForensicAnalysis] = useState(false);
    const [forensicResults, setForensicResults] = useState<AdvancedAnalysis | null>(null);

    // Estados para modal explicativo
    const [explanationModalOpen, setExplanationModalOpen] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

    // Estados para modal de anomalías
    const [anomaliesModalOpen, setAnomaliesModalOpen] = useState(false);
    const [selectedAnomalyType, setSelectedAnomalyType] = useState<string | null>(null);
    const [selectedAnomalyTitle, setSelectedAnomalyTitle] = useState<string>('');

    // Estados para vista jerárquica
    const [expandedRiskLevels, setExpandedRiskLevels] = useState<Set<string>>(new Set(['Alto'])); // Alto expandido por defecto
    const [expandedAnalysisTypes, setExpandedAnalysisTypes] = useState<Set<string>>(new Set());

    const EDA_EXPLANATIONS = useMemo(() => {
        const gapAlerts = appState.selectedPopulation?.risk_profile?.gapAlerts || 0;
        const suggestedN = 30 + (gapAlerts * 5);

        return {
            NET_VALUE: {
                title: "Valor Neto de la Población",
                text: "Suma de todos los registros (Positivos + Negativos). Fórmula: Σ(Balance_i).",
                auditImpact: "Representa el saldo contable objeto de auditoría. Permite validar la integridad de la carga contra el balance general."
            },
            ABS_VALUE: {
                title: "Masa Monetaria (Valor Absoluto)",
                text: "Suma de los valores absolutos: Σ|Balance_i|. Ignora los signos para medir la exposición real.",
                auditImpact: "Es el universo real de riesgo. Un error positivo de $1M y uno negativo de $1M no se compensan para el auditor; representan $2M en riesgo de auditoría."
            },
            MEAN: {
                title: "Valor Medio (Promedio)",
                text: "Promedio simple de la población: ΣX / n.",
                auditImpact: "Sirve como base para proyectar errores. Una desviación grande entre la media y la mediana sugiere una población muy sesgada."
            },
            STD_DEV: {
                title: "Desviación Estándar (Sigma)",
                text: "Mide la dispersión de los datos respecto a la media. Fórmula: sqrt(Σ(x - μ)² / (n-1)).",
                auditImpact: "A mayor Sigma, mayor es el riesgo de que la muestra aleatoria no sea representativa. Indica alta volatilidad en los montos de transacción."
            },
            SKEWNESS: {
                title: "Coeficiente de Asimetría",
                text: "Indica hacia dónde se inclina el peso de la masa monetaria. (n / ((n-1)(n-2))) * Σ((x-μ)/s)³.",
                auditImpact: "Asimetría > 0.5 indica concentración en valores altos. Es crucial para decidir si se requiere una segregación de estratos de certeza."
            },
            SAMPLE_SIZE: {
                title: "Alcance de la Muestra (n)",
                text: `Fórmula aplicada: n = Base(30) + (Gaps de Riesgo * Factor_Ponderación(5))\n\nSustitución: n = 30 + (${gapAlerts} * 5) = ${suggestedN} unidades.`,
                auditImpact: `Incrementa progresivamente la cobertura en función de las anomalías detectadas. A mayor cantidad de 'Gaps' críticos (${gapAlerts}), mayor es el esfuerzo requerido.`
            },
            SMART_SELECTION: {
                title: "Selección Inteligente por Riesgo",
                text: "Algoritmo multivariable que prioriza ítems con intersección de banderas rojas (Benford + Outlier + Duplicado + Redondo).",
                auditImpact: "Optimiza el tiempo del auditor al enfocarse en los 'registros de mayor riesgo' en lugar de una selección aleatoria de bajo valor agregado."
            },
            RSF: {
                title: "Ratio de Tamaño Relativo (RSF)",
                text: "Cálculo: Valor Máximo / Segundo Valor Máximo.",
                auditImpact: "Detección de Outliers Extremos: Un ratio > 5-10 sugiere que el registro más alto es anómalo comparado con el resto, indicando posibles errores de digitación o fraude."
            },
            DATE_STATS: {
                title: "Análisis Cronológico",
                text: "Evaluación de la distribución temporal de transacciones y detección de actividad en días no hábiles.",
                auditImpact: "Identifica riesgos de control interno y transacciones extemporáneas."
            },
            CHAR_STATS: {
                title: "Calidad de Datos Maestros",
                text: "Evaluación de campos de texto, detección de duplicidades y registros incompletos.",
                auditImpact: "Detecta transacciones con autorizadores ausentes o descripciones genéricas sospechosas."
            }
        };
    }, [appState.selectedPopulation]);

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getBenfordAnomalyCount = () => {
        if (!analysis?.benford) return 0;
        // Count DIGITS that are suspicious, not total records
        return analysis.benford.filter(b => b.isSuspicious).length;
    };

    // Funciones helper para los nuevos análisis - AHORA SUMAN ALTO + MEDIO RIESGO
    const getEntropyAnomalies = () => {
        return analysis?.entropy?.anomalousCount || 0;
    };

    const getSplittingGroups = () => {
        // Sumar suspiciousVendors (total) en lugar de highRiskGroups
        return analysis?.splitting?.suspiciousVendors || 0;
    };

    const getSequentialGaps = () => {
        // Sumar totalGaps en lugar de highRiskGaps
        return analysis?.sequential?.totalGaps || 0;
    };

    const getIsolationForestAnomalies = () => {
        // Sumar totalAnomalies en lugar de highRiskAnomalies
        return analysis?.isolationForest?.totalAnomalies || 0;
    };

    const getSuspiciousActors = () => {
        // Sumar totalSuspiciousActors en lugar de highRiskActors
        return analysis?.actorProfiling?.totalSuspiciousActors || 0;
    };

    const getEnhancedBenfordDeviation = () => {
        return analysis?.enhancedBenford?.overallDeviation || 0;
    };

    const handleInsightSelection = (type: InsightType) => {
        setSelectedInsight(type);
        let criteria = "";
        let justification = "";
        const criticality = params.processCriticality || 'Medio';

        switch (type) {
            case 'RiskScoring':
                criteria = "Estrategia 'Smart Selection' (Risk-Based): Algoritmo de extracción automatizada que prioriza unidades con alta densidad de alertas forenses. El sistema filtra y ordena el universo según un score ponderado donde convergen anomalías de Benford, valores atípicos, duplicidades y patrones de redondez.";
                justification = `Enfoque de Auditoría Basado en Riesgo Acumulado (Consejo 2320-3 del IIA): Se ha determinado que la eficacia de la prueba, dada una criticidad ${criticality}, se maximiza al inspeccionar los elementos que presentan simultáneamente múltiples factores de riesgo. Esta selección dirigida mitiga la posibilidad de omitir irregularidades críticas.`;
                break;
            case 'Benford':
                criteria = "Selección sustantiva focalizada en registros cuyos montos transgreden las expectativas de frecuencia natural (Ley de Benford).";
                justification = `Confirmación de Condiciones (IIA 2320-3): Las desviaciones en los dígitos iniciales sugieren intervenciones manuales. Ante un proceso de criticidad ${criticality}, se requiere esta revisión para validar la veracidad de los soportes documentales sin depender de inferencia probabilística.`;
                break;
            case 'Outliers':
                criteria = "Extracción de partidas situadas en la periferia de la distribución (Outliers), identificadas mediante el Rango Intercuartílico (IQR).";
                justification = `Materialidad e Insights Cualitativos: Al ser montos anómalos para un nivel de criticidad ${criticality}, representan el mayor impacto potencial. La selección busca confirmar la existencia de condiciones inusuales según el juicio profesional.`;
                break;
            case 'Duplicates':
                criteria = "Inspección de clústeres de datos con montos o atributos idénticos (Hallazgos Geométricos de Repetición).";
                justification = `Evaluación de Control Interno: Se busca validar si las repeticiones en este proceso (${criticality}) obedecen a fallas en el control preventivo, errores de registro o intentos premeditados de duplicidad.`;
                break;
            case 'RoundNumbers':
                criteria = "Selección de ítems con 'Redondeo Forense' (múltiplos significativos), técnica orientada a detectar estimaciones contables ad-hoc.";
                justification = `Debilidad en el Soporte: Los números redondos son inusuales y frecuentemente se vinculan a ajustes manuales. Este enfoque descriptivo (IIA 2320-3) se centra en confirmar la razonabilidad de las transacciones más sospechosas en el área.`;
                break;
            case 'Entropy':
                criteria = "Análisis de Entropía Categórica: Selección dirigida a combinaciones de categorías con distribución anómala o patrones inusuales de clasificación.";
                justification = `Detección de Irregularidades Categóricas: Las combinaciones raras de categorías pueden indicar errores de clasificación o manipulación intencional. Para un proceso de criticidad ${criticality}, este análisis identifica transacciones mal categorizadas que requieren validación.`;
                break;
            case 'Splitting':
                criteria = "Detección de Fraccionamiento: Identificación de grupos de transacciones del mismo proveedor que, sumadas, exceden umbrales de autorización pero individualmente los evaden.";
                justification = `Control de Evasión de Umbrales: El fraccionamiento es una técnica común para evadir controles de autorización. En procesos de criticidad ${criticality}, es esencial verificar que las compras no estén siendo artificialmente divididas para evitar supervisión.`;
                break;
            case 'Sequential':
                criteria = "Análisis de Integridad Secuencial: Selección enfocada en detectar gaps o saltos en la numeración secuencial de documentos que pueden indicar eliminación o manipulación.";
                justification = `Integridad Documental: Los gaps en secuencias numéricas pueden indicar documentos faltantes, eliminados o manipulados. Para criticidad ${criticality}, es crucial verificar la completitud de la documentación soporte.`;
                break;
            case 'IsolationForest':
                criteria = "Machine Learning - Isolation Forest: Algoritmo avanzado de detección de anomalías multidimensionales que identifica patrones complejos no detectables por métodos tradicionales.";
                justification = `Análisis Multivariado Avanzado: El Isolation Forest detecta anomalías considerando múltiples variables simultáneamente. Para procesos de criticidad ${criticality}, este enfoque de IA identifica patrones sospechosos complejos que requieren investigación detallada.`;
                break;
            case 'ActorProfiling':
                criteria = "Perfilado de Actores: Análisis de comportamiento de usuarios para identificar patrones de actividad anómalos, transacciones fuera de horario o volúmenes inusuales.";
                justification = `Análisis Conductual: Los patrones de comportamiento anómalos de usuarios pueden indicar actividad fraudulenta o errores sistemáticos. En procesos de criticidad ${criticality}, es importante verificar que la actividad de los usuarios esté dentro de parámetros normales.`;
                break;
            case 'EnhancedBenford':
                criteria = "Benford Avanzado: Análisis mejorado de la Ley de Benford incluyendo segundo dígito y análisis combinado de primeros dos dígitos para mayor sensibilidad en la detección.";
                justification = `Detección Avanzada de Manipulación: El análisis de segundo dígito es más sensible que el tradicional primer dígito para detectar manipulación sutil de datos. Para criticidad ${criticality}, este enfoque mejorado aumenta la probabilidad de detectar alteraciones sofisticadas.`;
                break;
        }

        const criticalGaps = appState.selectedPopulation?.risk_profile?.gapAlerts || 0;
        const suggestedSize = 30 + (criticalGaps * 5);

        setAppState(prev => ({
            ...prev,
            samplingParams: {
                ...prev.samplingParams,
                nonStatistical: {
                    ...prev.samplingParams.nonStatistical,
                    criteria: criteria,
                    justification: justification,
                    selectedInsight: type,
                    sampleSize: suggestedSize,
                    sizeJustification: ''
                }
            }
        }));
    };

    // Funciones para análisis forense
    const handleRunForensicAnalysis = async (config?: any) => {
        if (!appState.selectedPopulation) return;

        setIsRunningForensicAnalysis(true);

        try {
            // Simular llamada al análisis forense con configuración
            const response = await samplingProxyFetch('run_forensic_analysis', {
                population_id: appState.selectedPopulation.id,
                config: config || {
                    splittingThresholds: [1000, 5000, 10000, 25000, 50000],
                    timeWindow: 30,
                    entropyThreshold: 0.02
                }
            });

            if (response.success) {
                setForensicResults(response.analysis);

                // CRÍTICO: Actualizar el advanced_analysis en appState para mantener consistencia
                // en todos los componentes que leen de esta fuente
                setAppState(prev => ({
                    ...prev,
                    selectedPopulation: prev.selectedPopulation ? {
                        ...prev.selectedPopulation,
                        advanced_analysis: response.analysis
                    } : prev.selectedPopulation
                }));

                setForensicResultsOpen(true);
            } else {
                console.error('Error en análisis forense:', response.error);
            }
        } catch (error) {
            console.error('Error ejecutando análisis forense:', error);
        } finally {
            setIsRunningForensicAnalysis(false);
        }
    };

    const handleOpenForensicConfig = () => {
        setForensicConfigOpen(true);
    };

    const handleOpenMethodExplanation = (methodId: string) => {
        setSelectedMethod(methodId);
        setExplanationModalOpen(true);
    };

    const handleOpenAnomaliesModal = (analysisType: string, title: string) => {
        setSelectedAnomalyType(analysisType);
        setSelectedAnomalyTitle(title);
        setAnomaliesModalOpen(true);
    };

    const handleSaveForensicConfig = (config: any) => {
        handleRunForensicAnalysis(config);
    };

    const handleShowDetails = async (e: React.MouseEvent, type: string) => {
        e.stopPropagation();
        if (!appState.selectedPopulation) return;

        setDetailType(type);
        setDetailModalOpen(true);
        setIsLoadingDetails(true);
        setDetailItems([]);

        try {
            let rows: any[] = [];

            // Usar el proxy para consultas más eficientes y con timeout
            switch (type) {
                case 'Negativos':
                case 'Positivos':
                case 'En Cero':
                case 'Datos Erróneos':
                case 'Mínimo':
                case 'Máximo':
                    // Usar consulta directa con timeout para casos simples
                    const { rows: directRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        detailed: 'true'
                    });

                    // Filtrar en el cliente para evitar consultas SQL complejas
                    rows = (directRows || []).filter(r => {
                        switch (type) {
                            case 'Negativos':
                                return (r.monetary_value_col || 0) < 0;
                            case 'Positivos':
                                return (r.monetary_value_col || 0) > 0;
                            case 'En Cero':
                                return (r.monetary_value_col || 0) === 0;
                            case 'Datos Erróneos':
                                return r.monetary_value_col === null || r.monetary_value_col === undefined;
                            case 'Mínimo':
                                return analysis?.eda?.minId ? r.unique_id_col === analysis.eda.minId : false;
                            case 'Máximo':
                                return analysis?.eda?.maxId ? r.unique_id_col === analysis.eda.maxId : false;
                            default:
                                return false;
                        }
                    }).slice(0, 100); // Limitar a 100 registros para performance
                    break;

                case 'Outliers':
                    // Usar el proxy para obtener registros con alto riesgo
                    const { rows: outlierRows } = await samplingProxyFetch('get_smart_sample', {
                        population_id: appState.selectedPopulation.id,
                        sample_size: 100
                    });

                    const threshold = analysis?.outliersThreshold || 0;
                    rows = (outlierRows || []).filter(r => (r.monetary_value_col || 0) > threshold);
                    break;

                case 'Duplicates':
                case 'RoundNumbers':
                    // Usar consulta con filtro de factores de riesgo
                    const { rows: riskRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (riskRows || []).filter(r => {
                        const factors = r.risk_factors || [];
                        if (type === 'Duplicates') {
                            return factors.some((f: string) => f.toLowerCase().includes('duplicado'));
                        } else if (type === 'RoundNumbers') {
                            return factors.some((f: string) => f.toLowerCase().includes('redondo'));
                        }
                        return false;
                    }).slice(0, 100);
                    break;

                case 'Entropy':
                    // Filtrar por anomalías categóricas de entropía
                    const { rows: entropyRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (entropyRows || []).filter(r => {
                        const factors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
                        return factors.some((f: string) =>
                            f && (f.toLowerCase().includes('entropy') || f.toLowerCase().includes('categoria'))
                        );
                    }).slice(0, 100);
                    break;

                case 'Splitting':
                    // Filtrar por grupos de fraccionamiento
                    const { rows: splittingRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (splittingRows || []).filter(r => {
                        const factors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
                        return factors.some((f: string) =>
                            f && (
                                f.toLowerCase().includes('splitting') ||
                                f.toLowerCase().includes('fraccionamiento') ||
                                f.toLowerCase().includes('grupo_riesgo') ||
                                f.toLowerCase().includes('proveedor_sospechoso')
                            )
                        );
                    }).slice(0, 100);
                    break;

                case 'Sequential':
                    // Filtrar por gaps secuenciales
                    const { rows: sequentialRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (sequentialRows || []).filter(r => {
                        const factors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
                        return factors.some((f: string) =>
                            f && (
                                f.toLowerCase().includes('gap') ||
                                f.toLowerCase().includes('secuencial') ||
                                f.toLowerCase().includes('falta_consecutivo')
                            )
                        );
                    }).slice(0, 100);
                    break;

                case 'IsolationForest':
                    // Filtrar por anomalías de Isolation Forest
                    const { rows: isolationRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (isolationRows || []).filter(r => {
                        const factors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
                        return factors.some((f: string) =>
                            f && (
                                f.toLowerCase().includes('isolation') ||
                                f.toLowerCase().includes('ml_anomaly') ||
                                f.toLowerCase().includes('anomalia_ml') ||
                                f.toLowerCase().includes('patron_inusual')
                            )
                        );
                    }).slice(0, 100);
                    break;

                case 'ActorProfiling':
                    // Filtrar por actores sospechosos
                    const { rows: actorRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (actorRows || []).filter(r => {
                        const factors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
                        return factors.some((f: string) =>
                            f && (
                                f.toLowerCase().includes('actor') ||
                                f.toLowerCase().includes('usuario_sospechoso') ||
                                f.toLowerCase().includes('comportamiento_inusual')
                            )
                        );
                    }).slice(0, 100);
                    break;

                case 'EnhancedBenford':
                    // Filtrar por anomalías de Benford avanzado
                    const { rows: enhancedBenfordRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (enhancedBenfordRows || []).filter(r => {
                        const factors = Array.isArray(r.risk_factors) ? r.risk_factors : [];
                        // Ampliar búsqueda a cualquier factor relacionado con Benford mejorado
                        return factors.some((f: string) =>
                            f && (
                                f.toLowerCase().includes('enhanced_benford') ||
                                f.toLowerCase().includes('segundo_digito') ||
                                f.toLowerCase().includes('benford_avanzado') ||
                                f.toLowerCase().includes('patron_suspechoso') ||
                                f.toLowerCase().includes('conformidad')
                            )
                        );
                    }).slice(0, 100);
                    break;

                case 'Fin de Semana (WD)':
                    // Obtener muestra y filtrar por fecha en el cliente
                    const dateField = appState.selectedPopulation.column_mapping.date;
                    if (dateField) {
                        const { rows: dateRows } = await samplingProxyFetch('get_universe', {
                            population_id: appState.selectedPopulation.id,
                            detailed: 'true'
                        });

                        rows = (dateRows || []).filter(r => {
                            try {
                                const rawData = typeof r.raw_json === 'string' ? JSON.parse(r.raw_json) : r.raw_json;
                                const dateValue = rawData?.[dateField];
                                if (!dateValue) return false;

                                const d = new Date(dateValue);
                                return !isNaN(d.getTime()) && (d.getDay() === 0 || d.getDay() === 6);
                            } catch (error) {
                                console.warn('Error parsing date:', error);
                                return false;
                            }
                        }).slice(0, 100);
                    }
                    break;

                case 'Campos Vacíos':
                    // Obtener muestra y filtrar por campos vacíos en el cliente
                    const textField = appState.selectedPopulation.column_mapping.category ||
                        appState.selectedPopulation.column_mapping.subcategory ||
                        appState.selectedPopulation.column_mapping.vendor;

                    if (textField) {
                        const { rows: textRows } = await samplingProxyFetch('get_universe', {
                            population_id: appState.selectedPopulation.id,
                            detailed: 'true'
                        });

                        rows = (textRows || []).filter(r => {
                            try {
                                const rawData = typeof r.raw_json === 'string' ? JSON.parse(r.raw_json) : r.raw_json;
                                const fieldValue = rawData?.[textField];
                                return !fieldValue || fieldValue.toString().trim() === '';
                            } catch (error) {
                                console.warn('Error parsing text field:', error);
                                return false;
                            }
                        }).slice(0, 100);
                    }
                    break;

                case 'Benford':
                    // Para Benford, usar los registros con anomalías detectadas
                    const { rows: benfordRows } = await samplingProxyFetch('get_universe', {
                        population_id: appState.selectedPopulation.id,
                        include_factors: 'true'
                    });

                    rows = (benfordRows || []).filter(r => {
                        const factors = r.risk_factors || [];
                        return factors.some((f: string) => f.toLowerCase().includes('benford'));
                    }).slice(0, 100);
                    break;

                default:
                    console.warn('Tipo de detalle no reconocido:', type);
                    rows = [];
            }

            // Transformar los datos para el modal
            setDetailItems(rows.map(r => ({
                id: r.unique_id_col,
                value: r.monetary_value_col ?? 0,
                raw: {
                    ...(typeof r.raw_json === 'string' ? JSON.parse(r.raw_json) : r.raw_json),
                    risk_factors: r.risk_factors || []
                }
            })));

        } catch (error: any) {
            console.error("Error fetching details:", error);

            let errorMessage = "Error al cargar detalles";
            if (error instanceof FetchTimeoutError) {
                errorMessage = "Timeout: La consulta tardó demasiado tiempo";
            } else if (error instanceof FetchNetworkError) {
                errorMessage = "Error de conexión: " + error.message;
            } else {
                errorMessage += ": " + (error.message || "Error desconocido");
            }

            // Mostrar error en el modal en lugar de cerrar
            setDetailItems([{
                id: 'ERROR',
                value: 0,
                raw: { error: errorMessage }
            }]);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const showHelp = (e: React.MouseEvent, key: keyof typeof EDA_EXPLANATIONS) => {
        e.stopPropagation();
        setExplanationContent(EDA_EXPLANATIONS[key]);
        setExplanationOpen(true);
    };

    // Función para determinar el nivel de riesgo basado en los factores
    const getRiskLevel = (riskFactors: string[]): 'Alto' | 'Medio' | 'Bajo' => {
        if (!riskFactors || riskFactors.length === 0) return 'Bajo';

        // Alto riesgo: 3+ factores o factores críticos
        const criticalFactors = ['benford', 'outlier', 'duplicado', 'splitting', 'gap', 'isolation', 'ml_anomaly'];
        const hasCritical = riskFactors.some(f =>
            criticalFactors.some(cf => f.toLowerCase().includes(cf))
        );

        if (riskFactors.length >= 3 || (hasCritical && riskFactors.length >= 2)) {
            return 'Alto';
        }

        // Medio riesgo: 2 factores o 1 factor crítico
        if (riskFactors.length >= 2 || hasCritical) {
            return 'Medio';
        }

        // Bajo riesgo: 1 factor no crítico
        return 'Bajo';
    };

    // Función para extraer el tipo de análisis de los factores de riesgo
    const getAnalysisType = (riskFactors: string[]): string => {
        if (!riskFactors || riskFactors.length === 0) return 'Otros';

        const typeMap: { [key: string]: string } = {
            'benford': 'Ley de Benford',
            'enhanced_benford': 'Benford Avanzado',
            'segundo_digito': 'Benford Avanzado',
            'outlier': 'Valores Atípicos',
            'duplicado': 'Duplicados',
            'redondo': 'Números Redondos',
            'entropy': 'Entropía Categórica',
            'categoria': 'Entropía Categórica',
            'splitting': 'Fraccionamiento',
            'fraccionamiento': 'Fraccionamiento',
            'gap': 'Gaps Secuenciales',
            'secuencial': 'Gaps Secuenciales',
            'isolation': 'ML Anomalías',
            'ml_anomaly': 'ML Anomalías',
            'actor': 'Actores Sospechosos',
            'usuario_sospechoso': 'Actores Sospechosos'
        };

        // Buscar el primer tipo que coincida
        for (const factor of riskFactors) {
            const lowerFactor = factor.toLowerCase();
            for (const [key, value] of Object.entries(typeMap)) {
                if (lowerFactor.includes(key)) {
                    return value;
                }
            }
        }

        return 'Otros';
    };

    // Organizar items en estructura jerárquica
    const organizeHierarchically = (items: any[]) => {
        const hierarchy: {
            [riskLevel: string]: {
                [analysisType: string]: any[]
            }
        } = {
            'Alto': {},
            'Medio': {},
            'Bajo': {}
        };

        items.forEach(item => {
            const rawFactors = item.raw?.risk_factors;
            const riskFactors = Array.isArray(rawFactors) ? rawFactors : [];
            const riskLevel = getRiskLevel(riskFactors);
            const analysisType = getAnalysisType(riskFactors);

            if (!hierarchy[riskLevel][analysisType]) {
                hierarchy[riskLevel][analysisType] = [];
            }

            hierarchy[riskLevel][analysisType].push(item);
        });

        return hierarchy;
    };

    // Toggle para expandir/colapsar niveles de riesgo
    const toggleRiskLevel = (level: string) => {
        setExpandedRiskLevels(prev => {
            const newSet = new Set(prev);
            if (newSet.has(level)) {
                newSet.delete(level);
            } else {
                newSet.add(level);
            }
            return newSet;
        });
    };

    // Toggle para expandir/colapsar tipos de análisis
    const toggleAnalysisType = (key: string) => {
        setExpandedAnalysisTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    return (
        <>
            <div className="space-y-8 animate-fade-in">
                <div className="border-b border-slate-100 pb-2">
                    <h3 className="text-slate-700 font-bold text-sm tracking-tight">Parámetros Específicos: Muestreo No Estadístico / de Juicio</h3>
                </div>

                <div className="bg-teal-50 border-l-4 border-teal-500 p-4 rounded-r-lg flex items-center shadow-sm">
                    <i className="fas fa-microscope text-teal-600 mr-4 text-xl"></i>
                    <div>
                        <h4 className="text-teal-900 font-black text-[11px] uppercase tracking-wider">Análisis Forense y Selección de Criterios</h4>
                        <p className="text-[11px] text-teal-700 font-medium">
                            Seleccione una tarjeta para cargar criterios automáticamente, o use los botones para ver explicaciones técnicas y detalles de hallazgos.
                        </p>
                        <p className="text-[10px] text-teal-600 font-bold mt-1 italic border-t border-teal-200/50 pt-1 inline-block">
                            <i className="fas fa-info-circle mr-1"></i> Nota: Las métricas presentadas incluyen hallazgos de riesgo ALTO y MEDIO del análisis forense.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div
                        onClick={() => handleInsightSelection('Benford')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group ${selectedInsight === 'Benford' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-3">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ley de Benford</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('benford'); }}
                                    className="text-blue-500 hover:text-blue-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'Benford')}
                                    className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-list-ul"></i>
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-between items-end h-16">
                            <div className="flex-1 h-12 flex items-end gap-1 px-1">
                                {[40, 60, 20, 15, 10, 8, 7, 5, 4].map((h, i) => (
                                    <div key={i} className="flex-1 bg-rose-500 rounded-t-sm" style={{ height: `${h}%` }}></div>
                                ))}
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-2xl font-black text-slate-800 leading-none">{getBenfordAnomalyCount()}</div>
                                <div className="text-[8px] font-black text-rose-500 uppercase mt-1">Anomalías</div>
                            </div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('Outliers')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'Outliers' ? 'border-purple-500 ring-2 ring-purple-100 bg-purple-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valores Atípicos</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('outliers'); }}
                                    className="text-orange-500 hover:text-orange-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'Outliers')}
                                    className="text-purple-500 hover:text-purple-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-expand-arrows-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-black text-purple-600 leading-none">{analysis?.outliersCount || 0}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Registros &gt; IQR</div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('Duplicates')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'Duplicates' ? 'border-orange-500 ring-2 ring-orange-100 bg-orange-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Duplicados</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('duplicates'); }}
                                    className="text-red-500 hover:text-red-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'Duplicates')}
                                    className="text-orange-500 hover:text-orange-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-copy"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-black text-orange-500 leading-none">{analysis?.duplicatesCount || 0}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Valores Repetidos</div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('RoundNumbers')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'RoundNumbers' ? 'border-cyan-500 ring-2 ring-cyan-100 bg-cyan-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Números Redondos</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('roundNumbers'); }}
                                    className="text-indigo-500 hover:text-indigo-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'RoundNumbers')}
                                    className="text-cyan-500 hover:text-cyan-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-coins"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-slate-800 leading-none">{analysis?.roundNumbersCount || 0}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Hallazgos Redondos</div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('Entropy')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'Entropy' ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entropía</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('entropy'); }}
                                    className="text-purple-500 hover:text-purple-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'Entropy')}
                                    className="text-indigo-500 hover:text-indigo-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-random"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-indigo-600 leading-none">{getEntropyAnomalies()}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Anomalías Categóricas</div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('Splitting')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'Splitting' ? 'border-red-500 ring-2 ring-red-100 bg-red-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fraccionamiento</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('splitting'); }}
                                    className="text-yellow-500 hover:text-yellow-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'Splitting')}
                                    className="text-red-500 hover:text-red-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-cut"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-red-600 leading-none">{getSplittingGroups()}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Grupos Sospechosos</div>
                        </div>
                    </div>
                </div>

                {/* Segunda fila de insights avanzados */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                        onClick={() => handleInsightSelection('Sequential')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'Sequential' ? 'border-yellow-500 ring-2 ring-yellow-100 bg-yellow-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gaps Secuenciales</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('sequential'); }}
                                    className="text-red-500 hover:text-red-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'Sequential')}
                                    className="text-yellow-500 hover:text-yellow-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-list-ol"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-yellow-600 leading-none">{getSequentialGaps()}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Gaps Críticos</div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('IsolationForest')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'IsolationForest' ? 'border-green-500 ring-2 ring-green-100 bg-green-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ML Anomalías</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('isolationForest'); }}
                                    className="text-purple-500 hover:text-purple-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'IsolationForest')}
                                    className="text-green-500 hover:text-green-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-brain"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-green-600 leading-none">{getIsolationForestAnomalies()}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Anomalías IA</div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('ActorProfiling')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'ActorProfiling' ? 'border-pink-500 ring-2 ring-pink-100 bg-pink-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actores</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('actorProfiling'); }}
                                    className="text-orange-500 hover:text-orange-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'ActorProfiling')}
                                    className="text-pink-500 hover:text-pink-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-user-secret"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-pink-600 leading-none">{getSuspiciousActors()}</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Usuarios Sospechosos</div>
                        </div>
                    </div>

                    <div
                        onClick={() => handleInsightSelection('EnhancedBenford')}
                        className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all ${selectedInsight === 'EnhancedBenford' ? 'border-violet-500 ring-2 ring-violet-100 bg-violet-50/10' : 'border-slate-200'}`}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Benford Avanzado</h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenMethodExplanation('enhancedBenford'); }}
                                    className="text-green-500 hover:text-green-600 transition-colors"
                                    title="Ver Explicación Técnica"
                                >
                                    <i className="fas fa-info-circle"></i>
                                </button>
                                <button
                                    onClick={(e) => handleShowDetails(e, 'EnhancedBenford')}
                                    className="text-violet-500 hover:text-violet-600"
                                    title="Ver Ítems Detectados"
                                >
                                    <i className="fas fa-chart-line"></i>
                                </button>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-black text-violet-600 leading-none">{getEnhancedBenfordDeviation().toFixed(1)}%</div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">Desviación MAD</div>
                        </div>
                    </div>
                </div>

                <div
                    onClick={() => handleInsightSelection('RiskScoring')}
                    className={`cursor-pointer bg-white border rounded-3xl p-6 shadow-sm relative overflow-hidden group transition-all hover:shadow-lg ${selectedInsight === 'RiskScoring' ? 'border-rose-500 ring-2 ring-rose-100 bg-rose-50/10' : 'border-slate-200'}`}
                >
                    <div className="absolute top-0 right-0 p-1 bg-rose-500 text-white text-[8px] font-black px-3 py-1 uppercase tracking-widest rounded-bl-xl shadow-lg">ESTRATEGIA ACTIVA</div>
                    <div className="flex items-center gap-6">
                        <div className="h-16 w-16 bg-rose-50 rounded-full flex items-center justify-center border-4 border-rose-100 shadow-sm text-rose-500 flex-shrink-0">
                            <i className="fas fa-biohazard text-3xl"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-slate-800 font-black text-base">Risk Scoring (Muestreo Inteligente)</h4>
                                <button onClick={(e) => showHelp(e, 'SMART_SELECTION' as any)} className="text-rose-300 hover:text-rose-500 transition-colors"><i className="fas fa-info-circle text-sm"></i></button>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mt-1 max-w-3xl">
                                Combina todos los factores anteriores para calcular un <span className="font-bold text-slate-700">Puntaje de Riesgo</span> por transacción. Selecciona automáticamente los ítems con mayor coincidencia de alertas (ej. Outlier + Redondo + Duplicado).
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 col-span-2">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <h4 className="text-slate-900 font-black text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
                                    Tamaño de la Muestra (n)
                                    <button onClick={(e) => showHelp(e, 'SAMPLE_SIZE' as any)} className="text-slate-300 hover:text-indigo-400 transition-colors"><i className="fas fa-info-circle text-xs"></i></button>
                                </h4>
                                <p className="text-[10px] text-slate-500 font-medium italic">
                                    Sugerencia Técnica (NIA 530): <span className="text-rose-600 font-bold">{30 + ((appState.selectedPopulation?.risk_profile?.gapAlerts || 0) * 5)} ítems</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">n =</span>
                                    <input
                                        type="number"
                                        value={params.sampleSize || 30}
                                        onChange={(e) => setAppState(prev => ({
                                            ...prev,
                                            samplingParams: {
                                                ...prev.samplingParams,
                                                nonStatistical: { ...prev.samplingParams.nonStatistical, sampleSize: parseInt(e.target.value) || 0 }
                                            }
                                        }))}
                                        className="w-32 bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-center font-black text-slate-800 focus:ring-4 focus:ring-rose-500/10 transition-all shadow-sm"
                                        min={1}
                                    />
                                </div>
                            </div>
                        </div>
                        {params.sampleSize !== (30 + ((appState.selectedPopulation?.risk_profile?.gapAlerts || 0) * 5)) && (
                            <div className="mt-4 p-5 bg-amber-50 rounded-2xl border border-amber-200 animate-fade-in-up">
                                <label className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-2 block flex items-center gap-2">
                                    <i className="fas fa-exclamation-triangle text-amber-600"></i> Justificación de Alcance Manual
                                </label>
                                <textarea
                                    value={params.sizeJustification || ''}
                                    onChange={(e) => setAppState(prev => ({
                                        ...prev,
                                        samplingParams: {
                                            ...prev.samplingParams,
                                            nonStatistical: { ...prev.samplingParams.nonStatistical, sizeJustification: e.target.value }
                                        }
                                    }))}
                                    className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-xs text-slate-700 font-medium h-20"
                                    placeholder="Explique las razones técnicas..."
                                />
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <h4 className="text-slate-900 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                            Criticidad del Proceso
                            <button onClick={(e) => showHelp(e, 'SKEWNESS' as any)} className="text-slate-300 hover:text-rose-400 transition-colors"><i className="fas fa-shield-halved text-xs"></i></button>
                        </h4>
                        <select
                            value={params.processCriticality || 'Medio'}
                            onChange={(e) => setAppState(prev => ({
                                ...prev,
                                samplingParams: {
                                    ...prev.samplingParams,
                                    nonStatistical: { ...prev.samplingParams.nonStatistical, processCriticality: e.target.value as any }
                                }
                            }))}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-800 shadow-sm focus:ring-4 focus:ring-rose-500/10 transition-all outline-none appearance-none"
                        >
                            <option value="Bajo">Bajo (Operativo)</option>
                            <option value="Medio">Medio (Táctico)</option>
                            <option value="Alto">Alto (Estratégico)</option>
                            <option value="Crítico">Crítico (Vital/Cumplimiento)</option>
                        </select>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                        <h4 className="text-slate-900 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                            Materialidad (TE)
                            <button onClick={(e) => showHelp(e, 'NET_VALUE' as any)} className="text-slate-300 hover:text-rose-400 transition-colors"><i className="fas fa-info-circle text-xs"></i></button>
                        </h4>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">$</span>
                            <input
                                type="number"
                                value={params.materiality || 50000}
                                onChange={(e) => setAppState(prev => ({
                                    ...prev,
                                    samplingParams: {
                                        ...prev.samplingParams,
                                        nonStatistical: { ...prev.samplingParams.nonStatistical, materiality: parseInt(e.target.value) || 0 }
                                    }
                                }))}
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-8 pr-4 text-center font-black text-slate-800 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {analysis?.eda && (
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm animate-fade-in-up mt-8">
                        <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <i className="fas fa-file-invoice-dollar text-indigo-500"></i> Ficha Técnica Descriptiva (EDA)
                            </h4>
                            <span className="text-[9px] font-bold text-slate-400 uppercase bg-white px-3 py-1 rounded-full border border-slate-100">Población: {analysis.eda.totalRecords} ítems</span>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-10">
                            {/* Columna 1: Totales y Saldos */}
                            <div className="space-y-6">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 flex justify-between items-center">
                                    Resumen de Saldos
                                    <button onClick={(e) => showHelp(e, 'NET_VALUE' as any)} className="text-indigo-300 hover:text-indigo-500"><i className="fas fa-info-circle text-[10px]"></i></button>
                                </h5>
                                <div className="space-y-4">
                                    <div
                                        className="flex justify-between items-end cursor-pointer group hover:bg-slate-50 p-1 rounded-lg transition-all"
                                        onClick={(e) => showHelp(e, 'NET_VALUE' as any)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-medium text-slate-500 uppercase">Valor Neto</span>
                                            <i className="fas fa-calculator text-[8px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                        </div>
                                        <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600">${formatMoney(analysis.eda.netValue)}</span>
                                    </div>
                                    <div
                                        className="flex justify-between items-end cursor-pointer group hover:bg-slate-50 p-1 rounded-lg transition-all"
                                        onClick={(e) => showHelp(e, 'ABS_VALUE' as any)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-medium text-slate-500 uppercase">Valor Absoluto</span>
                                            <i className="fas fa-calculator text-[8px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                        </div>
                                        <span className="text-sm font-black text-slate-900 group-hover:text-amber-600">${formatMoney(analysis.eda.absoluteValue)}</span>
                                    </div>
                                    <div className="pt-2">
                                        <div
                                            className="flex justify-between text-[9px] font-bold mb-1 cursor-pointer group hover:bg-emerald-50 p-1 rounded-lg"
                                            onClick={(e) => handleShowDetails(e, 'Positivos')}
                                        >
                                            <span className="text-emerald-600 uppercase">POSITIVOS ({analysis.eda.positiveCount})</span>
                                            <span className="text-emerald-700 font-black">${formatMoney(analysis.eda.positiveValue)}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-emerald-500" style={{ width: `${(analysis.eda.positiveCount / analysis.eda.totalRecords) * 100}%` }}></div>
                                            <div className="h-full bg-rose-500" style={{ width: `${(analysis.eda.negativeCount / analysis.eda.totalRecords) * 100}%` }}></div>
                                        </div>
                                        <div
                                            className="flex justify-between text-[9px] font-bold mt-1 cursor-pointer group hover:bg-rose-50 p-1 rounded-lg"
                                            onClick={(e) => handleShowDetails(e, 'Negativos')}
                                        >
                                            <span className="text-rose-600 uppercase">NEGATIVOS ({analysis.eda.negativeCount})</span>
                                            <span className="text-rose-700 font-black">${formatMoney(analysis.eda.negativeValue)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Columna 2: Centralidad y Rango */}
                            <div className="space-y-6">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 flex justify-between items-center">
                                    Centralidad y Rango
                                    <button onClick={(e) => showHelp(e, 'MEAN' as any)} className="text-indigo-300 hover:text-indigo-500"><i className="fas fa-info-circle text-[10px]"></i></button>
                                </h5>
                                <div className="space-y-4">
                                    <div
                                        className="flex justify-between items-end cursor-pointer group hover:bg-slate-50 p-1 rounded-lg"
                                        onClick={(e) => showHelp(e, 'MEAN' as any)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-medium text-slate-500 uppercase">Valor Medio</span>
                                            <i className="fas fa-calculator text-[8px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                        </div>
                                        <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600">${formatMoney(analysis.eda.meanValue)}</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                                        <div
                                            className="flex justify-between items-center cursor-pointer group hover:bg-white p-1 rounded-lg"
                                            onClick={(e) => handleShowDetails(e, 'Mínimo')}
                                        >
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Mínimo</span>
                                            <span className="text-[10px] font-black text-slate-700 group-hover:text-indigo-600">${formatMoney(analysis.eda.minValue)}</span>
                                        </div>
                                        <div
                                            className="flex justify-between items-center cursor-pointer group hover:bg-white p-1 rounded-lg"
                                            onClick={(e) => handleShowDetails(e, 'Máximo')}
                                        >
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Máximo</span>
                                            <span className="text-[10px] font-black text-slate-700 group-hover:text-indigo-600">${formatMoney(analysis.eda.maxValue)}</span>
                                        </div>
                                    </div>
                                    <div
                                        className="flex justify-between items-end cursor-pointer group hover:bg-rose-50 p-1 rounded-lg"
                                        onClick={(e) => handleShowDetails(e, 'Datos Erróneos')}
                                    >
                                        <span className="text-[10px] font-medium text-slate-500 uppercase">Datos Erróneos</span>
                                        <span className={`font-black ${analysis.eda.errorDataCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{analysis.eda.errorDataCount}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Columna 3: Forma y Dispersión */}
                            <div className="space-y-6">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-50 pb-2 flex justify-between items-center">
                                    Forma y Dispersión
                                    <button onClick={(e) => showHelp(e, 'STD_DEV' as any)} className="text-indigo-300 hover:text-indigo-500"><i className="fas fa-info-circle text-[10px]"></i></button>
                                </h5>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div
                                            className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100 cursor-pointer group hover:bg-indigo-100/50 transition-all"
                                            onClick={(e) => showHelp(e, 'STD_DEV' as any)}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase block">Std Dev (s)</span>
                                                <i className="fas fa-calculator text-[8px] text-indigo-300"></i>
                                            </div>
                                            <span className="text-xs font-black text-indigo-900">${formatMoney(analysis.eda.sampleStdDev)}</span>
                                        </div>
                                        <div
                                            className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100 cursor-pointer group hover:bg-indigo-100/50 transition-all"
                                            onClick={(e) => showHelp(e, 'SKEWNESS' as any)}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase block">Asimetría</span>
                                                <i className="fas fa-calculator text-[8px] text-indigo-300"></i>
                                            </div>
                                            <span className="text-xs font-black text-indigo-900">{analysis.eda.skewness.toFixed(3)}</span>
                                        </div>
                                    </div>
                                    <p className="text-[8px] text-slate-400 font-medium leading-tight italic">
                                        {analysis.eda.skewness > 0.5 ? 'Cola derecha pesada: muchos valores bajos y pocos extremos altos.' : (analysis.eda.skewness < -0.5 ? 'Cola izquierda pesada: muchos registros altos concentrados.' : 'Distribución aproximadamente simétrica.')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-3 gap-10 border-t border-slate-50 pt-8 mt-[-20px]">
                            {/* Columna 4: RSF */}
                            <div className="space-y-6">
                                <h5 className="text-[9px] font-black text-rose-600 uppercase tracking-widest border-b border-rose-50 pb-2 flex justify-between items-center">
                                    Factor de Tamaño Relativo (RSF)
                                    <button onClick={(e) => showHelp(e, 'RSF' as any)} className="text-rose-300 hover:text-rose-500"><i className="fas fa-info-circle text-[10px]"></i></button>
                                </h5>
                                <div className="space-y-4">
                                    <div
                                        className="flex justify-between items-end cursor-pointer group hover:bg-rose-50 p-1 rounded-lg transition-all"
                                        onClick={(e) => showHelp(e, 'RSF' as any)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-medium text-slate-500 uppercase">Ratio RSF</span>
                                            <i className="fas fa-calculator text-[8px] text-rose-300 opacity-0 group-hover:opacity-100"></i>
                                        </div>
                                        <span className={`text-sm font-black ${analysis.eda.rsf && analysis.eda.rsf.rsf > 10 ? 'text-rose-600' : 'text-slate-900'}`}>
                                            {analysis.eda.rsf?.rsf.toFixed(2) || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-rose-50/30 rounded-xl border border-rose-100 flex justify-between items-center cursor-default">
                                        <div className="text-[9px] font-bold text-rose-900">
                                            <div className="text-[8px] text-rose-400 uppercase tracking-tighter">Gap Top 1 vs Top 2</div>
                                            ${formatMoney(analysis.eda.rsf?.topValue || 0)} / ${formatMoney(analysis.eda.rsf?.secondTopValue || 0)}
                                        </div>
                                        <i className="fas fa-balance-scale-right text-rose-300 transform rotate-12"></i>
                                    </div>
                                </div>
                            </div>

                            {/* Columna 5: Fechas */}
                            <div className="space-y-6">
                                <h5 className="text-[9px] font-black text-amber-600 uppercase tracking-widest border-b border-amber-50 pb-2 flex justify-between items-center">
                                    Estadísticas de Fecha
                                    <button onClick={(e) => showHelp(e, 'DATE_STATS' as any)} className="text-amber-300 hover:text-amber-500"><i className="fas fa-info-circle text-[10px]"></i></button>
                                </h5>
                                {analysis.eda.dateStats ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[10px] p-1">
                                            <span className="text-slate-500 uppercase">Brecha Temporal</span>
                                            <span className="font-black text-slate-700">{analysis.eda.dateStats.daysGap} días</span>
                                        </div>
                                        <div
                                            className="flex justify-between text-[10px] p-2 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-all group"
                                            onClick={(e) => handleShowDetails(e, 'Fin de Semana (WD)')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-amber-800 font-black uppercase">WD Count (Anomalía)</span>
                                                <i className="fas fa-eye text-[8px] text-amber-400 opacity-0 group-hover:opacity-100"></i>
                                            </div>
                                            <span className="font-black text-amber-900">{analysis.eda.dateStats.weekendCount}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">Mapee una columna de fecha para ver análisis cronológico.</p>
                                )}
                            </div>

                            {/* Columna 6: Textos */}
                            <div className="space-y-6">
                                <h5 className="text-[9px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50 pb-2 flex justify-between items-center">
                                    Estadísticas de Texto
                                    <button onClick={(e) => showHelp(e, 'CHAR_STATS' as any)} className="text-emerald-300 hover:text-emerald-500"><i className="fas fa-info-circle text-[10px]"></i></button>
                                </h5>
                                {analysis.eda.charStats ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[10px] p-1">
                                            <span className="text-slate-500 uppercase">Campos Únicos</span>
                                            <span className="font-black text-slate-700">{analysis.eda.charStats.uniqueCount}</span>
                                        </div>
                                        <div
                                            className="flex justify-between text-[10px] p-2 bg-rose-50 rounded-lg cursor-pointer hover:bg-rose-100 transition-all group"
                                            onClick={(e) => handleShowDetails(e, 'Campos Vacíos')}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-rose-800 font-black uppercase">Vacíos / Nulos</span>
                                                <i className="fas fa-eye text-[8px] text-rose-400 opacity-0 group-hover:opacity-100"></i>
                                            </div>
                                            <span className="font-black text-rose-900">{analysis.eda.charStats.blankCount}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">Mapee al menos una columna de texto para ver este análisis.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-6 pt-4">
                    <div>
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2 block flex items-center">
                            Criterio de Selección <i className="fas fa-info-circle text-blue-400 ml-2"></i>
                        </label>
                        <textarea
                            name="criteria"
                            value={params.criteria}
                            onChange={(e) => setAppState(prev => ({ ...prev, samplingParams: { ...prev.samplingParams, nonStatistical: { ...prev.samplingParams.nonStatistical, criteria: e.target.value } } }))}
                            rows={3}
                            className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium text-xs focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm h-24"
                            placeholder="Describa qué elementos específicos seleccionará..."
                        />
                    </div>
                    <div>
                        <label className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2 block">Justificación del Muestreo (Requerido)</label>
                        <textarea
                            name="justification"
                            value={params.justification}
                            onChange={(e) => setAppState(prev => ({ ...prev, samplingParams: { ...prev.samplingParams, nonStatistical: { ...prev.samplingParams.nonStatistical, justification: e.target.value } } }))}
                            rows={3}
                            className="w-full px-5 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium text-xs focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm h-32"
                            placeholder="Explique por qué este criterio es relevante..."
                        />
                    </div>
                </div>

                <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={`Análisis Forense: ${detailType}`}>
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center border border-slate-200">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hallazgos</p>
                                <p className="text-2xl font-black text-slate-900">
                                    {isLoadingDetails ? (
                                        <span className="animate-pulse">...</span>
                                    ) : (
                                        detailItems.length
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {isLoadingDetails && (
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <i className="fas fa-circle-notch fa-spin"></i>
                                        <span className="text-xs font-medium">Cargando...</span>
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        if (detailItems.length === 0 || isLoadingDetails) return;

                                        const exportData = detailItems.map(item => ({
                                            ID: item.id,
                                            Valor: item.value,
                                            ...item.raw
                                        }));

                                        const ws = utils.json_to_sheet(exportData);
                                        const wb = utils.book_new();
                                        utils.book_append_sheet(wb, ws, "Hallazgos");
                                        writeFile(wb, `AAMA_Forense_${detailType}_${new Date().toISOString().split('T')[0]}.xlsx`);
                                    }}
                                    disabled={detailItems.length === 0 || isLoadingDetails}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase shadow-md hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                                >
                                    <i className="fas fa-file-excel mr-2"></i> Exportar
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar border rounded-2xl">
                            {isLoadingDetails ? (
                                <div className="p-10 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                    <p className="text-slate-400 text-sm">Cargando detalles...</p>
                                    <p className="text-slate-300 text-xs mt-1">Esto puede tomar unos segundos</p>
                                </div>
                            ) : detailItems.length === 0 ? (
                                <div className="p-10 text-center text-slate-400">
                                    <i className="fas fa-search text-3xl mb-4 opacity-50"></i>
                                    <p>No se encontraron registros para este análisis</p>
                                </div>
                            ) : detailItems[0]?.id === 'ERROR' ? (
                                <div className="p-6 text-center">
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                        <i className="fas fa-exclamation-triangle text-red-500 text-2xl mb-2"></i>
                                        <p className="text-red-800 font-medium text-sm">
                                            {detailItems[0]?.raw?.error || 'Error al cargar los datos'}
                                        </p>
                                        <button
                                            onClick={() => handleShowDetails({ stopPropagation: () => { } } as any, detailType)}
                                            className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-all"
                                        >
                                            <i className="fas fa-redo mr-2"></i>Reintentar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {(() => {
                                        const hierarchy = organizeHierarchically(detailItems);
                                        const riskLevelColors = {
                                            'Alto': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },
                                            'Medio': { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-500' },
                                            'Bajo': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-500' }
                                        };

                                        return Object.entries(hierarchy).map(([riskLevel, analysisTypes]) => {
                                            const totalInLevel = Object.values(analysisTypes).reduce((sum, items) => sum + items.length, 0);
                                            if (totalInLevel === 0) return null;

                                            const colors = riskLevelColors[riskLevel as keyof typeof riskLevelColors];
                                            const isExpanded = expandedRiskLevels.has(riskLevel);

                                            return (
                                                <div key={riskLevel} className="bg-white">
                                                    {/* Nivel 1: Risk Level */}
                                                    <div
                                                        onClick={() => toggleRiskLevel(riskLevel)}
                                                        className={`cursor-pointer p-4 ${colors.bg} border-l-4 ${colors.border} hover:opacity-80 transition-all`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <i className={`fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} ${colors.icon} text-sm`}></i>
                                                                <div className="flex items-center gap-2">
                                                                    <i className={`fas fa-exclamation-triangle ${colors.icon}`}></i>
                                                                    <span className={`font-black text-sm uppercase tracking-wider ${colors.text}`}>
                                                                        Riesgo {riskLevel}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className={`text-xs font-bold ${colors.text}`}>
                                                                    {totalInLevel} registro{totalInLevel !== 1 ? 's' : ''}
                                                                </span>
                                                                <span className={`px-2 py-1 ${colors.bg} ${colors.border} border rounded-full text-[10px] font-black ${colors.text}`}>
                                                                    {Object.keys(analysisTypes).length} tipo{Object.keys(analysisTypes).length !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Nivel 2: Analysis Types */}
                                                    {isExpanded && (
                                                        <div className="bg-slate-50">
                                                            {Object.entries(analysisTypes).map(([analysisType, items]) => {
                                                                if (items.length === 0) return null;

                                                                const typeKey = `${riskLevel}-${analysisType}`;
                                                                const isTypeExpanded = expandedAnalysisTypes.has(typeKey);

                                                                return (
                                                                    <div key={typeKey} className="border-b border-slate-100 last:border-b-0">
                                                                        {/* Nivel 2: Analysis Type Header */}
                                                                        <div
                                                                            onClick={() => toggleAnalysisType(typeKey)}
                                                                            className="cursor-pointer p-3 pl-12 hover:bg-slate-100 transition-all"
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center gap-3">
                                                                                    <i className={`fas ${isTypeExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-slate-400 text-xs`}></i>
                                                                                    <span className="font-bold text-xs text-slate-700">
                                                                                        {analysisType}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-1 rounded-full border border-slate-200">
                                                                                    {items.length} item{items.length !== 1 ? 's' : ''}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Nivel 3: Items Table */}
                                                                        {isTypeExpanded && (
                                                                            <div className="pl-12 pr-4 pb-3">
                                                                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                                                                    <table className="min-w-full divide-y divide-slate-100">
                                                                                        <thead className="bg-slate-50">
                                                                                            <tr>
                                                                                                <th className="px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase">ID</th>
                                                                                                <th className="px-3 py-2 text-right text-[9px] font-black text-slate-500 uppercase">Valor</th>
                                                                                                <th className="px-3 py-2 text-left text-[9px] font-black text-slate-500 uppercase">Factores de Riesgo</th>
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody className="divide-y divide-slate-50">
                                                                                            {items.slice(0, 20).map((item, idx) => (
                                                                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                                                    <td className="px-3 py-2 text-[10px] font-mono font-bold text-slate-600">
                                                                                                        {item.id}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-[10px] text-right font-black text-slate-900">
                                                                                                        ${formatMoney(item.value)}
                                                                                                    </td>
                                                                                                    <td className="px-3 py-2 text-[10px] text-slate-500">
                                                                                                        {item.raw?.risk_factors && Array.isArray(item.raw.risk_factors) ? (
                                                                                                            <div className="flex flex-wrap gap-1">
                                                                                                                {item.raw.risk_factors.map((factor: string, i: number) => (
                                                                                                                    <span key={i} className="px-2 py-0.5 bg-slate-100 text-[9px] font-medium rounded-full border border-slate-200">
                                                                                                                        {factor}
                                                                                                                    </span>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <span className="text-slate-400 italic">Sin factores</span>
                                                                                                        )}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            ))}
                                                                                        </tbody>
                                                                                    </table>
                                                                                    {items.length > 20 && (
                                                                                        <div className="bg-slate-50 px-3 py-2 text-center border-t border-slate-200">
                                                                                            <p className="text-[9px] text-slate-500 font-medium">
                                                                                                Mostrando 20 de {items.length} registros. Use "Exportar" para ver todos.
                                                                                            </p>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}
                        </div>

                        {detailItems.length > 0 && detailItems[0]?.id !== 'ERROR' && (
                            <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-800 font-medium">
                                    <i className="fas fa-info-circle mr-1"></i>
                                    Vista jerárquica: Expandir/colapsar niveles para explorar los hallazgos por riesgo y tipo de análisis
                                </p>
                            </div>
                        )}
                    </div>
                </Modal>

                <Modal isOpen={explanationOpen} onClose={() => setExplanationOpen(false)} title={explanationContent.title}>
                    <div className="space-y-6">
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                            <p className="text-xs font-bold text-indigo-900 uppercase tracking-widest mb-2">Definición Técnica</p>
                            <p className="text-sm text-indigo-800 leading-relaxed">{explanationContent.text}</p>
                        </div>
                        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="h-8 w-8 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                                    <i className="fas fa-gavel text-xs"></i>
                                </div>
                                <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Impacto en Auditoría</p>
                            </div>
                            <p className="text-sm text-amber-800 leading-relaxed font-medium">{explanationContent.auditImpact}</p>
                        </div>
                    </div>
                </Modal>



                {/* Botón de Análisis Forense Completo */}
                <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div className="h-12 w-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white mr-4">
                                <i className="fas fa-microscope text-lg"></i>
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-800">Análisis Forense Completo</h4>
                                <p className="text-sm text-gray-600">
                                    Ejecutar análisis avanzado con 9 modelos de detección de anomalías
                                </p>
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleOpenForensicConfig}
                                className="px-4 py-2 text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
                                disabled={isRunningForensicAnalysis}
                            >
                                <i className="fas fa-cog mr-2"></i>
                                Configurar
                            </button>
                            <button
                                onClick={() => handleRunForensicAnalysis()}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-md"
                                disabled={isRunningForensicAnalysis}
                            >
                                {isRunningForensicAnalysis ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin mr-2"></i>
                                        Analizando...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-play mr-2"></i>
                                        Ejecutar Análisis
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal de Configuración Forense */}
                {forensicConfigOpen && (
                    <ForensicConfigModal
                        isOpen={forensicConfigOpen}
                        onClose={() => setForensicConfigOpen(false)}
                        onSave={handleSaveForensicConfig}
                    />
                )}

                {/* Modal de Resultados Forenses */}
                {forensicResultsOpen && forensicResults && appState.selectedPopulation && (
                    <ForensicResultsView
                        population={appState.selectedPopulation}
                        analysis={forensicResults}
                        onClose={() => setForensicResultsOpen(false)}
                        riskChartData={undefined} // NonStatistical no tiene gráfico de riesgos tradicional
                    />
                )}

                {/* Modal Explicativo de Métodos Forenses */}
                <ForensicExplanationModal
                    isOpen={explanationModalOpen}
                    onClose={() => setExplanationModalOpen(false)}
                    method={selectedMethod ? FORENSIC_METHODS[selectedMethod] : null}
                />

                {/* Modal de Anomalías Detectadas */}
                <ForensicAnomaliesModal
                    isOpen={anomaliesModalOpen}
                    onClose={() => setAnomaliesModalOpen(false)}
                    analysisType={selectedAnomalyType || ''}
                    populationId={appState.selectedPopulation?.id || ''}
                    title={selectedAnomalyTitle}
                />
            </div>
        </>
    );
};

export default NonStatisticalSampling;
