import React from 'react';
import Modal from '../ui/Modal';

interface ForensicMethod {
    id: string;
    name: string;
    objective: string;
    auditUse: string;
    formula: string;
    thresholds: string;
    parameters: string;
    icon: string;
    color: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    method: ForensicMethod | null;
}

const FORENSIC_METHODS: Record<string, ForensicMethod> = {
    entropy: {
        id: 'entropy',
        name: 'Análisis de Entropía',
        objective: 'Detectar anomalías en la distribución de categorías y subcategorías mediante el cálculo de entropía de Shannon.',
        auditUse: 'Identifica combinaciones categóricas inusuales que pueden indicar transacciones ficticias, clasificaciones erróneas o manipulación de datos maestros.',
        formula: 'H(X) = -Σ p(xi) × log₂(p(xi))\nEntropía Condicional: H(Y|X) = Σ p(x) × H(Y|X=x)\nInformación Mutua: I(X;Y) = H(Y) - H(Y|X)',
        thresholds: '• Entropía Alta (>3 bits): Distribución uniforme, normal\n• Entropía Media (1-3 bits): Algunas categorías dominantes\n• Entropía Baja (<1 bit): Concentración sospechosa\n• Combinaciones únicas: Alto riesgo de manipulación',
        parameters: 'Utiliza los campos de Categoría y Subcategoría definidos en el mapeo de variables. Detecta combinaciones con frecuencia <2% del total como anómalas.',
        icon: 'fa-microchip',
        color: 'blue'
    },
    splitting: {
        id: 'splitting',
        name: 'Detección de Fraccionamiento',
        objective: 'Identificar transacciones divididas artificialmente para evadir controles de autorización o límites establecidos.',
        auditUse: 'Detecta esquemas de fraude donde se dividen compras grandes en múltiples transacciones menores para evitar aprobaciones gerenciales.',
        formula: 'Score = Σ(Factores de Riesgo)\n• Suma > Umbral pero individuales < 90% umbral: +30 pts\n• Montos similares (variación <10%): +15 pts\n• Alta frecuencia (≥3 txns en ≤7 días): +20 pts\n• Cerca de umbrales redondos: +10 pts',
        thresholds: '• Score ≥40: Alto riesgo - Investigación inmediata\n• Score 20-39: Riesgo medio - Revisión detallada\n• Score <20: Riesgo bajo - Monitoreo normal\n• Umbrales configurables: $1K, $5K, $10K, $25K, $50K, $100K',
        parameters: 'Requiere campos: Monto, Proveedor y Fecha. Ventana de análisis: 30 días. Umbrales personalizables por el usuario en configuración avanzada.',
        icon: 'fa-scissors',
        color: 'yellow'
    },
    sequential: {
        id: 'sequential',
        name: 'Integridad Secuencial (Gaps)',
        objective: 'Detectar documentos faltantes en secuencias numéricas que pueden indicar eliminación o ocultamiento de transacciones.',
        auditUse: 'Identifica gaps en numeración de facturas, órdenes de compra o documentos que sugieren eliminación intencional o pérdida de registros.',
        formula: 'Gap Size = ID_siguiente - ID_anterior - 1\nRiesgo = f(Gap_Size, Frecuencia, Patrón)\n• Gap ≥50: Alto riesgo\n• Gap 10-49: Riesgo medio\n• Gap <10: Riesgo bajo',
        thresholds: '• Gaps grandes (≥50): Crítico - Posible eliminación sistemática\n• Gaps medianos (10-49): Medio - Requiere explicación\n• Gaps pequeños (<10): Bajo - Puede ser normal\n• Patrones regulares: Sospechoso independiente del tamaño',
        parameters: 'Utiliza el campo ID Secuencial definido en el mapeo. Extrae números de formatos mixtos (ej: FAC-001234). Analiza patrones y frecuencias.',
        icon: 'fa-barcode',
        color: 'red'
    },
    isolationForest: {
        id: 'isolationForest',
        name: 'Isolation Forest (ML)',
        objective: 'Detectar anomalías multidimensionales usando machine learning no supervisado basado en la facilidad de aislamiento de puntos de datos.',
        auditUse: 'Identifica transacciones anómalas considerando múltiples variables simultáneamente, detectando patrones complejos que otros métodos no capturan.',
        formula: 'Anomaly Score = 2^(-E(h(x))/c(n))\nE(h(x)) = Promedio de longitudes de path\nc(n) = 2H(n-1) - (2(n-1)/n)\nUmbral = Percentil 95 de scores',
        thresholds: '• Score >0.8: Alto riesgo - Anomalía clara\n• Score 0.7-0.8: Riesgo medio - Revisar contexto\n• Score 0.6-0.7: Riesgo bajo - Monitorear\n• Score <0.6: Normal - Sin acción requerida',
        parameters: 'Analiza 5 dimensiones: log(monto), día semana, hora, longitud ID, hash categoría. 50 árboles, profundidad máxima 8, submuestra 256 registros.',
        icon: 'fa-brain',
        color: 'purple'
    },
    actorProfiling: {
        id: 'actorProfiling',
        name: 'Perfilado de Actores',
        objective: 'Analizar patrones de comportamiento de usuarios individuales para detectar actividades sospechosas o anómalas.',
        auditUse: 'Identifica empleados con comportamientos de transacción inusuales que pueden indicar fraude interno, colusión o violación de políticas.',
        formula: 'Score = Σ(Patrones Sospechosos)\n• Fines de semana >30%: +15 pts\n• Fuera horario >40%: +20 pts\n• Días consecutivos >5: +10 pts\n• Montos redondos >50%: +15 pts\n• Duplicados >30%: +25 pts',
        thresholds: '• Score ≥50: Alto riesgo - Investigación de conducta\n• Score 25-49: Riesgo medio - Supervisión aumentada\n• Score <25: Riesgo bajo - Monitoreo normal\n• Patrones temporales: Críticos para detección',
        parameters: 'Requiere campo Usuario en el mapeo. Analiza patrones temporales (horarios, días) y de montos (redondos, duplicados, alto valor) por usuario.',
        icon: 'fa-user-secret',
        color: 'orange'
    },
    enhancedBenford: {
        id: 'enhancedBenford',
        name: 'Benford Mejorado',
        objective: 'Análisis avanzado de la Ley de Benford incluyendo primer y segundo dígito para detectar manipulación de datos financieros.',
        auditUse: 'Detecta fabricación de números, manipulación de cifras y datos artificiales mediante análisis estadístico de distribución de dígitos.',
        formula: 'MAD = (1/k) × Σ|Observado_i - Esperado_i|\nPrimer dígito: P(d) = log₁₀(1 + 1/d)\nSegundo dígito: Distribución más uniforme\nChi² = Σ((O-E)²/E)',
        thresholds: '• MAD <0.6%: Conformidad cercana - Normal\n• MAD 0.6-1.2%: Conformidad aceptable - Normal\n• MAD 1.2-1.5%: Conformidad marginal - Revisar\n• MAD >1.5%: No conformidad - Anomalías significativas',
        parameters: 'Utiliza campo Monetario. Analiza dígitos 1-9 (primero) y 0-9 (segundo). Mínimo 30 registros. Detecta patrones específicos de manipulación.',
        icon: 'fa-calculator',
        color: 'green'
    },
    benford: {
        id: 'benford',
        name: 'Ley de Benford Básica',
        objective: 'Detectar anomalías en la distribución del primer dígito de valores monetarios según la Ley de Benford.',
        auditUse: 'Identifica posible manipulación de datos financieros, fabricación de números o alteración de registros contables.',
        formula: 'P(d) = log₁₀(1 + 1/d)\nDesviación = |Frecuencia_Observada - Frecuencia_Esperada|\nUmbral = Desviación > 5%',
        thresholds: '• Dígito 1: Esperado 30.1% ± 5%\n• Dígito 2: Esperado 17.6% ± 5%\n• Dígito 3: Esperado 12.5% ± 5%\n• Desviación >5%: Sospechoso\n• Múltiples dígitos anómalos: Alto riesgo',
        parameters: 'Utiliza campo Monetario definido en mapeo. Analiza solo primer dígito (1-9). Requiere mínimo 100 registros para análisis confiable.',
        icon: 'fa-chart-bar',
        color: 'blue'
    },
    duplicates: {
        id: 'duplicates',
        name: 'Detección de Duplicados',
        objective: 'Identificar transacciones duplicadas usando claves compuestas inteligentes basadas en el mapeo de variables disponibles.',
        auditUse: 'Detecta errores de procesamiento, doble facturación, fraude por duplicación o problemas en sistemas de información.',
        formula: 'Clave = f(Mapeo_Disponible)\n• Con monto: ID_Único + Monto\n• Sin monto: ID_Único + Categoría + Subcategoría\n• Solo ID: ID_Único únicamente\nDuplicado = Clave_Count > 1',
        thresholds: '• >5 duplicados: Alto riesgo - Revisión sistemática\n• 1-5 duplicados: Riesgo medio - Verificar individualmente\n• 0 duplicados: Normal - Sin acción\n• Duplicados exactos: Críticos',
        parameters: 'Adaptativo según mapeo: prioriza Monto si disponible, luego Categorías, finalmente solo ID Único. Detecta duplicados exactos y parciales.',
        icon: 'fa-copy',
        color: 'red'
    },
    outliers: {
        id: 'outliers',
        name: 'Detección de Outliers',
        objective: 'Identificar valores atípicos usando método IQR (Rango Intercuartílico) para detectar transacciones inusualmente altas o bajas.',
        auditUse: 'Detecta transacciones de monto inusual que pueden indicar errores, fraude o transacciones que requieren mayor escrutinio.',
        formula: 'Q1 = Percentil 25, Q3 = Percentil 75\nIQR = Q3 - Q1\nUmbral_Superior = Q3 + 1.5 × IQR\nUmbral_Inferior = Q1 - 1.5 × IQR\nOutlier = Valor > Umbral_Superior',
        thresholds: '• Método IQR: Estadísticamente robusto\n• Factor 1.5: Estándar para outliers moderados\n• Factor 3.0: Para outliers extremos\n• Umbral dinámico: Se ajusta a cada población',
        parameters: 'Utiliza campo Monetario. Calcula umbrales dinámicamente por población. Considera solo valores positivos. Mínimo 10 registros para cálculo confiable.',
        icon: 'fa-expand-arrows-alt',
        color: 'orange'
    }
};

const ForensicExplanationModal: React.FC<Props> = ({ isOpen, onClose, method }) => {
    if (!method) return null;

    const getColorClasses = (color: string) => {
        const colors = {
            blue: 'from-blue-500 to-blue-600 border-blue-200 bg-blue-50',
            purple: 'from-purple-500 to-purple-600 border-purple-200 bg-purple-50',
            green: 'from-green-500 to-green-600 border-green-200 bg-green-50',
            red: 'from-red-500 to-red-600 border-red-200 bg-red-50',
            yellow: 'from-yellow-500 to-yellow-600 border-yellow-200 bg-yellow-50',
            orange: 'from-orange-500 to-orange-600 border-orange-200 bg-orange-50'
        };
        return colors[color as keyof typeof colors] || colors.blue;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="">
            <div className="space-y-6">
                {/* Header */}
                <div className={`bg-gradient-to-r ${getColorClasses(method.color)} border rounded-2xl p-6`}>
                    <div className="flex items-center gap-4">
                        <div className={`h-16 w-16 bg-gradient-to-r ${getColorClasses(method.color).split(' ')[0]} ${getColorClasses(method.color).split(' ')[1]} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                            <i className={`fas ${method.icon} text-2xl`}></i>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800">{method.name}</h2>
                            <p className="text-sm text-gray-600 mt-1">Análisis Forense Avanzado</p>
                        </div>
                    </div>
                </div>

                {/* Objetivo */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                            <i className="fas fa-bullseye text-sm"></i>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Objetivo del Método</h3>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{method.objective}</p>
                </div>

                {/* Uso en Auditoría */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-amber-600 rounded-lg flex items-center justify-center text-white">
                            <i className="fas fa-gavel text-sm"></i>
                        </div>
                        <h3 className="text-lg font-bold text-amber-800">Uso en Auditoría/Investigación</h3>
                    </div>
                    <p className="text-amber-800 leading-relaxed font-medium">{method.auditUse}</p>
                </div>

                {/* Fórmula */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-slate-600 rounded-lg flex items-center justify-center text-white">
                            <i className="fas fa-calculator text-sm"></i>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Fórmula Utilizada</h3>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-700">
                        <pre className="whitespace-pre-wrap">{method.formula}</pre>
                    </div>
                </div>

                {/* Umbrales */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
                            <i className="fas fa-sliders-h text-sm"></i>
                        </div>
                        <h3 className="text-lg font-bold text-green-800">Umbrales y Significado</h3>
                    </div>
                    <div className="space-y-2">
                        {method.thresholds.split('\n').map((threshold, index) => (
                            <div key={index} className="flex items-start gap-2">
                                <div className="h-2 w-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                                <p className="text-green-800 text-sm leading-relaxed">{threshold}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parámetros */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-purple-600 rounded-lg flex items-center justify-center text-white">
                            <i className="fas fa-cogs text-sm"></i>
                        </div>
                        <h3 className="text-lg font-bold text-purple-800">Parámetros y Configuración</h3>
                    </div>
                    <p className="text-purple-800 leading-relaxed">{method.parameters}</p>
                </div>

                {/* Botón de cerrar */}
                <div className="flex justify-end pt-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all font-medium"
                    >
                        <i className="fas fa-times mr-2"></i>
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export { FORENSIC_METHODS };
export default ForensicExplanationModal;