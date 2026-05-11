import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AuditObservation } from '../types';

// Extender jsPDF para incluir autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

interface ObservationsReportData {
    populationName: string;
    samplingMethod: string;
    observations: AuditObservation[];
    generatedBy: string;
    generatedDate: Date;
}

export const generateObservationsReport = async (data: ObservationsReportData): Promise<void> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPosition = 20;

    // Colores corporativos
    const primaryColor = [30, 41, 59]; // slate-800
    const accentColor = [20, 184, 166]; // teal-500
    const lightGray = [248, 250, 252]; // slate-50
    const mediumGray = [148, 163, 184]; // slate-400

    // ===== PÁGINA 1: PORTADA =====
    
    // Header con gradiente simulado
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    doc.setFillColor(...accentColor);
    doc.rect(0, 50, pageWidth, 10, 'F');

    // Logo y título principal
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('EXPEDIENTE DE OBSERVACIONES', pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('CONTROL DE EVIDENCIA NIA 530', pageWidth / 2, 45, { align: 'center' });

    // Información del expediente
    yPosition = 90;
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL EXPEDIENTE', 20, yPosition);

    yPosition += 20;
    const infoData = [
        ['Población Auditada:', data.populationName],
        ['Método de Muestreo:', data.samplingMethod],
        ['Total de Observaciones:', data.observations.length.toString()],
        ['Generado por:', data.generatedBy],
        ['Fecha de Generación:', data.generatedDate.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })]
    ];

    doc.autoTable({
        startY: yPosition,
        head: [],
        body: infoData,
        theme: 'plain',
        styles: {
            fontSize: 11,
            cellPadding: 8,
            textColor: primaryColor
        },
        columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 120 }
        },
        margin: { left: 20, right: 20 }
    });

    // Resumen por severidad
    yPosition = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN POR SEVERIDAD', 20, yPosition);

    const severityCounts = {
        'Alto': data.observations.filter(o => o.severidad === 'Alto').length,
        'Medio': data.observations.filter(o => o.severidad === 'Medio').length,
        'Bajo': data.observations.filter(o => o.severidad === 'Bajo').length
    };

    const severityColors = {
        'Alto': [239, 68, 68], // red-500
        'Medio': [245, 158, 11], // amber-500
        'Bajo': [34, 197, 94] // green-500
    };

    yPosition += 20;
    const severityData = Object.entries(severityCounts).map(([severity, count]) => [
        severity,
        count.toString(),
        count > 0 ? 'Requiere Atención' : 'Sin Hallazgos'
    ]);

    doc.autoTable({
        startY: yPosition,
        head: [['Severidad', 'Cantidad', 'Estado']],
        body: severityData,
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
            0: { cellWidth: 40, fontStyle: 'bold' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 60 }
        },
        margin: { left: 20, right: 20 },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 0) {
                const severity = data.cell.text[0];
                if (severity in severityColors) {
                    data.cell.styles.textColor = severityColors[severity as keyof typeof severityColors];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    // Resumen por tipo
    yPosition = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN POR TIPO', 20, yPosition);

    const typeCounts = {
        'Control': data.observations.filter(o => o.tipo === 'Control').length,
        'Sustantivo': data.observations.filter(o => o.tipo === 'Sustantivo').length,
        'Cumplimiento': data.observations.filter(o => o.tipo === 'Cumplimiento').length
    };

    yPosition += 20;
    const typeData = Object.entries(typeCounts).map(([type, count]) => [
        type,
        count.toString(),
        `${((count / data.observations.length) * 100).toFixed(1)}%`
    ]);

    doc.autoTable({
        startY: yPosition,
        head: [['Tipo de Observación', 'Cantidad', 'Porcentaje']],
        body: typeData,
        theme: 'striped',
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11
        },
        styles: {
            fontSize: 10,
            cellPadding: 6
        },
        columnStyles: {
            0: { cellWidth: 60, fontStyle: 'bold' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: 20, right: 20 }
    });

    // Footer de página
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.text('Expediente de Observaciones - Página 1', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // ===== PÁGINAS SIGUIENTES: DETALLE DE OBSERVACIONES =====
    
    if (data.observations.length > 0) {
        data.observations.forEach((observation, index) => {
            doc.addPage();
            yPosition = 20;

            // Header de página
            doc.setFillColor(...lightGray);
            doc.rect(0, 0, pageWidth, 40, 'F');
            
            doc.setTextColor(...primaryColor);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(`OBSERVACIÓN ${index + 1}`, 20, 25);

            // Badge de severidad
            const severityColor = severityColors[observation.severidad as keyof typeof severityColors];
            doc.setFillColor(...severityColor);
            doc.roundedRect(pageWidth - 80, 15, 60, 15, 3, 3, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(observation.severidad.toUpperCase(), pageWidth - 50, 25, { align: 'center' });

            yPosition = 60;

            // Título de la observación
            doc.setTextColor(...primaryColor);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('TÍTULO:', 20, yPosition);
            
            yPosition += 15;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            const titleLines = doc.splitTextToSize(observation.titulo, pageWidth - 40);
            doc.text(titleLines, 20, yPosition);
            yPosition += titleLines.length * 6 + 15;

            // Información básica
            const basicInfo = [
                ['Tipo:', observation.tipo],
                ['Severidad:', observation.severidad],
                ['Creado por:', observation.creado_por || 'N/A'],
                ['Fecha:', observation.fecha_creacion ? 
                    new Date(observation.fecha_creacion).toLocaleDateString('es-ES') : 'N/A']
            ];

            doc.autoTable({
                startY: yPosition,
                head: [],
                body: basicInfo,
                theme: 'plain',
                styles: {
                    fontSize: 10,
                    cellPadding: 5,
                    textColor: primaryColor
                },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 40 },
                    1: { cellWidth: 100 }
                },
                margin: { left: 20, right: 20 }
            });

            yPosition = (doc as any).lastAutoTable.finalY + 20;

            // Descripción
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('DESCRIPCIÓN:', 20, yPosition);
            
            yPosition += 15;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const descLines = doc.splitTextToSize(observation.descripcion, pageWidth - 40);
            doc.text(descLines, 20, yPosition);
            yPosition += descLines.length * 5 + 20;

            // Evidencias
            if (observation.evidencias && observation.evidencias.length > 0) {
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('EVIDENCIAS ADJUNTAS:', 20, yPosition);
                yPosition += 15;

                const evidenceData = observation.evidencias.map((evidence, idx) => [
                    (idx + 1).toString(),
                    evidence.nombre,
                    evidence.tipo,
                    'Disponible en Sistema'
                ]);

                doc.autoTable({
                    startY: yPosition,
                    head: [['#', 'Nombre del Archivo', 'Tipo', 'Estado']],
                    body: evidenceData,
                    theme: 'striped',
                    headStyles: {
                        fillColor: accentColor,
                        textColor: [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 10
                    },
                    styles: {
                        fontSize: 9,
                        cellPadding: 4
                    },
                    columnStyles: {
                        0: { cellWidth: 15, halign: 'center' },
                        1: { cellWidth: 80 },
                        2: { cellWidth: 40 },
                        3: { cellWidth: 45, halign: 'center' }
                    },
                    margin: { left: 20, right: 20 }
                });
            } else {
                doc.setFontSize(10);
                doc.setTextColor(...mediumGray);
                doc.text('Sin evidencias adjuntas', 20, yPosition);
            }

            // Footer de página
            doc.setFontSize(8);
            doc.setTextColor(...mediumGray);
            doc.text(`Expediente de Observaciones - Página ${index + 2}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        });
    }

    // ===== PÁGINA FINAL: CONCLUSIONES =====
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

    // Análisis de riesgo
    doc.setTextColor(...primaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ANÁLISIS DE RIESGO', 20, yPosition);

    yPosition += 20;
    const highRisk = data.observations.filter(o => o.severidad === 'Alto').length;
    const mediumRisk = data.observations.filter(o => o.severidad === 'Medio').length;
    const lowRisk = data.observations.filter(o => o.severidad === 'Bajo').length;

    let riskAssessment = '';
    if (highRisk > 0) {
        riskAssessment = `Se identificaron ${highRisk} observaciones de ALTO RIESGO que requieren atención inmediata. `;
    }
    if (mediumRisk > 0) {
        riskAssessment += `Existen ${mediumRisk} observaciones de riesgo medio que deben ser monitoreadas. `;
    }
    if (lowRisk > 0) {
        riskAssessment += `Se registraron ${lowRisk} observaciones de bajo riesgo para seguimiento rutinario.`;
    }
    if (data.observations.length === 0) {
        riskAssessment = 'No se registraron observaciones durante el proceso de auditoría.';
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const riskLines = doc.splitTextToSize(riskAssessment, pageWidth - 40);
    doc.text(riskLines, 20, yPosition);
    yPosition += riskLines.length * 6 + 25;

    // Recomendaciones
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOMENDACIONES', 20, yPosition);

    yPosition += 20;
    const recommendations = [
        '1. Revisar y dar seguimiento a todas las observaciones de alto riesgo identificadas.',
        '2. Implementar controles correctivos para las deficiencias encontradas.',
        '3. Establecer un cronograma de seguimiento para las observaciones de riesgo medio.',
        '4. Documentar las acciones correctivas implementadas.',
        '5. Realizar revisiones periódicas para verificar la efectividad de las mejoras.'
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    recommendations.forEach(rec => {
        const recLines = doc.splitTextToSize(rec, pageWidth - 40);
        doc.text(recLines, 20, yPosition);
        yPosition += recLines.length * 5 + 8;
    });

    // Firma y fecha
    yPosition += 30;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ELABORADO POR:', 20, yPosition);
    doc.text('FECHA:', pageWidth - 100, yPosition);

    yPosition += 20;
    doc.line(20, yPosition, 120, yPosition);
    doc.line(pageWidth - 100, yPosition, pageWidth - 20, yPosition);

    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.generatedBy, 20, yPosition);
    doc.text(data.generatedDate.toLocaleDateString('es-ES'), pageWidth - 100, yPosition);

    // Footer final
    doc.setFontSize(8);
    doc.setTextColor(...mediumGray);
    doc.text(`Expediente de Observaciones - Página Final`, pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Guardar el PDF
    const fileName = `Expediente_Observaciones_${data.samplingMethod}_${Date.now()}.pdf`;
    doc.save(fileName);
};