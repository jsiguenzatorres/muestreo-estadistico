import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AdvancedAnalysis, AuditPopulation } from '../types';

// Extender jsPDF para incluir autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

interface ForensicReportData {
    population: AuditPopulation;
    analysis: AdvancedAnalysis;
    riskChartData?: {
        upperErrorLimit: number;
        tolerableError: number;
        method: string;
    };
    generatedBy: string;
    generatedDate: Date;
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

export const generateForensicReport = async (data: ForensicReportData): Promise<void> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Colores corporativos
    const primaryColor = [88, 28, 135]; // purple-800
    const accentColor = [59, 130, 246]; // blue-500
    const lightPurple = [243, 232, 255]; // purple-50
    const mediumGray = [148, 163, 184]; // slate-400
    const darkGray = [30, 41, 59]; // slate-800

    // Colores de riesgo
    const riskColors = {
        HIGH: [239, 68, 68], // red-500
        MEDIUM: [245, 158, 11], // amber-500
        LOW: [34, 197, 94], // green-500
        INFO: [59, 130, 246] // blue-500
    };

    // ===== PÁGINA 1: PORTADA =====
    
    // Header con gradiente simulado
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 70, 'F');
    
    doc.setFillColor(...accentColor);
    doc.rect(0, 60, pageWidth, 10, 'F');

    // Título principal
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('🔬 ANÁLISIS FORENSE COMPLETO', pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('DETECCIÓN AVANZADA DE ANOMALÍAS', pageWidth / 2, 50, { align: 'center' });

    // Información de la población
    yPosition = 100;
    doc.setTextColor(...darkGray);
    doc.setFillColor(...lightPurple);
    doc.roundedRect(15, yPosition - 10, pageWidth - 30, 60, 5, 5, 'F');
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE LA POBLACIÓN', 25, yPosition + 5);

    yPosition += 25;
    const populationInfo = [
        ['Nombre de Auditoría:', data.population.audit_name],
        ['Total de Registros:', data.population.total_rows.toLocaleString()],
        ['Fecha de Análisis:', data.generatedDate.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })],
        ['Analista Responsable:', data.generatedBy]
    ];

    doc.autoTable({
        startY: yPosition,
        head: [],
        body: populationInfo,
        theme: 'plain',
        styles: {
            fontSize: 11,
            cellPadding: 6,
            textColor: darkGray
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70 },
            1: { cellWidth: 110 }
        },
        margin: { left: 25, right: 25 }
    });

    // Construir métricas forenses
    const forensicMetrics: ForensicMetric[] = [];

    // 1. Análisis de Entropía
    if (data.analysis.entropy) {
        forensicMetrics.push({
            id: 'entropy_anomalies',
            title: 'Anomalías Categóricas',
            value: data.analysis.entropy.anomalousCount,
            description: `${data.analysis.entropy.highRiskCombinations} combinaciones de alto riesgo`,
            riskLevel: data.analysis.entropy.highRiskCombinations > 0 ? 'HIGH' : 'INFO',
            hasDetails: true,
            icon: 'microchip'
        });
    }

    // 2. Detección de Fraccionamiento
    if (data.analysis.splitting) {
        forensicMetrics.push({
            id: 'splitting_vendors',
            title: 'Proveedores Sospechosos',
            value: data.analysis.splitting.suspiciousVendors,
            description: `${data.analysis.splitting.highRiskGroups} grupos de alto riesgo`,
            riskLevel: data.analysis.splitting.highRiskGroups > 0 ? 'HIGH' : 
                      data.analysis.splitting.suspiciousVendors > 0 ? 'MEDIUM' : 'LOW',
            hasDetails: true,
            icon: 'scissors'
        });
    }

    // 3. Integridad Secuencial
    if (data.analysis.sequential) {
        forensicMetrics.push({
            id: 'sequential_gaps',
            title: 'Gaps Secuenciales',
            value: data.analysis.sequential.totalGaps,
            description: `${data.analysis.sequential.totalMissingDocuments} documentos faltantes`,
            riskLevel: data.analysis.sequential.highRiskGaps > 0 ? 'HIGH' : 
                      data.analysis.sequential.totalGaps > 0 ? 'MEDIUM' : 'LOW',
            hasDetails: true,
            icon: 'barcode'
        });
    }

    // 4. Isolation Forest
    if (data.analysis.isolationForest) {
        forensicMetrics.push({
            id: 'isolation_forest',
            title: 'ML Anomalías',
            value: data.analysis.isolationForest.totalAnomalies,
            description: `${data.analysis.isolationForest.highRiskAnomalies} anomalías de alto riesgo (IA)`,
            riskLevel: data.analysis.isolationForest.highRiskAnomalies > 0 ? 'HIGH' : 
                      data.analysis.isolationForest.totalAnomalies > 5 ? 'MEDIUM' : 'LOW',
            hasDetails: true,
            icon: 'brain'
        });
    }

    // 5. Enhanced Benford
    if (data.analysis.enhancedBenford) {
        forensicMetrics.push({
            id: 'enhanced_benford',
            title: 'Benford Mejorado',
            value: `${data.analysis.enhancedBenford.overallDeviation.toFixed(1)}%`,
            description: `MAD: ${data.analysis.enhancedBenford.overallDeviation.toFixed(2)}% - ${data.analysis.enhancedBenford.conformityLevel}`,
            riskLevel: data.analysis.enhancedBenford.conformityRiskLevel === 'HIGH' ? 'HIGH' : 
                      data.analysis.enhancedBenford.conformityRiskLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW',
            hasDetails: true,
            icon: 'chart-line'
        });
    }

    // 6. Análisis Tradicionales
    forensicMetrics.push({
        id: 'benford_anomalies',
        title: 'Anomalías de Benford',
        value: data.analysis.benford.filter(b => b.isSuspicious).length,
        description: 'Dígitos con frecuencias anómalas',
        riskLevel: data.analysis.benford.filter(b => b.isSuspicious).length > 2 ? 'MEDIUM' : 'INFO',
        hasDetails: true,
        icon: 'chart-bar'
    });

    forensicMetrics.push({
        id: 'outliers',
        title: 'Valores Atípicos',
        value: data.analysis.outliersCount,
        description: `Umbral IQR: ${data.analysis.outliersThreshold.toLocaleString()}`,
        riskLevel: data.analysis.outliersCount > 10 ? 'HIGH' : 
                  data.analysis.outliersCount > 5 ? 'MEDIUM' : 'LOW',
        hasDetails: true,
        icon: 'expand-arrows-alt'
    });

    forensicMetrics.push({
        id: 'duplicates',
        title: 'Duplicados',
        value: data.analysis.duplicatesCount,
        description: 'Transacciones potencialmente duplicadas',
        riskLevel: data.analysis.duplicatesCount > 5 ? 'HIGH' : 
                  data.analysis.duplicatesCount > 0 ? 'MEDIUM' : 'LOW',
        hasDetails: true,
        icon: 'copy'
    });

    // Resumen ejecutivo en portada
    yPosition = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN EJECUTIVO', 25, yPosition);

    const highRiskMetrics = forensicMetrics.filter(m => m.riskLevel === 'HIGH');
    const mediumRiskMetrics = forensicMetrics.filter(m => m.riskLevel === 'MEDIUM');

    yPosition += 20;
    let conclusion = '';
    if (highRiskMetrics.length === 0 && mediumRiskMetrics.length === 0) {
        conclusion = "✅ La población presenta un perfil de riesgo BAJO. No se detectaron anomalías significativas que requieran atención inmediata.";
    } else if (highRiskMetrics.length > 0) {
        const issues = highRiskMetrics.map(m => m.title.toLowerCase()).join(', ');
        conclusion = `🚨 La población presenta un perfil de riesgo ALTO debido a: ${issues}. Se recomienda revisión detallada inmediata.`;
    } else {
        const issues = mediumRiskMetrics.map(m => m.title.toLowerCase()).join(', ');
        conclusion = `⚠️ La población presenta un perfil de riesgo MEDIO con: ${issues}. Se recomienda monitoreo especializado.`;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const conclusionLines = doc.splitTextToSize(conclusion, pageWidth - 50);
    doc.text(conclusionLines, 25, yPosition);

    // Footer de portada
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.text('Análisis Forense Completo - Página 1', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 2: GRÁFICO DE RIESGOS =====
    if (data.riskChartData) {
        doc.addPage();
        yPosition = 20;

        // Header
        doc.setFillColor(...lightPurple);
        doc.rect(0, 0, pageWidth, 50, 'F');
        
        doc.setTextColor(...primaryColor);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('GRÁFICO DE EVALUACIÓN DE RIESGOS', pageWidth / 2, 30, { align: 'center' });

        yPosition = 80;

        // Simular gráfico de barras horizontales
        const upperLimit = data.riskChartData.upperErrorLimit;
        const tolerable = data.riskChartData.tolerableError;
        const isAcceptable = upperLimit <= tolerable;
        
        // Normalizar valores para el gráfico (máximo 150 puntos de ancho)
        const maxValue = Math.max(upperLimit, tolerable);
        const upperBarWidth = (upperLimit / maxValue) * 150;
        const tolerableBarWidth = (tolerable / maxValue) * 150;

        // Etiquetas
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Límite Superior (Proyección):', 20, yPosition);
        doc.text('Error Tolerable (Umbral):', 20, yPosition + 40);

        // Barras
        const barHeight = 20;
        const barStartX = 20;
        
        // Barra del límite superior
        const upperBarColor = isAcceptable ? 
            (upperLimit > tolerable * 0.9 ? [245, 158, 11] : [34, 197, 94]) : 
            riskColors.HIGH;
        doc.setFillColor(...upperBarColor);
        doc.rect(barStartX, yPosition + 10, upperBarWidth, barHeight, 'F');
        
        // Barra del error tolerable
        doc.setFillColor(...riskColors.INFO);
        doc.rect(barStartX, yPosition + 50, tolerableBarWidth, barHeight, 'F');

        // Valores
        doc.setTextColor(...darkGray);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        
        const formatValue = (val: number) => {
            if (data.riskChartData?.method === 'attribute') {
                return `${val}%`;
            }
            return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        };

        doc.text(formatValue(upperLimit), barStartX + upperBarWidth + 5, yPosition + 25);
        doc.text(formatValue(tolerable), barStartX + tolerableBarWidth + 5, yPosition + 65);

        // Conclusión del gráfico
        yPosition += 100;
        let actionLabel = "✅ Aceptable: Monitoreo Rutinario";
        let actionColor = riskColors.LOW;
        
        if (!isAcceptable) {
            actionLabel = "🔍 Inaceptable: Revisión Inmediata Requerida";
            actionColor = riskColors.HIGH;
        } else if (upperLimit > tolerable * 0.9) {
            actionLabel = "⚠ Precaución: Revisión Prioritaria";
            actionColor = riskColors.MEDIUM;
        }

        doc.setFillColor(...actionColor);
        doc.roundedRect(20, yPosition, pageWidth - 40, 30, 5, 5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(actionLabel, pageWidth / 2, yPosition + 20, { align: 'center' });

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(...mediumGray);
        doc.text('Análisis Forense Completo - Página 2', pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // ===== PÁGINA 3: DASHBOARD DE MÉTRICAS =====
    doc.addPage();
    yPosition = 20;

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DASHBOARD DE MÉTRICAS FORENSES', pageWidth / 2, 25, { align: 'center' });

    yPosition = 60;

    // Crear tabla de métricas
    const metricsData = forensicMetrics.map(metric => [
        metric.title,
        metric.value.toString(),
        metric.description,
        metric.riskLevel
    ]);

    doc.autoTable({
        startY: yPosition,
        head: [['Métrica Forense', 'Valor', 'Descripción', 'Nivel de Riesgo']],
        body: metricsData,
        theme: 'striped',
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        styles: {
            fontSize: 9,
            cellPadding: 4
        },
        columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 80 },
            3: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: 15, right: 15 },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 3) {
                const riskLevel = data.cell.text[0] as keyof typeof riskColors;
                if (riskLevel in riskColors) {
                    data.cell.styles.textColor = riskColors[riskLevel];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // Distribución de riesgos
    yPosition = (doc as any).lastAutoTable.finalY + 30;
    doc.setTextColor(...darkGray);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DISTRIBUCIÓN DE RIESGOS', 20, yPosition);

    const riskDistribution = {
        HIGH: forensicMetrics.filter(m => m.riskLevel === 'HIGH').length,
        MEDIUM: forensicMetrics.filter(m => m.riskLevel === 'MEDIUM').length,
        LOW: forensicMetrics.filter(m => m.riskLevel === 'LOW').length,
        INFO: forensicMetrics.filter(m => m.riskLevel === 'INFO').length
    };

    yPosition += 20;
    const distributionData = Object.entries(riskDistribution).map(([level, count]) => [
        level,
        count.toString(),
        `${((count / forensicMetrics.length) * 100).toFixed(1)}%`
    ]);

    doc.autoTable({
        startY: yPosition,
        head: [['Nivel de Riesgo', 'Cantidad', 'Porcentaje']],
        body: distributionData,
        theme: 'striped',
        headStyles: {
            fillColor: accentColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11
        },
        styles: {
            fontSize: 10,
            cellPadding: 6
        },
        columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: 20, right: 20 },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 0) {
                const riskLevel = data.cell.text[0] as keyof typeof riskColors;
                if (riskLevel in riskColors) {
                    data.cell.styles.textColor = riskColors[riskLevel];
                }
            }
        }
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.text('Análisis Forense Completo - Página 3', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 4: DETALLES POR MÉTODO =====
    doc.addPage();
    yPosition = 20;

    // Header
    doc.setFillColor(...lightPurple);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(...primaryColor);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ANÁLISIS DETALLADO POR MÉTODO', pageWidth / 2, 25, { align: 'center' });

    yPosition = 60;

    // Análisis de Benford detallado
    if (data.analysis.benford && data.analysis.benford.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ANÁLISIS DE LEY DE BENFORD', 20, yPosition);
        yPosition += 15;

        const benfordData = data.analysis.benford.map(b => [
            b.digit.toString(),
            `${(b.expected * 100).toFixed(1)}%`,
            `${(b.actual * 100).toFixed(1)}%`,
            `${(b.deviation * 100).toFixed(1)}%`,
            b.isSuspicious ? 'SÍ' : 'NO'
        ]);

        doc.autoTable({
            startY: yPosition,
            head: [['Dígito', 'Esperado', 'Actual', 'Desviación', 'Sospechoso']],
            body: benfordData,
            theme: 'striped',
            headStyles: {
                fillColor: primaryColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9
            },
            styles: {
                fontSize: 8,
                cellPadding: 3
            },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 25, halign: 'center' },
                2: { cellWidth: 25, halign: 'center' },
                3: { cellWidth: 25, halign: 'center' },
                4: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
            },
            margin: { left: 20, right: 20 },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 4 && data.cell.text[0] === 'SÍ') {
                    data.cell.styles.textColor = riskColors.HIGH;
                }
            }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Análisis de Enhanced Benford
    if (data.analysis.enhancedBenford) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('ANÁLISIS BENFORD MEJORADO (SEGUNDO DÍGITO)', 20, yPosition);
        yPosition += 15;

        const enhancedData = [
            ['Desviación General:', `${data.analysis.enhancedBenford.overallDeviation.toFixed(2)}%`],
            ['Nivel de Conformidad:', data.analysis.enhancedBenford.conformityLevel],
            ['Nivel de Riesgo:', data.analysis.enhancedBenford.conformityRiskLevel],
            ['Dígitos Anómalos:', data.analysis.enhancedBenford.anomalousDigits?.join(', ') || 'Ninguno']
        ];

        doc.autoTable({
            startY: yPosition,
            head: [],
            body: enhancedData,
            theme: 'plain',
            styles: {
                fontSize: 10,
                cellPadding: 5,
                textColor: darkGray
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60 },
                1: { cellWidth: 100 }
            },
            margin: { left: 20, right: 20 }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.text('Análisis Forense Completo - Página 4', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 5: CONCLUSIONES Y RECOMENDACIONES =====
    doc.addPage();
    yPosition = 20;

    // Header
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCLUSIONES Y RECOMENDACIONES', pageWidth / 2, 30, { align: 'center' });

    yPosition = 80;

    // Conclusión técnica
    doc.setTextColor(...darkGray);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCLUSIÓN TÉCNICA', 20, yPosition);

    yPosition += 20;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const technicalConclusion = doc.splitTextToSize(conclusion, pageWidth - 40);
    doc.text(technicalConclusion, 20, yPosition);
    yPosition += technicalConclusion.length * 6 + 25;

    // Recomendaciones específicas
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOMENDACIONES ESPECÍFICAS', 20, yPosition);

    yPosition += 20;
    const recommendations = [];
    
    if (highRiskMetrics.length > 0) {
        recommendations.push('1. PRIORIDAD ALTA: Investigar inmediatamente las anomalías de alto riesgo identificadas.');
        recommendations.push('2. Implementar controles adicionales en las áreas con mayor concentración de riesgos.');
    }
    
    if (data.analysis.splitting && data.analysis.splitting.suspiciousVendors > 0) {
        recommendations.push('3. Revisar manualmente los proveedores con patrones de fraccionamiento sospechosos.');
    }
    
    if (data.analysis.sequential && data.analysis.sequential.totalGaps > 0) {
        recommendations.push('4. Investigar los gaps secuenciales para determinar la causa de documentos faltantes.');
    }
    
    recommendations.push('5. Considerar muestreo dirigido en las áreas identificadas como de alto riesgo.');
    recommendations.push('6. Establecer monitoreo continuo de las métricas forenses identificadas.');
    recommendations.push('7. Documentar y dar seguimiento a las acciones correctivas implementadas.');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    recommendations.forEach(rec => {
        const recLines = doc.splitTextToSize(rec, pageWidth - 40);
        doc.text(recLines, 20, yPosition);
        yPosition += recLines.length * 5 + 8;
    });

    // Metodología aplicada
    yPosition += 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('METODOLOGÍA APLICADA', 20, yPosition);

    yPosition += 15;
    const methodology = [
        '• Análisis de Ley de Benford (primer y segundo dígito)',
        '• Detección de valores atípicos mediante método IQR',
        '• Identificación de duplicados exactos y aproximados',
        '• Análisis de entropía categórica',
        '• Detección de patrones de fraccionamiento',
        '• Verificación de integridad secuencial',
        '• Machine Learning (Isolation Forest) para anomalías multidimensionales',
        '• Perfilado de actores sospechosos'
    ];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    methodology.forEach(method => {
        doc.text(method, 20, yPosition);
        yPosition += 12;
    });

    // Firma y validación
    yPosition += 30;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ELABORADO POR:', 20, yPosition);
    doc.text('FECHA DE ANÁLISIS:', pageWidth - 120, yPosition);

    yPosition += 20;
    doc.line(20, yPosition, 120, yPosition);
    doc.line(pageWidth - 120, yPosition, pageWidth - 20, yPosition);

    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.generatedBy, 20, yPosition);
    doc.text(data.generatedDate.toLocaleDateString('es-ES'), pageWidth - 120, yPosition);

    // Footer final
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.text('Análisis Forense Completo - Página Final', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Guardar el PDF
    const fileName = `Analisis_Forense_${data.population.audit_name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    doc.save(fileName);
};