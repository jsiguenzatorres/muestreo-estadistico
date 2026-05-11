/**
 * 🏗️ NÚCLEO UNIFICADO DE REPORTES
 * 
 * Lógica común para generación de reportes PDF y Excel
 * Mantiene separación de responsabilidades pero evita duplicación
 */

import { AppState, SamplingMethod, AuditSampleItem } from '../types';
import { calculateInference } from './statisticalService';

// 🎨 CONSTANTES DE DISEÑO UNIFICADAS
export const REPORT_COLORS = {
    primary: [15, 23, 42] as [number, number, number],     // Oxford Black
    secondary: [30, 58, 138] as [number, number, number],  // Deep Navy
    accent: [5, 150, 105] as [number, number, number],     // Emerald
    danger: [185, 28, 28] as [number, number, number],     // Red 700
    warning: [245, 101, 101] as [number, number, number],  // Red 400
    success: [22, 163, 74] as [number, number, number],    // Green 600
    text: [30, 41, 59] as [number, number, number],
    border: [203, 213, 225] as [number, number, number],
    highlight: [248, 250, 252] as [number, number, number] // Slate 50
};

export const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return "$0.00";
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// 📊 INTERFAZ PARA DATOS PROCESADOS
export interface ProcessedReportData {
    // Información básica
    population: {
        name: string;
        totalRows: number;
        totalValue: number;
        uniqueIdColumn: string;
        monetaryColumn: string;
    };
    
    // Configuración del muestreo
    sampling: {
        method: SamplingMethod;
        objective: string;
        seed: number;
        sampleSize: number;
        parameters: any;
        formula: string;
        methodologyNotes: string[];
    };
    
    // Resultados y análisis
    results: {
        totalItems: number;
        conformeItems: number;
        exceptionItems: number;
        errorRate: number;
        exceptions: AuditSampleItem[];
        sample: AuditSampleItem[];
    };
    
    // Conclusiones
    conclusion: {
        verdict: 'Favorable' | 'Con Salvedades' | 'Adverso';
        description: string;
        color: [number, number, number];
        recommendations: string[];
    };
    
    // Distribución por fases
    phases: {
        pilot: { count: number; percentage: number };
        expansion: { count: number; percentage: number };
    };
    
    // Metadatos
    metadata: {
        generatedAt: Date;
        version: string;
        reportType: 'PDF' | 'Excel';
    };
}

/**
 * 🔄 PROCESADOR PRINCIPAL DE DATOS
 * Convierte AppState en datos estructurados para reportes
 */
export function processReportData(appState: AppState, reportType: 'PDF' | 'Excel'): ProcessedReportData {
    const { selectedPopulation: pop, results, generalParams, samplingMethod, samplingParams } = appState;
    
    if (!pop || !results) {
        throw new Error("Datos incompletos para generar el reporte.");
    }

    // 📊 PROCESAR INFORMACIÓN BÁSICA
    const population = {
        name: pop.file_name || 'Población sin nombre',
        totalRows: pop.total_rows || 0,
        totalValue: pop.total_monetary_value || 0,
        uniqueIdColumn: pop.column_mapping?.uniqueId || 'N/A',
        monetaryColumn: pop.column_mapping?.monetaryValue || 'N/A'
    };

    // 🔧 PROCESAR PARÁMETROS DE MUESTREO
    const sampling = {
        method: samplingMethod,
        objective: generalParams.objective || 'Evaluación de controles y saldos',
        seed: generalParams.seed,
        sampleSize: results.sampleSize,
        parameters: samplingParams,
        formula: generateFormula(samplingMethod, samplingParams),
        methodologyNotes: results.methodologyNotes || []
    };

    // 📈 PROCESAR RESULTADOS
    const exceptions = results.sample.filter(i => i.compliance_status === 'EXCEPCION');
    const totalErrors = exceptions.length;
    const errorRate = ((totalErrors / results.sampleSize) * 100);

    const resultsData = {
        totalItems: results.sampleSize,
        conformeItems: results.sampleSize - totalErrors,
        exceptionItems: totalErrors,
        errorRate: parseFloat(errorRate.toFixed(2)),
        exceptions: exceptions,
        sample: results.sample
    };

    // 🎯 GENERAR CONCLUSIÓN
    const conclusion = generateConclusion(samplingMethod, samplingParams, resultsData, population);

    // 📊 PROCESAR DISTRIBUCIÓN POR FASES
    const pilotCount = results.sample.filter(i => i.is_pilot_item).length;
    const expansionCount = results.sample.filter(i => !i.is_pilot_item).length;
    
    const phases = {
        pilot: {
            count: pilotCount,
            percentage: Math.round((pilotCount / results.sampleSize) * 100)
        },
        expansion: {
            count: expansionCount,
            percentage: Math.round((expansionCount / results.sampleSize) * 100)
        }
    };

    // 📋 METADATOS
    const metadata = {
        generatedAt: new Date(),
        version: 'AAMA v4.1',
        reportType
    };

    return {
        population,
        sampling,
        results: resultsData,
        conclusion,
        phases,
        metadata
    };
}

/**
 * 📐 GENERADOR DE FÓRMULAS POR MÉTODO
 */
function generateFormula(method: SamplingMethod, params: any): string {
    switch (method) {
        case SamplingMethod.MUS:
            return "Intervalo (J) = TE / Factor R; Muestra = Valor Total / J";
        
        case SamplingMethod.Attribute:
            return "n = (Factor de Confianza × 100) / (Error Tolerable - Error Esperado)";
        
        case SamplingMethod.CAV:
            return "n = [(N × Z × σ) / TE]²; Proyección = MPU × N";
        
        case SamplingMethod.Stratified:
            return "n_h = n × (p_h) donde p_h depende del método de asignación";
        
        case SamplingMethod.NonStatistical:
            return "Selección dirigida basada en juicio profesional y factores de riesgo";
        
        default:
            return "Fórmula específica según metodología aplicada";
    }
}

/**
 * 🎯 GENERADOR DE CONCLUSIONES
 */
function generateConclusion(
    method: SamplingMethod, 
    samplingParams: any, 
    results: any, 
    population: any
): ProcessedReportData['conclusion'] {
    
    let verdict: 'Favorable' | 'Con Salvedades' | 'Adverso' = 'Favorable';
    let description = "Los resultados obtenidos se encuentran dentro de los límites tolerables establecidos.";
    let color: [number, number, number] = REPORT_COLORS.success;
    let recommendations: string[] = [];

    if (results.exceptionItems > 0) {
        const errorRate = results.errorRate;
        
        if (method === SamplingMethod.MUS) {
            const mus = samplingParams.mus;
            if (mus && results.exceptionItems > 0) {
                verdict = 'Con Salvedades';
                description = `Se detectaron ${results.exceptionItems} excepciones (${errorRate}% de tasa de error). Se requiere evaluación adicional del impacto en la materialidad.`;
                color = REPORT_COLORS.warning;
                recommendations = [
                    "Investigar las causas raíz de las excepciones identificadas",
                    "Evaluar el impacto monetario de las desviaciones",
                    "Considerar ampliar la muestra si la proyección excede la materialidad"
                ];
            }
        } else if (method === SamplingMethod.Attribute) {
            const attr = samplingParams.attribute;
            if (attr && errorRate > attr.ET) {
                verdict = 'Adverso';
                description = `La tasa de error observada (${errorRate}%) EXCEDE el error tolerable establecido (${attr.ET}%). Los controles evaluados presentan deficiencias significativas.`;
                color = REPORT_COLORS.danger;
                recommendations = [
                    "Ampliar inmediatamente la muestra para confirmar hallazgos",
                    "Evaluar la efectividad del diseño de controles",
                    "Implementar controles compensatorios",
                    "Considerar impacto en la opinión de auditoría"
                ];
            } else {
                verdict = 'Con Salvedades';
                description = `Se detectaron ${results.exceptionItems} excepciones que requieren seguimiento, aunque dentro del umbral tolerable.`;
                color = REPORT_COLORS.warning;
                recommendations = [
                    "Documentar las excepciones para el archivo permanente",
                    "Evaluar si las excepciones son sistemáticas o aisladas"
                ];
            }
        } else {
            verdict = 'Con Salvedades';
            description = `Se identificaron ${results.exceptionItems} excepciones (${errorRate}% de tasa de error) que requieren análisis adicional.`;
            color = REPORT_COLORS.warning;
            recommendations = [
                "Analizar la naturaleza de las excepciones identificadas",
                "Evaluar si se requieren procedimientos adicionales"
            ];
        }
    } else {
        recommendations = [
            "Documentar la ausencia de excepciones en el archivo permanente",
            "Mantener los controles actuales según se evaluaron",
            "Considerar esta evaluación para futuras auditorías"
        ];
    }

    return { verdict, description, color, recommendations };
}

/**
 * 📊 PREPARADOR DE DATOS PARA EXCEL
 */
export function prepareExcelData(processedData: ProcessedReportData): any[] {
    const { results } = processedData;
    
    return results.sample.map((item, idx) => {
        // Determinar fase
        const fase = item.is_pilot_item ? "FASE 1: PILOTO" :
            (item.risk_factors?.some(f => f.includes('Ampliación')) ? "FASE 2: AMPLIACIÓN" : "MUESTRA");

        return {
            'Item #': idx + 1,
            'ID Referencia': item.id || 'N/A',
            'Fase / Origen': fase,
            'Estrato': item.stratum_label || 'E1',
            'Valor Libros / Importe': parseFloat(String(item.value || 0)),
            'Riesgo (Pts)': item.risk_score || 0,
            'Evaluación de Control': item.compliance_status === 'OK' ? 'CONFORME' : 'EXCEPCIÓN',
            'Hallazgos / Observaciones Técnicas': item.error_description || 
                (item.compliance_status === 'OK' ? 'Sin desviación detectada' : 'Requiere revisión')
        };
    });
}

/**
 * 📋 GENERADOR DE TABLAS PARA PDF
 */
export function generatePDFTables(processedData: ProcessedReportData) {
    const { population, sampling, results } = processedData;
    
    // Tabla de resumen ejecutivo
    const summaryTable = [
        ['Población Total', `${population.totalRows.toLocaleString()} registros`],
        ['Valor Total', formatCurrency(population.totalValue)],
        ['Método de Muestreo', sampling.method],
        ['Tamaño de Muestra', `${sampling.sampleSize} registros`],
        ['Semilla Estadística', sampling.seed.toString()]
    ];

    // Tabla de resultados
    const resultsTable = [
        ['Ítems Evaluados', results.totalItems.toString()],
        ['Ítems Conformes', results.conformeItems.toString()],
        ['Ítems con Excepción', results.exceptionItems.toString()],
        ['Tasa de Error', `${results.errorRate}%`]
    ];

    // Tabla de excepciones (si las hay)
    const exceptionsTable = results.exceptions.slice(0, 20).map((item, idx) => [
        (idx + 1).toString(),
        item.id || 'N/A',
        formatCurrency(item.value),
        item.error_description || 'Excepción detectada',
        item.stratum_label || 'E1'
    ]);

    return {
        summary: summaryTable,
        results: resultsTable,
        exceptions: exceptionsTable
    };
}

export default {
    processReportData,
    prepareExcelData,
    generatePDFTables,
    formatCurrency,
    REPORT_COLORS
};