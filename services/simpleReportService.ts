import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState, SamplingMethod } from '../types';

const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return "$0.00";
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * 🚨 GENERADOR DE REPORTES SIMPLIFICADO
 * 
 * Versión que evita problemas de RLS y cuelgues
 * Se enfoca en generar el PDF sin interacciones con BD
 */
export const generateSimpleAuditReport = async (appState: AppState) => {
    const { selectedPopulation: pop, results, generalParams, samplingMethod, samplingParams } = appState;
    
    if (!pop || !results) {
        throw new Error("Datos incompletos para generar el reporte.");
    }

    console.log("📄 Iniciando generación de reporte simplificado...");

    // 🎯 DETECCIÓN ESPECIAL PARA NO ESTADÍSTICO
    if (samplingMethod === SamplingMethod.NonStatistical) {
        console.log("🎯 Detectado método No Estadístico - Usando reporte especializado COMPLETO");
        
        // IMPORTAR LA FUNCIÓN ESPECIALIZADA DEL NUEVO ARCHIVO
        const { generateNonStatisticalReport } = await import('./nonStatisticalReportService');
        return generateNonStatisticalReport(appState);
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // --- HEADER ---
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 25, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("REPORTE DE AUDITORÍA", margin, 12);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Población: ${pop.file_name} | Fecha: ${new Date().toLocaleDateString()}`, margin, 19);

    // --- TÍTULO PRINCIPAL ---
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`MUESTREO ${samplingMethod.toUpperCase()}`, margin, 38);

    let currentY = 50;

    // --- RESUMEN EJECUTIVO ---
    doc.setFontSize(12);
    doc.text("RESUMEN EJECUTIVO", margin, currentY);
    currentY += 10;

    const summaryData = [
        ['Población Total', `${pop.total_rows?.toLocaleString() || 'N/A'} registros`],
        ['Valor Total', formatCurrency(pop.total_monetary_value)],
        ['Método de Muestreo', samplingMethod],
        ['Tamaño de Muestra', `${results.sampleSize} registros`],
        ['Semilla Estadística', generalParams.seed.toString()]
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['CONCEPTO', 'VALOR']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // --- PARÁMETROS DE MUESTREO ---
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("PARÁMETROS DE MUESTREO", margin, currentY);
    currentY += 10;

    let paramsData: string[][] = [];

    if (samplingMethod === SamplingMethod.MUS) {
        const mus = samplingParams.mus;
        paramsData = [
            ['Error Tolerable (TE)', formatCurrency(mus.TE)],
            ['Error Esperado (EE)', formatCurrency(mus.EE)],
            ['Riesgo de Evaluación Incorrecta', `${mus.RIA}%`],
            ['Tratamiento de Negativos', mus.handleNegatives || 'N/A'],
            ['Optimización Top Stratum', mus.optimizeTopStratum ? 'Sí' : 'No']
        ];
    } else if (samplingMethod === SamplingMethod.Attribute) {
        const attr = samplingParams.attribute;
        paramsData = [
            ['Nivel de Confianza', `${attr.NC}%`],
            ['Error Tolerable', `${attr.ET}%`],
            ['Error Esperado', `${attr.PE}%`],
            ['Muestreo Secuencial', attr.useSequential ? 'Sí' : 'No']
        ];
    }

    if (paramsData.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [['PARÁMETRO', 'VALOR']],
            body: paramsData,
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 9 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- RESULTADOS ---
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("RESULTADOS DE LA MUESTRA", margin, currentY);
    currentY += 10;

    const errors = results.sample.filter(i => i.compliance_status === 'EXCEPCION');
    const totalErrors = errors.length;
    const errorRate = ((totalErrors / results.sampleSize) * 100).toFixed(2);

    const resultsData = [
        ['Ítems Evaluados', results.sampleSize.toString()],
        ['Ítems Conformes', (results.sampleSize - totalErrors).toString()],
        ['Ítems con Excepción', totalErrors.toString()],
        ['Tasa de Error', `${errorRate}%`]
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['MÉTRICA', 'RESULTADO']],
        body: resultsData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        styles: { fontSize: 9 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // --- CONCLUSIÓN ---
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("CONCLUSIÓN", margin, currentY);
    currentY += 10;

    let conclusion = "Los resultados del muestreo se encuentran dentro de los parámetros esperados.";
    let conclusionColor = [22, 163, 74]; // Verde

    if (totalErrors > 0) {
        conclusion = `Se detectaron ${totalErrors} excepciones en la muestra (${errorRate}% de tasa de error). Se recomienda investigación adicional.`;
        conclusionColor = [220, 38, 38]; // Rojo
    }

    doc.setFillColor(conclusionColor[0], conclusionColor[1], conclusionColor[2]);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 12, 1, 1, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(totalErrors > 0 ? "CON OBSERVACIONES" : "SIN OBSERVACIONES", margin + 5, currentY + 8);

    // --- ANÁLISIS DE EXCEPCIONES (si las hay) ---
    if (errors.length > 0) {
        doc.addPage();
        
        // Header de página de excepciones
        doc.setFillColor(220, 38, 38); // Rojo para excepciones
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("ANÁLISIS DE EXCEPCIONES", margin, 12);
        
        currentY = 35;
        
        doc.setFontSize(12);
        doc.setTextColor(220, 38, 38);
        doc.text(`SE DETECTARON ${errors.length} EXCEPCIONES`, margin, currentY);
        currentY += 15;

        // Tabla de excepciones
        const exceptionsData = errors.slice(0, 20).map((item, idx) => [
            (idx + 1).toString(),
            item.id || 'N/A',
            formatCurrency(item.value),
            item.error_description || 'Excepción detectada',
            item.stratum_label || 'E1'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['#', 'ID ÍTEM', 'VALOR', 'DESCRIPCIÓN', 'ESTRATO']],
            body: exceptionsData,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 30 },
                2: { cellWidth: 25, halign: 'right' },
                3: { cellWidth: 80 },
                4: { cellWidth: 20, halign: 'center' }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Análisis estadístico de excepciones
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.text("ANÁLISIS ESTADÍSTICO DE EXCEPCIONES", margin, currentY);
        currentY += 10;

        const totalValueErrors = errors.reduce((sum, item) => sum + (item.value || 0), 0);
        const avgErrorValue = totalValueErrors / errors.length;
        const maxError = Math.max(...errors.map(e => e.value || 0));
        const minError = Math.min(...errors.map(e => e.value || 0));

        const errorAnalysis = [
            ['Total de Excepciones', errors.length.toString()],
            ['Tasa de Error', `${errorRate}%`],
            ['Valor Total de Excepciones', formatCurrency(totalValueErrors)],
            ['Valor Promedio por Excepción', formatCurrency(avgErrorValue)],
            ['Excepción de Mayor Valor', formatCurrency(maxError)],
            ['Excepción de Menor Valor', formatCurrency(minError)]
        ];

        autoTable(doc, {
            startY: currentY,
            head: [['MÉTRICA', 'VALOR']],
            body: errorAnalysis,
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 9 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Recomendaciones
        doc.setFontSize(12);
        doc.setTextColor(220, 38, 38);
        doc.text("RECOMENDACIONES", margin, currentY);
        currentY += 10;

        const recommendations = [
            "• Investigar las causas raíz de las excepciones identificadas",
            "• Evaluar si las excepciones son sistemáticas o aisladas",
            "• Considerar ampliar la muestra si la tasa de error es alta",
            "• Documentar los hallazgos para el archivo permanente",
            "• Evaluar el impacto en la opinión de auditoría"
        ];

        doc.setFontSize(10);
        doc.setTextColor(50);
        recommendations.forEach(rec => {
            doc.text(rec, margin, currentY);
            currentY += 6;
        });
    }

    // --- MUESTRA DETALLADA ---
    if (results.sample && results.sample.length > 0) {
        doc.addPage();
        
        // Header de segunda página
        doc.setFillColor(30, 58, 138);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("DETALLE DE LA MUESTRA", margin, 12);
        
        currentY = 35;
        
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.text("ÍTEMS SELECCIONADOS PARA AUDITORÍA", margin, currentY);
        currentY += 10;

        // Preparar datos de la muestra (máximo 50 ítems para evitar problemas)
        const sampleToShow = results.sample.slice(0, 50);
        const sampleData = sampleToShow.map((item, idx) => [
            (idx + 1).toString(),
            item.id || 'N/A',
            formatCurrency(item.value),
            item.compliance_status === 'OK' ? 'Conforme' : 'Excepción',
            item.stratum_label || 'E1',
            item.is_pilot_item ? 'Piloto' : 'Ampliación'
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['#', 'ID', 'VALOR', 'ESTADO', 'ESTRATO', 'FASE']],
            body: sampleData,
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 40 },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 25, halign: 'center' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 25, halign: 'center' }
            }
        });

        if (results.sample.length > 50) {
            currentY = (doc as any).lastAutoTable.finalY + 10;
            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`Nota: Se muestran los primeros 50 ítems de ${results.sample.length} total.`, margin, currentY);
        }
    }

    // --- METODOLOGÍA APLICADA ---
    doc.addPage();
    
    // Header de tercera página
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text("METODOLOGÍA Y FÓRMULAS", margin, 12);
    
    currentY = 35;
    
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("FUNDAMENTO TÉCNICO", margin, currentY);
    currentY += 10;

    // Explicación metodológica según el método
    let methodologyText = "";
    let formulaText = "";

    if (samplingMethod === SamplingMethod.MUS) {
        methodologyText = "El Muestreo por Unidades Monetarias (MUS) es una técnica de muestreo estadístico que selecciona ítems con probabilidad proporcional a su valor monetario. Cada peso en la población tiene la misma probabilidad de ser seleccionado, lo que hace que los ítems de mayor valor tengan mayor probabilidad de inclusión.";
        formulaText = "Intervalo de Muestreo (J) = TE / Factor de Confiabilidad\nTamaño de Muestra (n) = Valor Total de la Población / J";
    } else if (samplingMethod === SamplingMethod.Attribute) {
        methodologyText = "El Muestreo de Atributos evalúa la tasa de desviación de controles internos. Se basa en la distribución binomial y permite estimar la tasa de error en la población con un nivel de confianza específico.";
        formulaText = "n = (Factor de Confiabilidad × 100) / (Error Tolerable - Error Esperado)";
    } else {
        methodologyText = `El método ${samplingMethod} aplicado permite obtener conclusiones estadísticamente válidas sobre la población auditada.`;
        formulaText = "Fórmulas específicas aplicadas según metodología seleccionada.";
    }

    doc.setTextColor(50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitMethodology = doc.splitTextToSize(methodologyText, pageWidth - (margin * 2));
    doc.text(splitMethodology, margin, currentY);
    currentY += splitMethodology.length * 5 + 10;

    // Fórmula en caja destacada
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 25, 2, 2, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 138);
    doc.text("FÓRMULA APLICADA:", margin + 5, currentY + 8);
    doc.setFont('courier', 'normal');
    doc.setTextColor(50);
    const splitFormula = doc.splitTextToSize(formulaText, pageWidth - (margin * 2) - 10);
    doc.text(splitFormula, margin + 5, currentY + 16);

    currentY += 35;

    // --- NOTAS METODOLÓGICAS ---
    if (results.methodologyNotes && results.methodologyNotes.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.text("NOTAS TÉCNICAS", margin, currentY);
        currentY += 10;

        doc.setFontSize(9);
        doc.setTextColor(50);
        results.methodologyNotes.forEach((note, idx) => {
            const noteText = `${idx + 1}. ${note}`;
            const splitNote = doc.splitTextToSize(noteText, pageWidth - (margin * 2));
            doc.text(splitNote, margin, currentY);
            currentY += splitNote.length * 4 + 3;
        });
    }

    // --- INFORMACIÓN ADICIONAL ---
    currentY += 10;
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.text("INFORMACIÓN TÉCNICA ADICIONAL", margin, currentY);
    currentY += 10;

    const additionalInfo = [
        `Objetivo del Muestreo: ${generalParams.objective || 'Evaluación de controles y saldos'}`,
        `Fecha de Ejecución: ${new Date().toLocaleDateString()}`,
        `Hora de Generación: ${new Date().toLocaleTimeString()}`,
        `Versión del Sistema: AAMA v4.1`,
        `Método de Selección: Sistemático con inicio aleatorio`,
        `Cumplimiento NIA: NIA 530 - Muestreo de Auditoría`
    ];

    doc.setFontSize(9);
    doc.setTextColor(50);
    additionalInfo.forEach(info => {
        doc.text(info, margin, currentY);
        currentY += 5;
    });

    // --- FOOTER EN TODAS LAS PÁGINAS ---
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 30, pageHeight - 10);
        doc.text("Generado por AAMA v4.1 - Sistema de Muestreo de Auditoría", margin, pageHeight - 10);
    }

    // --- GUARDAR PDF ---
    const fileName = `Reporte_${samplingMethod}_${new Date().getTime()}.pdf`;
    doc.save(fileName);

    console.log(`✅ Reporte PDF generado: ${fileName}`);
    
    return fileName;
};