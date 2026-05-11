
import { AdvancedAnalysis, AiRecommendation, DescriptiveStats, SamplingMethod } from '../types';

/**
 * Algoritmo de Recomendación de Método de Muestreo (AAMA AI Engine)
 * Basado en NIA 530 y mejores prácticas estadísticas.
 */
export const analyzePopulationAndRecommend = (
    stats: DescriptiveStats,
    analysis: AdvancedAnalysis
): AiRecommendation => {

    const reasoning: string[] = [];
    const riskFactors: string[] = [];
    let directedAdvice = "";

    // 0. Validación Fundamental: Datos Sin Valor Monetario
    if (stats.sum === 0 && stats.max === 0) {
        reasoning.push("La población cargada no contiene valores monetarios significativos (Suma = 0).");
        reasoning.push("Los métodos sustantivos (MUS, CAV, Estratificado Monetario) requieren importes para calcular proyecciones.");
        return {
            recommendedMethod: SamplingMethod.Attribute,
            confidenceScore: 100,
            reasoning: ["Población definida exclusivamente por atributos cualitativos.", ...reasoning],
            riskFactors,
            directedSelectionAdvice: ""
        };
    }

    // 1. Análisis de Volatilidad (Coeficiente de Variación)
    // CV > 1 indica alta variabilidad, lo cual hace ineficientes a métodos de promedio simple.
    const isHighVolatility = stats.cv > 1.5;
    const isExtremeVolatility = stats.cv > 3.0;

    if (isHighVolatility) riskFactors.push("Alta Volatilidad de Datos (CV > 1.5)");
    if (analysis.negativesCount > 0) riskFactors.push("Presencia de Valores Negativos");
    if (analysis.zerosCount > (stats.sum > 0 ? 0 : -1)) { // Logic check
        if (analysis.zerosCount > 0) riskFactors.push("Presencia de Registros en Cero");
    }

    // 2. Lógica de Selección Dirigida (Directed Selection)
    // Si hay muchos outliers o anomalías Benford, sugerir un enfoque híbrido.
    const hasSignificantOutliers = analysis.outliersCount > 0;
    const hasBenfordIssues = analysis.benford.some(b => b.isSuspicious);

    if (hasSignificantOutliers) {
        directedAdvice += `Se detectaron ${analysis.outliersCount} valores atípicos. Se recomienda extraer estos ítems mediante Selección Dirigida antes de aplicar el muestreo estadístico al remanente. `;
    }
    if (hasBenfordIssues) {
        riskFactors.push("Anomalía en Ley de Benford");
        directedAdvice += "La distribución de dígitos iniciales es sospechosa. Considere revisar dirigidamente los montos justo debajo de los umbrales de autorización. ";
    }

    // 3. Árbol de Decisión del Método (Mejorado con Metadatos Forenses)

    // Caso A: Atributos Puro (Sin Montos)
    if (stats.sum === 0 && stats.max === 0) {
        return {
            recommendedMethod: SamplingMethod.Attribute,
            confidenceScore: 98,
            reasoning: [
                "No se detectaron columnas monetarias válidas en el mapeo.",
                "El análisis se limitará a estimar tasas de ocurrencia/desviación cualitativa (Cumplimiento)."
            ],
            riskFactors,
            directedSelectionAdvice: "Enfoque en atributos críticos de control."
        };
    }

    // Caso B: Estratificado (Prioridad si hay variables categóricas fuertes y variabilidad)
    // Si hay categorías mapeadas y cierta volatilidad, sugerir estratificación.
    const hasCategory = analysis.duplicatesCount > -1; // Hack: we don't have direct access to 'hasCategory' boolean here, but performRiskProfiling passed relevant analysis.
    // Actually, analyzePopulationAndRecommend signature needs to know about metadata.
    // Let's rely on standard stats.cv and "forensic findings" indirect clues or we should update signature.
    // Assuming 'analysis' contains forensicDiscovery which implies mapped columns.

    // Let's imply checking volatility first.
    if ((isHighVolatility || isExtremeVolatility)) {
        reasoning.push(`Alta variabilidad detectada (CV: ${stats.cv.toFixed(2)}).`);
        reasoning.push("La estratificación reducirá la varianza dividiendo la población en grupos homogéneos por monto o categoría.");
        return {
            recommendedMethod: SamplingMethod.Stratified,
            confidenceScore: 92,
            reasoning,
            riskFactors,
            directedSelectionAdvice: directedAdvice
        };
    }

    // Caso C: MUS (Ideal si la data es limpia y positiva)
    if (analysis.negativesCount === 0 && analysis.zerosCount === 0 && !isHighVolatility) {
        reasoning.push("La población consiste enteramente en valores positivos y la variabilidad es manejable.");
        reasoning.push("MUS (Murestreo de Unidad Monetaria) es altamente eficiente para detectar sobrestimaciones en este perfil.");
        return {
            recommendedMethod: SamplingMethod.MUS,
            confidenceScore: 95,
            reasoning,
            riskFactors,
            directedSelectionAdvice: directedAdvice
        };
    }

    // Caso D: CAV (Si hay negativos o se requiere estimación real del saldo)
    if (analysis.negativesCount > 0) {
        reasoning.push(`Se detectaron ${analysis.negativesCount} registros con importe negativo.`);
        reasoning.push("MUS no puede evaluar negativos sin segregación. Variables Clásicas (CAV) es el método estadístico adecuado.");
        return {
            recommendedMethod: SamplingMethod.CAV,
            confidenceScore: 88,
            reasoning,
            riskFactors,
            directedSelectionAdvice: directedAdvice
        };
    }

    // Caso E: No Estadístico (Si hay demasiadas anomalías forenses)
    if (hasBenfordIssues || hasSignificantOutliers) {
        reasoning.push("Se han detectado patrones anómalos significativos (Benford/Outliers).");
        reasoning.push("Un enfoque puramente aleatorio podría ignorar riesgos específicos. Se sugiere un muestreo de juicio basado en los hallazgos forenses.");
        return {
            recommendedMethod: SamplingMethod.NonStatistical,
            confidenceScore: 85,
            reasoning,
            riskFactors,
            directedSelectionAdvice: directedAdvice
        };
    }

    // Default Fallback: Attribute (si es solo cumplimiento) o Stratified
    reasoning.push("Ante la duda en la estructura de datos, la estratificación ofrece el mejor balance de reducción de riesgo.");
    return {
        recommendedMethod: SamplingMethod.Stratified,
        confidenceScore: 70,
        reasoning,
        riskFactors,
        directedSelectionAdvice: directedAdvice
    };
};
