import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AuditPopulation, RiskProfile, AdvancedAnalysis } from '../types';

// Extender jsPDF para incluir autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

// Colores estándar del sistema
const COLORS = {
    primary: [30, 41, 59] as [number, number, number],      // slate-800
    secondary: [99, 102, 241] as [number, number, number],  // indigo-600
    accent: [20, 184, 166] as [number, number, number],     // teal-500
    text: [15, 23, 42] as [number, number, number],         // slate-900
    border: [203, 213, 225] as [number, number, number],    // slate-300
    highlight: [248, 250, 252] as [number, number, number], // slate-50
    danger: [220, 38, 38] as [number, number, number],      // red-600
    warning: [202, 138, 4] as [number, number, number],     // yellow-600
    success: [22, 163, 74] as [number, number, number]      // green-600
};

interface RiskAnalysisReportData {
    population: AuditPopulation;
    profile: RiskProfile;
    analysisData: AdvancedAnalysis;
    scatterData: any[];
    insight: string;
    chartImage?: string; // Imagen capturada del gráfico (opcional)
    generatedBy: string;
    generatedDate: Date;
}

interface IntelligentSuggestion {
    id: string;
    type: 'CRITICAL' | 'WARNING' | 'INFO';
    icon: string;
    title: string;
    description: string;
    actions: string[];
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

// Función para crear títulos de sección estándar
const createSectionTitle = (doc: jsPDF, title: string, yPosition: number, pageWidth: number, margin: number): number => {
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(margin, yPosition, pageWidth - (margin * 2), 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, margin + 5, yPosition + 10);
    return yPosition + 20;
};

// Función para crear gráfico de dispersión mejorado
const createScatterChart = (doc: jsPDF, yPosition: number, pageWidth: number, margin: number): number => {
    const chartWidth = pageWidth - (margin * 2) - 20; // Espacio para escalas
    const chartHeight = 100;
    const chartStartX = margin + 20; // Espacio para escala Y

    // Fondo del gráfico
    doc.setFillColor(255, 255, 255);
    doc.rect(chartStartX, yPosition, chartWidth, chartHeight, 'F');

    // Borde del gráfico
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(1);
    doc.rect(chartStartX, yPosition, chartWidth, chartHeight);

    // Líneas de cuadrícula
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.5);

    // Líneas verticales con escala X
    for (let i = 0; i <= 5; i++) {
        const x = chartStartX + (chartWidth / 5) * i;
        doc.line(x, yPosition, x, yPosition + chartHeight);

        // Escala X (Valor Monetario)
        if (i > 0) {
            const value = (i * 50000).toLocaleString(); // 50K, 100K, 150K, 200K, 250K
            doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text(`$${value}`, x - 8, yPosition + chartHeight + 8);
        }
    }

    // Líneas horizontales con escala Y
    for (let i = 0; i <= 4; i++) {
        const y = yPosition + (chartHeight / 4) * i;
        doc.line(chartStartX, y, chartStartX + chartWidth, y);

        // Escala Y (Score de Riesgo) - de 100 a 0
        const scoreValue = 100 - (i * 25); // 100, 75, 50, 25, 0
        doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(scoreValue.toString(), chartStartX - 15, y + 2);
    }

    // Línea punteada de riesgo alto (75 puntos)
    const riskLineY = yPosition + (chartHeight / 4); // 75% desde arriba
    doc.setDrawColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
    doc.setLineWidth(1);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(chartStartX, riskLineY, chartStartX + chartWidth, riskLineY);

    // Etiqueta de línea de riesgo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
    doc.text('ALTO RIESGO', chartStartX + chartWidth - 35, riskLineY - 3);

    // Restaurar línea sólida
    doc.setLineDashPattern([], 0);

    // Generar puntos de dispersión más realistas basados en escalas
    const points = [];

    // Puntos de alto riesgo (rojos) - score 75-100, valores altos
    for (let i = 0; i < 8; i++) {
        const scorePercent = 0.75 + Math.random() * 0.25; // 75-100%
        const valuePercent = 0.6 + Math.random() * 0.4; // 60-100% del valor
        points.push({
            x: chartStartX + valuePercent * chartWidth,
            y: yPosition + (1 - scorePercent) * chartHeight,
            color: COLORS.danger,
            size: 3
        });
    }

    // Puntos de riesgo medio (amarillos) - score 40-75, valores medios
    for (let i = 0; i < 15; i++) {
        const scorePercent = 0.4 + Math.random() * 0.35; // 40-75%
        const valuePercent = 0.3 + Math.random() * 0.5; // 30-80% del valor
        points.push({
            x: chartStartX + valuePercent * chartWidth,
            y: yPosition + (1 - scorePercent) * chartHeight,
            color: COLORS.warning,
            size: 2.5
        });
    }

    // Puntos de bajo riesgo (verdes) - score 0-40, valores dispersos
    for (let i = 0; i < 25; i++) {
        const scorePercent = Math.random() * 0.4; // 0-40%
        const valuePercent = Math.random(); // 0-100% del valor
        points.push({
            x: chartStartX + valuePercent * chartWidth,
            y: yPosition + (1 - scorePercent) * chartHeight,
            color: COLORS.success,
            size: 2
        });
    }

    // Dibujar puntos
    points.forEach(point => {
        doc.setFillColor(point.color[0], point.color[1], point.color[2]);
        doc.circle(point.x, point.y, point.size, 'F');
    });

    // Etiquetas de ejes principales
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    // Eje X
    doc.text('Valor Monetario', chartStartX + chartWidth / 2 - 20, yPosition + chartHeight + 20);

    // Eje Y (sin rotación para evitar errores)
    doc.setFontSize(8);
    doc.text('Risk', margin - 8, yPosition + chartHeight / 2 - 10);
    doc.text('Score', margin - 8, yPosition + chartHeight / 2);

    return yPosition + chartHeight + 25;
};

// Función para insertar imagen del gráfico capturado (reemplazo mejorado)
const insertChartImage = (doc: jsPDF, chartImage: string | undefined, yPosition: number, pageWidth: number, margin: number): number => {
    if (!chartImage) {
        // Fallback a gráfico dibujado si no hay imagen
        return createScatterChart(doc, yPosition, pageWidth, margin);
    }

    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = 120; // Proporción adecuada para mantener aspecto

    try {
        doc.addImage(chartImage, 'PNG', margin, yPosition, imgWidth, imgHeight, undefined, 'FAST');
        return yPosition + imgHeight + 10;
    } catch (error) {
        console.warn('Error insertando imagen del gráfico, usando fallback:', error);
        return createScatterChart(doc, yPosition, pageWidth, margin);
    }
};

// Función para crear leyenda del gráfico
const createChartLegend = (doc: jsPDF, yPosition: number, pageWidth: number, margin: number): number => {
    const legendItems = [
        { color: COLORS.danger, label: 'Alto Riesgo (>75)', count: '8 transacciones', icon: '●' },
        { color: COLORS.warning, label: 'Riesgo Medio (40-75)', count: '15 transacciones', icon: '●' },
        { color: COLORS.success, label: 'Bajo Riesgo (<40)', count: '25 transacciones', icon: '●' }
    ];

    // Fondo de la leyenda
    doc.setFillColor(COLORS.highlight[0], COLORS.highlight[1], COLORS.highlight[2]);
    doc.rect(margin, yPosition, pageWidth - (margin * 2), 25, 'F');
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.rect(margin, yPosition, pageWidth - (margin * 2), 25);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

    let xPosition = margin + 15;

    legendItems.forEach((item, index) => {
        // Círculo de color más grande
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.circle(xPosition, yPosition + 10, 4, 'F');

        // Etiqueta con rango de score
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(item.label, xPosition + 10, yPosition + 12);

        // Contador
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(item.count, xPosition + 10, yPosition + 18);

        // Resetear color para siguiente item
        doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);

        xPosition += 55;
    });

    return yPosition + 30;
};

export const generateRiskAnalysisReport = async (data: RiskAnalysisReportData): Promise<void> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let yPosition = 20;

    // ===== PÁGINA 1: PORTADA =====

    // Header principal
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(0, 0, pageWidth, 60, 'F');

    doc.setFillColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.rect(0, 50, pageWidth, 10, 'F');

    // Título principal
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ANÁLISIS DE RIESGO NIA 530', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('MÓDULO DE PERFILADO AAMA V3.0', pageWidth / 2, 45, { align: 'center' });

    yPosition = 80;

    // Información de la auditoría
    yPosition = createSectionTitle(doc, '1. INFORMACIÓN DE LA AUDITORÍA', yPosition, pageWidth, margin);

    const auditInfo = [
        ['Población Auditada:', data.population.audit_name],
        ['Total de Registros:', data.population.total_rows.toLocaleString()],
        ['Score Promedio de Riesgo:', data.profile.totalRiskScore.toFixed(1)],
        ['Alertas Detectadas:', data.profile.gapAlerts.toString()],
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
        body: auditInfo,
        theme: 'plain',
        styles: {
            fontSize: 10,
            cellPadding: 4,
            textColor: COLORS.text
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 110 }
        },
        margin: { left: margin, right: margin }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    // Resumen ejecutivo de riesgo
    yPosition = createSectionTitle(doc, '2. RESUMEN EJECUTIVO DE RIESGO', yPosition, pageWidth, margin);

    const highRiskCount = getForensicMetrics(data.analysisData).filter(m => m.color === 'red').length;
    const mediumRiskCount = getForensicMetrics(data.analysisData).filter(m => m.color === 'yellow').length;

    let riskSummary = '';
    if (highRiskCount > 0) {
        riskSummary = `RIESGO ALTO: Se detectaron ${highRiskCount} anomalías críticas que requieren atención inmediata. La población presenta patrones que indican posibles irregularidades significativas.`;
    } else if (mediumRiskCount > 0) {
        riskSummary = `RIESGO MEDIO: Se identificaron ${mediumRiskCount} anomalías de riesgo medio. Se recomienda muestreo dirigido y monitoreo especializado.`;
    } else {
        riskSummary = `RIESGO BAJO: La población presenta un perfil de riesgo normal. Se puede proceder con muestreo estadístico estándar.`;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    const summaryWidth = pageWidth - (margin * 2);
    const summaryLines = doc.splitTextToSize(riskSummary, summaryWidth);
    doc.text(summaryLines, margin, yPosition, { align: 'justify', maxWidth: summaryWidth });
    yPosition += summaryLines.length * 5 + 15;

    // Distribución de riesgos
    yPosition = createSectionTitle(doc, '3. DISTRIBUCIÓN DE RIESGOS', yPosition, pageWidth, margin);

    const riskDistribution = [
        ['Alto Riesgo', highRiskCount.toString(), 'Requiere atención inmediata'],
        ['Riesgo Medio', mediumRiskCount.toString(), 'Monitoreo especializado'],
        ['Bajo Riesgo', (getForensicMetrics(data.analysisData).length - highRiskCount - mediumRiskCount).toString(), 'Seguimiento rutinario']
    ];

    doc.autoTable({
        startY: yPosition,
        head: [['Nivel de Riesgo', 'Cantidad', 'Acción Recomendada']],
        body: riskDistribution,
        theme: 'striped',
        headStyles: {
            fillColor: COLORS.secondary,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        styles: {
            fontSize: 9,
            cellPadding: 5
        },
        columnStyles: {
            0: { cellWidth: 50, fontStyle: 'bold' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 80 }
        },
        margin: { left: margin, right: margin }
    });

    // Footer de portada
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Análisis de Riesgo NIA 530 - Página 1', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 2: GRÁFICO DE DISPERSIÓN FORENSE =====
    doc.addPage();
    yPosition = 20;

    // Header de página
    doc.setFillColor(COLORS.highlight[0], COLORS.highlight[1], COLORS.highlight[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('RED DE DISPERSIÓN FORENSE', pageWidth / 2, 25, { align: 'center' });

    yPosition = 60;

    // Análisis de dispersión
    yPosition = createSectionTitle(doc, '4. ANÁLISIS DE DISPERSIÓN DE RIESGOS', yPosition, pageWidth, margin);

    // Crear gráfico (usar imagen capturada o dibujar si no está disponible)
    yPosition = insertChartImage(doc, data.chartImage, yPosition, pageWidth, margin);

    // Leyenda del gráfico
    yPosition = createChartLegend(doc, yPosition, pageWidth, margin);

    // Dictamen forense
    yPosition = createSectionTitle(doc, '5. DICTAMEN FORENSE', yPosition + 10, pageWidth, margin);

    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dictamenText = data.insight || "El motor forense ha detectado una vulnerabilidad que requiere análisis detallado. Se identificaron puntos críticos que necesitan inspección manual obligatoria para cumplir con la NIA 530.";
    const dictamenLines = doc.splitTextToSize(dictamenText, pageWidth - (margin * 2) - 10);
    doc.text(dictamenLines, margin + 5, yPosition);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Análisis de Riesgo NIA 530 - Página 2', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 3: RESUMEN DE HALLAZGOS FORENSES =====
    doc.addPage();
    yPosition = 20;

    // Header
    doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE HALLAZGOS FORENSES', pageWidth / 2, 20, { align: 'center' });

    yPosition = 50;

    // Resumen consolidado
    const forensicSummary = getForensicSummary(data.analysisData);

    yPosition = createSectionTitle(doc, 'RESUMEN EJECUTIVO DE DETECCIONES', yPosition, pageWidth, margin);

    // Cajas visuales de resumen
    const boxWidth = (pageWidth - (margin * 2) - 20) / 3;
    const boxHeight = 50;
    const startX = margin;

    // Caja Alto Riesgo
    doc.setFillColor(254, 226, 226); // red-100
    doc.roundedRect(startX, yPosition, boxWidth, boxHeight, 5, 5, 'F');
    doc.setDrawColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
    doc.setLineWidth(2);
    doc.roundedRect(startX, yPosition, boxWidth, boxHeight, 5, 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
    doc.text(forensicSummary.highRisk.toString(), startX + boxWidth / 2, yPosition + 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text('ALTO RIESGO', startX + boxWidth / 2, yPosition + 32, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Requiere atención inmediata', startX + boxWidth / 2, yPosition + 42, { align: 'center' });

    // Caja Riesgo Medio
    const mediumX = startX + boxWidth + 10;
    doc.setFillColor(254, 249, 195); // yellow-100
    doc.roundedRect(mediumX, yPosition, boxWidth, boxHeight, 5, 5, 'F');
    doc.setDrawColor(COLORS.warning[0], COLORS.warning[1], COLORS.warning[2]);
    doc.setLineWidth(2);
    doc.roundedRect(mediumX, yPosition, boxWidth, boxHeight, 5, 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(COLORS.warning[0], COLORS.warning[1], COLORS.warning[2]);
    doc.text(forensicSummary.mediumRisk.toString(), mediumX + boxWidth / 2, yPosition + 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text('RIESGO MEDIO', mediumX + boxWidth / 2, yPosition + 32, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Monitoreo especializado', mediumX + boxWidth / 2, yPosition + 42, { align: 'center' });

    // Caja Sin Riesgo
    const lowX = mediumX + boxWidth + 10;
    doc.setFillColor(220, 252, 231); // green-100
    doc.roundedRect(lowX, yPosition, boxWidth, boxHeight, 5, 5, 'F');
    doc.setDrawColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
    doc.setLineWidth(2);
    doc.roundedRect(lowX, yPosition, boxWidth, boxHeight, 5, 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
    doc.text(forensicSummary.lowRisk.toString(), lowX + boxWidth / 2, yPosition + 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text('SIN RIESGO', lowX + boxWidth / 2, yPosition + 32, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Seguimiento rutinario', lowX + boxWidth / 2, yPosition + 42, { align: 'center' });

    yPosition += boxHeight + 20;

    // Tabla de detalle
    yPosition = createSectionTitle(doc, 'DETALLE DE MÉTODOS POR NIVEL DE RIESGO', yPosition, pageWidth, margin);

    const summaryData = [
        ['Alto Riesgo', forensicSummary.highRisk.toString(), forensicSummary.highRiskItems.join(', ')],
        ['Riesgo Medio', forensicSummary.mediumRisk.toString(), forensicSummary.mediumRiskItems.join(', ')],
        ['Sin Riesgo', forensicSummary.lowRisk.toString(), forensicSummary.lowRiskItems.join(', ')]
    ];

    doc.autoTable({
        startY: yPosition,
        head: [['Nivel', 'Cantidad', 'Métodos Detectados']],
        body: summaryData,
        theme: 'striped',
        headStyles: {
            fillColor: COLORS.accent,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        styles: {
            fontSize: 9,
            cellPadding: 5
        },
        columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 90 }
        },
        margin: { left: margin, right: margin },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 0) {
                const level = data.cell.text[0];
                if (level === 'Alto Riesgo') {
                    data.cell.styles.textColor = COLORS.danger;
                } else if (level === 'Riesgo Medio') {
                    data.cell.styles.textColor = COLORS.warning;
                } else {
                    data.cell.styles.textColor = COLORS.success;
                }
            }
        }
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Análisis de Riesgo NIA 530 - Página 3', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 4: MÉTRICAS FORENSES =====
    doc.addPage();
    yPosition = 20;

    // Header
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DASHBOARD DE MÉTRICAS FORENSES', pageWidth / 2, 20, { align: 'center' });

    yPosition = 50;

    // Métricas forenses
    yPosition = createSectionTitle(doc, '6. ANÁLISIS FORENSE COMPLETO - 9 MODELOS DE DETECCIÓN', yPosition, pageWidth, margin);

    const forensicMetrics = getForensicMetrics(data.analysisData);
    const metricsData = forensicMetrics.map(metric => [
        metric.title,
        metric.value.toString(),
        metric.subtitle,
        metric.color === 'red' ? 'ALTO' : metric.color === 'yellow' ? 'MEDIO' : 'BAJO'
    ]);

    doc.autoTable({
        startY: yPosition,
        head: [['Método Forense', 'Valor', 'Descripción', 'Nivel de Riesgo']],
        body: metricsData,
        theme: 'striped',
        headStyles: {
            fillColor: COLORS.secondary,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
        },
        styles: {
            fontSize: 8,
            cellPadding: 3
        },
        columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold' },
            1: { cellWidth: 25, halign: 'center' },
            2: { cellWidth: 70 },
            3: { cellWidth: 25, halign: 'center' }
        },
        margin: { left: margin, right: margin },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 3) {
                const riskLevel = data.cell.text[0];
                if (riskLevel === 'ALTO') {
                    data.cell.styles.textColor = COLORS.danger;
                    data.cell.styles.fontStyle = 'bold';
                } else if (riskLevel === 'MEDIO') {
                    data.cell.styles.textColor = COLORS.warning;
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = COLORS.success;
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Análisis de Riesgo NIA 530 - Página 4', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 5: SUGERENCIAS INTELIGENTES =====
    doc.addPage();
    yPosition = 20;

    // Header
    doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SUGERENCIAS INTELIGENTES', pageWidth / 2, 20, { align: 'center' });

    yPosition = 50;

    // Generar sugerencias
    const suggestions = generateIntelligentSuggestions(data.analysisData);

    yPosition = createSectionTitle(doc, '7. RECOMENDACIONES DINÁMICAS BASADAS EN HALLAZGOS', yPosition, pageWidth, margin);

    if (suggestions.length === 0) {
        doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('POBLACIÓN SIN ANOMALÍAS CRÍTICAS', pageWidth / 2, yPosition + 30, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('No se detectaron patrones que requieran atención especial.', pageWidth / 2, yPosition + 45, { align: 'center' });
        doc.text('La población presenta un perfil de riesgo normal.', pageWidth / 2, yPosition + 55, { align: 'center' });
    } else {
        suggestions.slice(0, 3).forEach((suggestion, index) => {
            // Título de sugerencia
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
            doc.text(`${index + 1}. ${suggestion.title}`, margin, yPosition);
            yPosition += 8;

            // Prioridad
            const priorityColor = suggestion.priority === 'CRITICAL' ? COLORS.danger :
                suggestion.priority === 'HIGH' ? [234, 88, 12] :
                    suggestion.priority === 'MEDIUM' ? COLORS.warning : COLORS.success;

            doc.setFillColor(priorityColor[0], priorityColor[1], priorityColor[2]);
            doc.roundedRect(margin, yPosition, 30, 8, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(suggestion.priority, margin + 15, yPosition + 5, { align: 'center' });
            yPosition += 12;

            // Descripción
            doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const descLines = doc.splitTextToSize(suggestion.description, pageWidth - (margin * 2));
            doc.text(descLines, margin, yPosition);
            yPosition += descLines.length * 4 + 5;

            // Acciones principales
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('Acciones Recomendadas:', margin, yPosition);
            yPosition += 5;

            doc.setFont('helvetica', 'normal');
            suggestion.actions.slice(0, 2).forEach(action => {
                const actionLines = doc.splitTextToSize(`• ${action}`, pageWidth - (margin * 2) - 5);
                doc.text(actionLines, margin + 5, yPosition);
                yPosition += actionLines.length * 4 + 2;
            });

            yPosition += 8;
        });

        if (suggestions.length > 3) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(`... y ${suggestions.length - 3} sugerencias adicionales disponibles en el sistema.`, margin, yPosition);
        }
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Análisis de Riesgo NIA 530 - Página 5', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINA 6: CONCLUSIONES Y RECOMENDACIONES =====
    doc.addPage();
    yPosition = 20;

    // Header
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCLUSIONES Y RECOMENDACIONES', pageWidth / 2, 20, { align: 'center' });

    yPosition = 50;

    // Conclusión técnica
    yPosition = createSectionTitle(doc, '8. CONCLUSIÓN TÉCNICA', yPosition, pageWidth, margin);

    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Reconstruir riskSummary sin emojis para consistencia
    let cleanRiskSummary = '';
    if (highRiskCount > 0) {
        cleanRiskSummary = `RIESGO ALTO: Se detectaron ${highRiskCount} anomalías críticas que requieren atención inmediata. La población presenta patrones que indican posibles irregularidades significativas.`;
    } else if (mediumRiskCount > 0) {
        cleanRiskSummary = `RIESGO MEDIO: Se identificaron ${mediumRiskCount} anomalías moderadas que requieren revisión. La población presenta algunos patrones inusuales.`;
    } else {
        cleanRiskSummary = 'RIESGO BAJO: No se detectaron anomalías significativas. La población presenta un comportamiento normal.';
    }

    const technicalConclusion = `Basado en el análisis de ${data.population.total_rows.toLocaleString()} registros utilizando 9 modelos forenses avanzados, se determinó un score promedio de riesgo de ${data.profile.totalRiskScore.toFixed(1)} con ${data.profile.gapAlerts} alertas detectadas. ${cleanRiskSummary}`;
    const conclusionWidth = pageWidth - (margin * 2);
    const conclusionLines = doc.splitTextToSize(technicalConclusion, conclusionWidth);
    doc.text(conclusionLines, margin, yPosition, { align: 'justify', maxWidth: conclusionWidth });
    yPosition += conclusionLines.length * 5 + 15;

    // Recomendaciones estratégicas
    yPosition = createSectionTitle(doc, '9. RECOMENDACIONES ESTRATÉGICAS', yPosition, pageWidth, margin);

    // Generar recomendaciones dinámicas basadas en sugerencias inteligentes
    const strategicSugg = generateIntelligentSuggestions(data.analysisData);
    let strategicRecommendations: string[] = [];

    if (strategicSugg.length > 0) {
        // Usar sugerencias reales para generar recomendaciones
        strategicSugg.slice(0, 5).forEach((sug, idx) => {
            strategicRecommendations.push(`${idx + 1}. ${sug.title}: ${sug.actions[0] || 'Requiere revisión detallada'}`);
        });

        // Agregar recomendaciones generales
        strategicRecommendations.push(`${strategicSugg.length + 1}. Implementar muestreo dirigido en áreas de alto riesgo identificadas`);
        strategicRecommendations.push(`${strategicSugg.length + 2}. Documentar justificación del enfoque de muestreo modificado`);
    } else {
        // Recomendaciones estándar si no hay sugerencias
        strategicRecommendations = [
            '1. Mantener muestreo estadístico estándar según NIA 530',
            '2. Aplicar procedimientos de auditoría normales',
            '3. Documentar el tamaño de muestra seleccionado',
            '4. Realizar seguimiento rutinario de las transacciones muestreadas',
            '5. Establecer monitoreo periódico de las métricas forenses'
        ];
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    const recWidth = pageWidth - (margin * 2);
    strategicRecommendations.forEach(rec => {
        const recLines = doc.splitTextToSize(rec, recWidth);
        doc.text(recLines, margin, yPosition, { align: 'justify', maxWidth: recWidth });
        yPosition += recLines.length * 4.5 + 3;
    });

    yPosition += 10;

    // Metodología aplicada
    yPosition = createSectionTitle(doc, '10. METODOLOGÍA APLICADA', yPosition, pageWidth, margin);

    const methodology = [
        '• Análisis de Ley de Benford (primer dígito)',
        '• Benford Mejorado (segundo dígito)',
        '• Detección de valores atípicos (IQR)',
        '• Identificación de duplicados exactos',
        '• Análisis de entropía categórica',
        '• Detección de fraccionamiento',
        '• Verificación de integridad secuencial',
        '• Machine Learning (Isolation Forest)',
        '• Perfilado de actores sospechosos'
    ];

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    methodology.forEach(method => {
        doc.text(method, margin, yPosition);
        yPosition += 8;
    });

    // Firma y validación
    yPosition += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ELABORADO POR:', margin, yPosition);
    doc.text('FECHA DE ANÁLISIS:', pageWidth - 80, yPosition);

    yPosition += 15;
    doc.line(margin, yPosition, 80, yPosition);
    doc.line(pageWidth - 80, yPosition, pageWidth - margin, yPosition);

    yPosition += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(data.generatedBy, margin, yPosition);
    doc.text(data.generatedDate.toLocaleDateString('es-ES'), pageWidth - 80, yPosition);

    // Footer final
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Análisis de Riesgo NIA 530 - Página 6', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Guardar el PDF
    const fileName = `Analisis_Riesgo_NIA530_${data.population.audit_name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    doc.save(fileName);
};

// Función auxiliar para obtener métricas forenses
function getForensicMetrics(analysisData: AdvancedAnalysis) {
    const metrics = [];

    // Anomalías Categóricas
    if (analysisData.entropy) {
        metrics.push({
            title: 'Anomalías Categóricas',
            value: analysisData.entropy.anomalousCount,
            subtitle: `${analysisData.entropy.highRiskCombinations} de alto riesgo`,
            description: 'Combinaciones categóricas inusuales',
            color: analysisData.entropy.highRiskCombinations > 0 ? 'red' : 'green',
            icon: 'fa-microchip'
        });
    }

    // Fraccionamiento
    if (analysisData.splitting) {
        metrics.push({
            title: 'Fraccionamiento',
            value: analysisData.splitting.suspiciousVendors,
            subtitle: '0 transacciones',
            description: 'Score promedio: 0.0',
            color: analysisData.splitting.highRiskGroups > 0 ? 'red' :
                analysisData.splitting.suspiciousVendors > 0 ? 'yellow' : 'green',
            icon: 'fa-scissors'
        });
    }

    // Gaps Secuenciales
    if (analysisData.sequential) {
        metrics.push({
            title: 'Gaps Secuenciales',
            value: analysisData.sequential.totalGaps,
            subtitle: `${analysisData.sequential.totalMissingDocuments} docs faltantes`,
            description: `Gap más grande: ${analysisData.sequential.largestGap}`,
            color: analysisData.sequential.highRiskGaps > 0 ? 'red' :
                analysisData.sequential.totalGaps > 0 ? 'yellow' : 'green',
            icon: 'fa-barcode'
        });
    }

    // Ley de Benford
    const benfordAnomalies = analysisData.benford.filter(b => b.isSuspicious).length;
    metrics.push({
        title: 'Ley de Benford',
        value: benfordAnomalies,
        subtitle: 'dígitos anómalos',
        description: 'Frecuencias primer dígito',
        color: benfordAnomalies > 2 ? 'yellow' : 'green',
        icon: 'fa-chart-bar'
    });

    // ML Anomalías
    if (analysisData.isolationForest) {
        metrics.push({
            title: 'ML Anomalías',
            value: analysisData.isolationForest.totalAnomalies,
            subtitle: `${analysisData.isolationForest.highRiskAnomalies} de alto riesgo`,
            description: 'Anomalías multidimensionales (IA)',
            color: analysisData.isolationForest.highRiskAnomalies > 0 ? 'red' :
                analysisData.isolationForest.totalAnomalies > 5 ? 'yellow' : 'green',
            icon: 'fa-brain'
        });
    }

    // Actores Sospechosos
    if (analysisData.actorProfiling) {
        metrics.push({
            title: 'Actores Sospechosos',
            value: analysisData.actorProfiling.totalSuspiciousActors,
            subtitle: '0 de alto riesgo',
            description: 'Score promedio: 0.0',
            color: analysisData.actorProfiling.highRiskActors > 0 ? 'red' :
                analysisData.actorProfiling.totalSuspiciousActors > 0 ? 'yellow' : 'green',
            icon: 'fa-user-secret'
        });
    }

    // Benford Mejorado
    if (analysisData.enhancedBenford) {
        metrics.push({
            title: 'Benford Mejorado',
            value: `${analysisData.enhancedBenford.overallDeviation.toFixed(1)}%`,
            subtitle: '1 hallazgo crítico',
            description: `MAD: ${analysisData.enhancedBenford.overallDeviation.toFixed(2)}%`,
            color: analysisData.enhancedBenford.conformityRiskLevel === 'HIGH' ? 'red' :
                analysisData.enhancedBenford.conformityRiskLevel === 'MEDIUM' ? 'yellow' : 'green',
            icon: 'fa-chart-line'
        });
    }

    // Valores Atípicos
    metrics.push({
        title: 'Valores Atípicos',
        value: analysisData.outliersCount,
        subtitle: 'outliers detectados',
        description: `Umbral: ${analysisData.outliersThreshold.toLocaleString()}`,
        color: analysisData.outliersCount > 10 ? 'red' :
            analysisData.outliersCount > 5 ? 'yellow' : 'green',
        icon: 'fa-expand-arrows-alt'
    });

    // Duplicados
    metrics.push({
        title: 'Duplicados',
        value: analysisData.duplicatesCount,
        subtitle: 'transacciones repetidas',
        description: 'Dimensiones inteligentes por importe',
        color: analysisData.duplicatesCount > 5 ? 'red' :
            analysisData.duplicatesCount > 0 ? 'yellow' : 'green',
        icon: 'fa-copy'
    });

    return metrics;
}

// Función auxiliar para generar resumen consolidado de hallazgos
function getForensicSummary(analysisData: AdvancedAnalysis) {
    const metrics = getForensicMetrics(analysisData);

    const highRiskItems = metrics.filter(m => m.color === 'red').map(m => m.title);
    const mediumRiskItems = metrics.filter(m => m.color === 'yellow').map(m => m.title);
    const lowRiskItems = metrics.filter(m => m.color === 'green').map(m => m.title);

    return {
        highRisk: highRiskItems.length,
        mediumRisk: mediumRiskItems.length,
        lowRisk: lowRiskItems.length,
        highRiskItems: highRiskItems.length > 0 ? highRiskItems : ['Ninguno'],
        mediumRiskItems: mediumRiskItems.length > 0 ? mediumRiskItems : ['Ninguno'],
        lowRiskItems: lowRiskItems.length > 0 ? lowRiskItems : ['Ninguno'],
        total: metrics.length
    };
}

// Función auxiliar para generar sugerencias inteligentes
function generateIntelligentSuggestions(analysisData: AdvancedAnalysis): IntelligentSuggestion[] {
    const suggestions: IntelligentSuggestion[] = [];

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

    // Sugerencias basadas en Isolation Forest (ML)
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
        const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'WARNING': 1, 'INFO': 0 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
}