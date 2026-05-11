import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState, SamplingMethod, AdvancedAnalysis } from '../types';

const COLORS = {
    primary: [20, 184, 166] as [number, number, number],    // Teal 500 - Distintivo
    secondary: [15, 118, 110] as [number, number, number],  // Teal 700
    accent: [5, 150, 105] as [number, number, number],      // Emerald
    danger: [185, 28, 28] as [number, number, number],      // Red 700
    text: [30, 41, 59] as [number, number, number],
    border: [203, 213, 225] as [number, number, number],
    highlight: [248, 250, 252] as [number, number, number]  // Slate 50
};

const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return "$0.00";
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Función para generar el diagnóstico forense en PDF
const generateForensicDiagnosis = (doc: jsPDF, analysis: AdvancedAnalysis, startY: number, pageWidth: number, margin: number): number => {
    let currentY = startY;
    
    // Determinar si es análisis básico o forense
    const hasForensicAnalysis = analysis.entropy || analysis.splitting || analysis.sequential || 
                               analysis.isolationForest || analysis.actorProfiling || analysis.enhancedBenford;
    
    const diagnosisTitle = hasForensicAnalysis ? "DIAGNÓSTICO PRELIMINAR DE ANÁLISIS FORENSE" : "DIAGNÓSTICO PRELIMINAR DE ANÁLISIS BÁSICO";
    
    // Título de la sección
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(margin, currentY, pageWidth - (margin * 2), 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(diagnosisTitle, margin + 5, currentY + 10);
    
    currentY += 20;
    
    // Resumen ejecutivo del análisis
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("RESUMEN EJECUTIVO DE HALLAZGOS", margin, currentY);
    currentY += 8;
    
    // Análisis básico siempre presente
    const basicFindings = [];
    
    // Ley de Benford
    if (analysis.benford && analysis.benford.length > 0) {
        const suspiciousDigits = analysis.benford.filter(b => b.isSuspicious).length;
        if (suspiciousDigits > 0) {
            basicFindings.push(['ALERTA', 'Ley de Benford', `${suspiciousDigits} dígitos con desviaciones significativas detectados`]);
        } else {
            basicFindings.push(['NORMAL', 'Ley de Benford', 'Distribución normal de primeros dígitos']);
        }
    }
    
    // Duplicados
    if (analysis.duplicatesCount !== undefined) {
        if (analysis.duplicatesCount > 0) {
            basicFindings.push(['ALERTA', 'Duplicados', `${analysis.duplicatesCount} transacciones repetidas identificadas`]);
        } else {
            basicFindings.push(['NORMAL', 'Duplicados', 'No se detectaron transacciones repetidas']);
        }
    }
    
    // Outliers
    if (analysis.outliersCount !== undefined) {
        if (analysis.outliersCount > 0) {
            basicFindings.push(['ALERTA', 'Valores Atípicos', `${analysis.outliersCount} outliers detectados`]);
        } else {
            basicFindings.push(['NORMAL', 'Valores Atípicos', 'No se detectaron outliers significativos']);
        }
    }
    
    // Análisis forense avanzado (si está disponible)
    const forensicFindings = [];
    
    if (hasForensicAnalysis) {
        // Análisis de Entropía
        if (analysis.entropy) {
            if (analysis.entropy.highRiskCombinations > 0) {
                forensicFindings.push(['CRÍTICO', 'Entropía', `${analysis.entropy.highRiskCombinations} combinaciones categóricas de alto riesgo`]);
            } else if (analysis.entropy.anomalousCount > 0) {
                forensicFindings.push(['ADVERTENCIA', 'Entropía', `${analysis.entropy.anomalousCount} combinaciones categóricas inusuales`]);
            } else {
                forensicFindings.push(['NORMAL', 'Entropía', 'Distribución categórica normal']);
            }
        }
        
        // Detección de Fraccionamiento
        if (analysis.splitting) {
            if (analysis.splitting.highRiskGroups > 0) {
                const avgScore = analysis.splitting.averageRiskScore || 0;
                forensicFindings.push(['CRÍTICO', 'Fraccionamiento', `${analysis.splitting.highRiskGroups} grupos de alto riesgo (Score: ${avgScore.toFixed(1)})`]);
            } else if (analysis.splitting.suspiciousVendors > 0) {
                forensicFindings.push(['ADVERTENCIA', 'Fraccionamiento', `${analysis.splitting.suspiciousVendors} proveedores con patrones sospechosos`]);
            } else {
                forensicFindings.push(['NORMAL', 'Fraccionamiento', 'No se detectaron patrones de evasión']);
            }
        }
        
        // Integridad Secuencial
        if (analysis.sequential) {
            if (analysis.sequential.highRiskGaps > 0) {
                forensicFindings.push(['CRÍTICO', 'Gaps Secuenciales', `${analysis.sequential.highRiskGaps} gaps críticos (máximo: ${analysis.sequential.largestGap})`]);
            } else if (analysis.sequential.totalGaps > 0) {
                forensicFindings.push(['ADVERTENCIA', 'Gaps Secuenciales', `${analysis.sequential.totalGaps} gaps menores detectados`]);
            } else {
                forensicFindings.push(['NORMAL', 'Gaps Secuenciales', 'Numeración íntegra']);
            }
        }
        
        // Isolation Forest
        if (analysis.isolationForest) {
            if (analysis.isolationForest.highRiskAnomalies > 0) {
                forensicFindings.push(['CRÍTICO', 'ML Anomalías', `${analysis.isolationForest.highRiskAnomalies} anomalías críticas detectadas por IA`]);
            } else if (analysis.isolationForest.totalAnomalies > 0) {
                forensicFindings.push(['ADVERTENCIA', 'ML Anomalías', `${analysis.isolationForest.totalAnomalies} patrones inusuales detectados`]);
            } else {
                forensicFindings.push(['NORMAL', 'ML Anomalías', 'Patrones multidimensionales normales']);
            }
        }
        
        // Actor Profiling
        if (analysis.actorProfiling) {
            if (analysis.actorProfiling.highRiskActors > 0) {
                forensicFindings.push(['CRÍTICO', 'Perfilado Actores', `${analysis.actorProfiling.highRiskActors} usuarios con comportamiento crítico`]);
            } else if (analysis.actorProfiling.totalSuspiciousActors > 0) {
                forensicFindings.push(['ADVERTENCIA', 'Perfilado Actores', `${analysis.actorProfiling.totalSuspiciousActors} usuarios con patrones inusuales`]);
            } else {
                forensicFindings.push(['NORMAL', 'Perfilado Actores', 'Comportamientos de usuario normales']);
            }
        }
        
        // Enhanced Benford
        if (analysis.enhancedBenford) {
            const deviation = analysis.enhancedBenford.overallDeviation || 0;
            if (analysis.enhancedBenford.conformityRiskLevel === 'HIGH') {
                forensicFindings.push(['CRÍTICO', 'Benford Avanzado', `No conformidad crítica (MAD: ${deviation.toFixed(2)}%)`]);
            } else if (analysis.enhancedBenford.conformityRiskLevel === 'MEDIUM') {
                forensicFindings.push(['ADVERTENCIA', 'Benford Avanzado', `Conformidad marginal (MAD: ${deviation.toFixed(2)}%)`]);
            } else {
                forensicFindings.push(['NORMAL', 'Benford Avanzado', `Conformidad aceptable (MAD: ${deviation.toFixed(2)}%)`]);
            }
        }
    }
    
    // Mostrar hallazgos básicos en tabla profesional con semáforo
    if (basicFindings.length > 0) {
        autoTable(doc, {
            startY: currentY,
            head: [['ESTADO', 'ANÁLISIS', 'RESULTADO']],
            body: basicFindings,
            theme: 'grid',
            headStyles: { 
                fillColor: COLORS.secondary, 
                textColor: 255, 
                fontStyle: 'bold',
                fontSize: 9
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 3,
                overflow: 'linebreak'
            },
            columnStyles: { 
                0: { 
                    cellWidth: 25, 
                    fontStyle: 'bold',
                    halign: 'center'
                },
                1: { 
                    cellWidth: 35,
                    fontStyle: 'bold'
                },
                2: { 
                    cellWidth: 'auto'
                }
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 0) {
                    // Colorear según el estado - Sistema de semáforo
                    if (data.row.raw[0] === 'CRÍTICO') {
                        data.cell.styles.fillColor = [185, 28, 28]; // Rojo
                        data.cell.styles.textColor = [255, 255, 255];
                    } else if (data.row.raw[0] === 'ALERTA') {
                        data.cell.styles.fillColor = [245, 101, 101]; // Rojo claro
                        data.cell.styles.textColor = [255, 255, 255];
                    } else if (data.row.raw[0] === 'ADVERTENCIA') {
                        data.cell.styles.fillColor = [251, 191, 36]; // Amarillo
                        data.cell.styles.textColor = [0, 0, 0];
                    } else {
                        data.cell.styles.fillColor = [22, 163, 74]; // Verde
                        data.cell.styles.textColor = [255, 255, 255];
                    }
                }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Mostrar hallazgos forenses si existen
    if (forensicFindings.length > 0) {
        doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("HALLAZGOS FORENSES AVANZADOS", margin, currentY);
        currentY += 8;
        
        autoTable(doc, {
            startY: currentY,
            head: [['ESTADO', 'ANÁLISIS FORENSE', 'RESULTADO']],
            body: forensicFindings,
            theme: 'grid',
            headStyles: { 
                fillColor: COLORS.accent, 
                textColor: 255, 
                fontStyle: 'bold',
                fontSize: 9
            },
            styles: { 
                fontSize: 8, 
                cellPadding: 3,
                overflow: 'linebreak'
            },
            columnStyles: { 
                0: { 
                    cellWidth: 25, 
                    fontStyle: 'bold',
                    halign: 'center'
                },
                1: { 
                    cellWidth: 35,
                    fontStyle: 'bold'
                },
                2: { 
                    cellWidth: 'auto'
                }
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 0) {
                    // Colorear según el estado - Sistema de semáforo
                    if (data.row.raw[0] === 'CRÍTICO') {
                        data.cell.styles.fillColor = [185, 28, 28]; // Rojo
                        data.cell.styles.textColor = [255, 255, 255];
                    } else if (data.row.raw[0] === 'ADVERTENCIA') {
                        data.cell.styles.fillColor = [251, 191, 36]; // Amarillo
                        data.cell.styles.textColor = [0, 0, 0];
                    } else {
                        data.cell.styles.fillColor = [22, 163, 74]; // Verde
                        data.cell.styles.textColor = [255, 255, 255];
                    }
                }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Evaluación de riesgo general
    currentY += 8;
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("EVALUACIÓN DE RIESGO PRELIMINAR", margin, currentY);
    currentY += 8;
    
    // Calcular nivel de riesgo general
    let riskLevel = "BAJO";
    let riskColor = [22, 163, 74]; // Green
    let riskDescription = "La población presenta un perfil de riesgo bajo. Se puede proceder con muestreo estadístico estándar.";
    
    const criticalFindings = [...basicFindings, ...forensicFindings].filter(f => f[0] === 'CRÍTICO').length;
    const warningFindings = [...basicFindings, ...forensicFindings].filter(f => f[0] === 'ADVERTENCIA' || f[0] === 'ALERTA').length;
    
    if (criticalFindings > 0) {
        riskLevel = "CRÍTICO";
        riskColor = [220, 38, 38]; // Red
        riskDescription = `Se detectaron ${criticalFindings} hallazgos críticos que requieren atención inmediata. Se recomienda muestreo dirigido y revisión gerencial.`;
    } else if (warningFindings > 2) {
        riskLevel = "ALTO";
        riskColor = [245, 101, 101]; // Red 400
        riskDescription = `Se identificaron ${warningFindings} patrones de advertencia. Se recomienda aumentar el tamaño de muestra y implementar controles adicionales.`;
    } else if (warningFindings > 0) {
        riskLevel = "MEDIO";
        riskColor = [251, 191, 36]; // Yellow 400
        riskDescription = `Se detectaron ${warningFindings} patrones que merecen atención. Se recomienda muestreo estratificado y revisión selectiva.`;
    }
    
    // Mostrar evaluación de riesgo
    doc.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`NIVEL DE RIESGO: ${riskLevel}`, margin + 5, currentY + 8);
    
    currentY += 18;
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitRiskDesc = doc.splitTextToSize(riskDescription, pageWidth - (margin * 2));
    doc.text(splitRiskDesc, margin, currentY);
    currentY += splitRiskDesc.length * 4 + 10;
    
    return currentY;
};

/**
 * 🎯 GENERADOR DE REPORTE ESPECIALIZADO PARA MUESTREO NO ESTADÍSTICO
 * 
 * Archivo completamente separado y especializado
 * Color distintivo: Teal
 * 4 páginas completas con análisis forense
 */
export const generateNonStatisticalReport = async (appState: AppState) => {
    console.log("🎯 INICIANDO REPORTE ESPECIALIZADO NO ESTADÍSTICO");
    
    const { selectedPopulation: pop, results, generalParams, samplingParams } = appState;
    if (!pop || !results) throw new Error("Datos incompletos para generar el reporte.");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const nonStatParams = samplingParams.nonStatistical;

    // --- HELPER: HEADER & FOOTER ---
    const addPageHeader = (title: string, subtitle?: string) => {
        // Franja Teal Superior (distintiva para No Estadístico)
        doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.rect(0, 0, pageWidth, 25, 'F');

        // Logo o Título de la Firma
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("MUESTREO NO ESTADÍSTICO / DE JUICIO", margin, 12);

        // Subtítulos
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Cliente: ${pop.file_name} | Fecha: ${new Date().toLocaleDateString()}`, margin, 19);

        // Título de la Sección
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), margin, 38);
        if (subtitle) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(100, 116, 139);
            doc.text(subtitle, margin, 44);
        }
    };

    const addFooter = (pageNumber: number) => {
        const str = `Página ${pageNumber}`;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(str, pageWidth - margin - doc.getTextWidth(str), pageHeight - 10);
        doc.text("Generado por Asistente de Muestreo de Auditoría v2.0 - Módulo Forense", margin, pageHeight - 10);
    };

    // --- PÁGINA 1: ANÁLISIS FORENSE Y CONFIGURACIÓN ---
    addPageHeader("Análisis Forense y Configuración de Muestreo", "Evaluación Preliminar de Riesgos");

    let currentY = 50;

    // 1. DIAGNÓSTICO FORENSE COMPLETO
    if (pop.advanced_analysis) {
        currentY = generateForensicDiagnosis(doc, pop.advanced_analysis, currentY, pageWidth, margin);
        currentY += 10;
    }

    // 2. MÉTODOS DE ANÁLISIS FORENSE
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("MÉTODOS DE ANÁLISIS FORENSE APLICADOS", margin, currentY);
    currentY += 10;

    if (pop.advanced_analysis) {
        const analysis = pop.advanced_analysis;
        
        // Crear tabla de métodos forenses
        const forensicMethods = [
            ['Análisis de Entropía', analysis.entropy?.anomalousCount || 0, 'Detecta anomalías en distribución de categorías'],
            ['Fraccionamiento', analysis.splitting?.highRiskGroups || 0, 'Identifica transacciones divididas para evadir controles'],
            ['Gaps Secuenciales', analysis.sequential?.highRiskGaps || 0, 'Detecta documentos faltantes en secuencias'],
            ['Isolation Forest', analysis.isolationForest?.highRiskAnomalies || 0, 'Machine Learning para anomalías multidimensionales'],
            ['Perfilado de Actores', analysis.actorProfiling?.highRiskActors || 0, 'Analiza comportamientos sospechosos de usuarios'],
            ['Benford Mejorado', analysis.enhancedBenford?.overallDeviation ? `${analysis.enhancedBenford.overallDeviation.toFixed(1)}%` : '0%', 'Análisis avanzado de primer y segundo dígito'],
            ['Ley de Benford', analysis.benford?.filter(b => b.isSuspicious).length || 0, 'Detecta anomalías en primer dígito'],
            ['Duplicados', analysis.duplicatesCount || 0, 'Detección inteligente de transacciones repetidas'],
            ['Valores Atípicos', analysis.outliersCount || 0, 'Detecta outliers usando método IQR']
        ];

        autoTable(doc, {
            startY: currentY,
            head: [['MÉTODO FORENSE', 'HALLAZGOS', 'DESCRIPCIÓN']],
            body: forensicMethods,
            theme: 'grid',
            headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 
                0: { fontStyle: 'bold', cellWidth: 55 },
                1: { halign: 'center', cellWidth: 30 },
                2: { cellWidth: 'auto' }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 3. FICHA TÉCNICA DESCRIPTIVA (EDA)
    if (pop.advanced_analysis?.eda) {
        const eda = pop.advanced_analysis.eda;
        
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("FICHA TÉCNICA DESCRIPTIVA (EDA)", margin, currentY);
        currentY += 10;

        // Resumen de Saldos
        const saldosData = [
            ['Valor Neto', formatCurrency(eda.netValue), 'Suma de todos los registros (Positivos + Negativos)'],
            ['Valor Absoluto', formatCurrency(eda.absoluteValue), 'Masa monetaria total (ignora signos)'],
            ['Positivos', `${eda.positiveCount} (${formatCurrency(eda.positiveValue)})`, 'Registros con saldo deudor'],
            ['Negativos', `${eda.negativeCount} (${formatCurrency(eda.negativeValue)})`, 'Registros con saldo acreedor']
        ];

        autoTable(doc, {
            startY: currentY,
            head: [['RESUMEN DE SALDOS', 'VALOR', 'DESCRIPCIÓN']],
            body: saldosData,
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 
                0: { fontStyle: 'bold', cellWidth: 50 },
                1: { halign: 'right', cellWidth: 40 },
                2: { cellWidth: 'auto' }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;

        // Centralidad y Rango
        const centralidadData = [
            ['Valor Medio', formatCurrency(eda.mean), 'Promedio simple de la población'],
            ['Mediana', formatCurrency(eda.median || 0), 'Valor central de la distribución'],
            ['Mínimo', formatCurrency(eda.minValue), 'Valor más bajo detectado'],
            ['Máximo', formatCurrency(eda.maxValue), 'Valor más alto detectado']
        ];

        autoTable(doc, {
            startY: currentY,
            head: [['CENTRALIDAD Y RANGO', 'VALOR', 'DESCRIPCIÓN']],
            body: centralidadData,
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 
                0: { fontStyle: 'bold', cellWidth: 50 },
                1: { halign: 'right', cellWidth: 40 },
                2: { cellWidth: 'auto' }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;

        // Forma y Dispersión
        const formaData = [
            ['Desviación Estándar', formatCurrency(eda.stdDev), 'Mide la dispersión respecto a la media'],
            ['Asimetría', Number(eda.skewness || 0).toFixed(3), 'Indica hacia dónde se inclina la distribución'],
            ['Ratio RSF', Number(eda.rsf || 0).toFixed(2), 'Máximo / Segundo Máximo (detección de outliers extremos)']
        ];

        autoTable(doc, {
            startY: currentY,
            head: [['FORMA Y DISPERSIÓN', 'VALOR', 'DESCRIPCIÓN']],
            body: formaData,
            theme: 'striped',
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 
                0: { fontStyle: 'bold', cellWidth: 50 },
                1: { halign: 'right', cellWidth: 40 },
                2: { cellWidth: 'auto' }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    addFooter(1);

    // --- PÁGINA 2: CONFIGURACIÓN Y CRITERIOS ---
    doc.addPage();
    addPageHeader("Configuración de Muestreo", "Criterios y Justificación Técnica");

    currentY = 50;

    // 4. CONFIGURACIÓN DEL MUESTREO
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("CONFIGURACIÓN DEL MUESTREO NO ESTADÍSTICO", margin, currentY);
    currentY += 10;

    const configData = [
        ['Tamaño de la Muestra (n)', (nonStatParams?.sampleSize || 30).toString(), 'Cantidad de ítems seleccionados para revisión'],
        ['Materialidad (TE)', formatCurrency(nonStatParams?.materiality || 50000), 'Umbral de error tolerable para la auditoría'],
        ['Criticidad del Proceso', nonStatParams?.processCriticality || 'Medio', 'Nivel de riesgo asignado al proceso auditado'],
        ['Estrategia Seleccionada', nonStatParams?.selectedInsight || 'RiskScoring', 'Método de selección aplicado'],
        ['Objetivo Específico', generalParams.objective || 'No especificado', 'Alcance y propósito de la selección']
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['PARÁMETRO', 'VALOR', 'DESCRIPCIÓN']],
        body: configData,
        theme: 'grid',
        headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 50 },
            2: { cellWidth: 'auto' }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 5. CRITERIO DE SELECCIÓN
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("CRITERIO DE SELECCIÓN", margin, currentY);
    currentY += 8;

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const criteriaText = nonStatParams?.criteria || "No se ha especificado un criterio de selección.";
    const splitCriteria = doc.splitTextToSize(criteriaText, pageWidth - (margin * 2));
    doc.text(splitCriteria, margin, currentY);
    currentY += splitCriteria.length * 4 + 10;

    // 6. JUSTIFICACIÓN DEL MUESTREO
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("JUSTIFICACIÓN DEL MUESTREO", margin, currentY);
    currentY += 8;

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const justificationText = nonStatParams?.justification || "No se ha especificado una justificación.";
    const splitJustification = doc.splitTextToSize(justificationText, pageWidth - (margin * 2));
    doc.text(splitJustification, margin, currentY);
    currentY += splitJustification.length * 4 + 15;

    // 1.3 FÓRMULA APLICADA (adaptada para No Estadístico)
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("1.3 FÓRMULA APLICADA", margin, currentY);
    currentY += 8;

    // Fórmula específica para muestreo no estadístico
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 35, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text("FÓRMULA APLICADA:", margin + 5, currentY + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);
    doc.setFontSize(9);
    
    const gapAlerts = pop.risk_profile?.gapAlerts || 0;
    const suggestedSize = 30 + (gapAlerts * 5);
    const actualSize = nonStatParams?.sampleSize || suggestedSize;
    
    // Dividir la fórmula en líneas para mejor formato
    doc.text("n = Base(30) + (Gaps de Riesgo × Factor(5))", margin + 5, currentY + 18);
    doc.text(`n = 30 + (${gapAlerts} × 5) = ${suggestedSize}`, margin + 5, currentY + 25);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text(`Ejecutado: ${actualSize} ítems`, margin + 5, currentY + 32);
    
    currentY += 45;

    addFooter(2);

    // --- PÁGINA 3: MUESTRA SELECCIONADA Y EVALUADA ---
    doc.addPage();
    addPageHeader("Muestra Seleccionada y Evaluada", "Detalle Completo de Ítems Revisados");

    currentY = 50;

    // 8. RESUMEN DE EJECUCIÓN
    const errors = results.sample.filter(i => i.compliance_status === 'EXCEPCION');
    const totalErrors = errors.length;
    const errorRate = ((totalErrors / results.sampleSize) * 100).toFixed(2);

    const executionData = [
        ['Tamaño de Muestra Ejecutado', results.sampleSize],
        ['Items Evaluados "Conformes"', results.sampleSize - totalErrors],
        ['Items con "Excepción" (Errores)', totalErrors],
        ['Tasa de Desviación Observada', `${errorRate}%`],
        ['Método de Selección Aplicado', nonStatParams?.selectedInsight || 'RiskScoring']
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['MÉTRICA DE EJECUCIÓN', 'RESULTADO']],
        body: executionData,
        theme: 'grid',
        headStyles: { fillColor: COLORS.primary },
        columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 9. DETALLE COMPLETO DE LA MUESTRA
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("DETALLE COMPLETO DE LA MUESTRA SELECCIONADA", margin, currentY);
    currentY += 10;

    const mapping = pop.column_mapping;
    const sampleRows = results.sample.map((item, idx) => {
        const raw = item.raw_row || {};
        const monetaryVal = mapping?.monetaryValue ? raw[mapping.monetaryValue] : undefined;
        const totalVal = parseFloat(String(item.value || monetaryVal || 0));

        let statusText = 'PENDIENTE';
        if (item.compliance_status === 'OK') {
            statusText = 'CONFORME';
        } else if (item.compliance_status === 'EXCEPCION') {
            statusText = 'EXCEPCIÓN';
        }

        // Obtener factores de riesgo
        const riskFactors = item.risk_factors || [];
        const riskScore = item.risk_score || 0;

        return [
            idx + 1,
            item.id,
            formatCurrency(totalVal),
            riskScore.toFixed(1),
            riskFactors.slice(0, 2).join(', ') || 'Normal',
            statusText,
            item.error_description || (statusText === 'EXCEPCIÓN' ? 'Sin descripción' : '')
        ];
    });

    autoTable(doc, {
        startY: currentY,
        head: [['#', 'ID Referencia', 'Importe', 'Risk Score', 'Factores de Riesgo', 'Estado', 'Observación / Hallazgo']],
        body: sampleRows,
        theme: 'striped',
        headStyles: { fillColor: COLORS.primary, fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 25 },
            2: { cellWidth: 22, halign: 'right' },
            3: { cellWidth: 15, halign: 'center' },
            4: { cellWidth: 30 },
            5: { cellWidth: 18, fontStyle: 'bold' },
            6: { cellWidth: 'auto' }
        },
        didParseCell: function (data) {
            if (data.section === 'body') {
                if (data.row.raw[5] === 'EXCEPCIÓN') {
                    data.cell.styles.fillColor = [254, 202, 202];
                    data.cell.styles.textColor = [185, 28, 28];
                } else if (data.row.raw[5] === 'CONFORME') {
                    data.cell.styles.fillColor = [220, 252, 231];
                    data.cell.styles.textColor = [22, 163, 74];
                } else if (data.row.raw[5] === 'PENDIENTE') {
                    data.cell.styles.textColor = [100, 116, 139];
                }
            }
        }
    });

    addFooter(3);

    // --- PÁGINA 4: EVALUACIÓN Y RESULTADOS ---
    doc.addPage();
    addPageHeader("Evaluación y Resultados", "Resumen de Hallazgos y Proyección");

    currentY = 50;

    // Tabla de métricas de ejecución
    const pilotCount = results.sample.filter(i => i.is_pilot_item).length;
    const expansionCount = results.sample.filter(i => !i.is_pilot_item).length;

    const evaluationData = [
        ['Tamaño de Muestra Ejecutado', results.sampleSize.toString()],
        ['Items Evaluados "Conformes"', (results.sampleSize - totalErrors).toString()],
        ['Items con "Excepción" (Errores)', totalErrors.toString()],
        ['Tasa de Desviación Muestral', `${errorRate}%`],
        ['Fase Final Alcanzada', expansionCount > 0 ? 'Fase 2 (Ampliación)' : 'Fase 1 (Piloto)']
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['MÉTRICA DE EJECUCIÓN', 'RESULTADO']],
        body: evaluationData,
        theme: 'grid',
        headStyles: { fillColor: COLORS.primary, textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 120 },
            1: { cellWidth: 60, halign: 'center' }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // Tabla de ítems con error (solo si hay excepciones)
    if (totalErrors > 0) {
        doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`DETALLE DE ÍTEMS CON EXCEPCIÓN (${totalErrors} registros)`, margin, currentY);
        currentY += 10;

        const errorItems = results.sample
            .filter(item => item.compliance_status === 'EXCEPCION')
            .map(item => {
                const raw = item.raw_row || {};
                const monetaryVal = pop.column_mapping?.monetaryValue ? raw[pop.column_mapping.monetaryValue] : undefined;
                const totalVal = parseFloat(String(item.value || monetaryVal || 0));
                const riskScore = item.risk_score || 0;
                
                return [
                    item.id || 'N/A',
                    riskScore.toFixed(1),
                    formatCurrency(totalVal),
                    'EXCEPCIÓN',
                    item.error_description || 'Sin descripción',
                    formatCurrency(totalVal) // Monto observado = valor total por ahora
                ];
            });

        autoTable(doc, {
            startY: currentY,
            head: [['ID Registro', 'Riesgo IA', 'Valor Libro', 'Revisión', 'Observación', 'Monto Observado']],
            body: errorItems,
            theme: 'grid',
            headStyles: { 
                fillColor: [220, 38, 38], // Rojo para errores
                textColor: 255, 
                fontStyle: 'bold',
                fontSize: 8
            },
            styles: { 
                fontSize: 7, 
                cellPadding: 2,
                overflow: 'linebreak'
            },
            columnStyles: {
                0: { cellWidth: 25 }, // ID Registro
                1: { cellWidth: 18, halign: 'center' }, // Riesgo IA
                2: { cellWidth: 25, halign: 'right' }, // Valor Libro
                3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // Revisión
                4: { cellWidth: 50 }, // Observación
                5: { cellWidth: 25, halign: 'right' } // Monto Observado
            },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 3) {
                    // Colorear la columna "Revisión" en rojo
                    data.cell.styles.fillColor = [254, 202, 202];
                    data.cell.styles.textColor = [185, 28, 28];
                }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;

        // Sumarización de montos observados
        const totalErrorAmount = results.sample
            .filter(item => item.compliance_status === 'EXCEPCION')
            .reduce((sum, item) => {
                const raw = item.raw_row || {};
                const monetaryVal = pop.column_mapping?.monetaryValue ? raw[pop.column_mapping.monetaryValue] : undefined;
                const totalVal = parseFloat(String(item.value || monetaryVal || 0));
                return sum + totalVal;
            }, 0);

        doc.setFillColor(254, 202, 202);
        doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 12, 2, 2, 'F');
        doc.setTextColor(185, 28, 28);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`TOTAL MONTO OBSERVADO: ${formatCurrency(totalErrorAmount)}`, margin + 10, currentY + 8);

        currentY += 20;
    } else {
        currentY += 10;
    }

    // CONCLUSIÓN DE AUDITORÍA
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("CONCLUSIÓN DE AUDITORÍA", margin, currentY);
    currentY += 15;

    // Determinar veredicto basado en resultados
    let veredicto = "FAVORABLE";
    let verdictColor = [22, 163, 74]; // Verde
    let conclusion = "";

    // Obtener materialidad configurada
    const materialidad = nonStatParams?.materiality || 50000;
    const totalErrorAmount = results.sample
        .filter(item => item.compliance_status === 'EXCEPCION')
        .reduce((sum, item) => {
            const raw = item.raw_row || {};
            const monetaryVal = pop.column_mapping?.monetaryValue ? raw[pop.column_mapping.monetaryValue] : undefined;
            const totalVal = parseFloat(String(item.value || monetaryVal || 0));
            return sum + totalVal;
        }, 0);

    // Calcular porcentaje de error monetario vs materialidad
    const errorVsMateriality = ((totalErrorAmount / materialidad) * 100).toFixed(1);

    if (totalErrors === 0) {
        veredicto = "FAVORABLE";
        verdictColor = [22, 163, 74]; // Verde
        conclusion = `Basado en la evaluación de ${results.sampleSize} ítems seleccionados mediante criterio profesional, no se detectaron desviaciones materiales. Los controles internos operan efectivamente y los saldos evaluados son confiables para efectos de auditoría. El monto total evaluado no presenta errores que excedan la materialidad establecida de ${formatCurrency(materialidad)}.`;
    } else if (parseFloat(errorRate) <= 5) {
        veredicto = "FAVORABLE CON OBSERVACIONES";
        verdictColor = [251, 191, 36]; // Amarillo
        conclusion = `Se detectaron ${totalErrors} excepciones en la muestra (${errorRate}% de tasa de error), las cuales están dentro del umbral aceptable para muestreo de juicio (≤5%). El monto total observado de ${formatCurrency(totalErrorAmount)} representa el ${errorVsMateriality}% de la materialidad establecida (${formatCurrency(materialidad)}). Se recomienda seguimiento de las observaciones identificadas, pero no afectan materialmente la confiabilidad de los saldos evaluados.`;
    } else {
        veredicto = "CON SALVEDADES";
        verdictColor = [220, 38, 38]; // Rojo
        conclusion = `La tasa de error del ${errorRate}% (${totalErrors} de ${results.sampleSize} ítems) excede los umbrales aceptables para muestreo no estadístico (>5% para tasa de error). Adicionalmente, el monto total observado de ${formatCurrency(totalErrorAmount)} representa el ${errorVsMateriality}% de la materialidad establecida de ${formatCurrency(materialidad)}. ${totalErrorAmount > materialidad ? 'Este monto EXCEDE la materialidad definida, indicando un riesgo material significativo.' : 'Aunque no excede la materialidad individual, la frecuencia de errores indica debilidades sistemáticas.'} Se requiere ampliación de procedimientos, revisión exhaustiva de controles internos y evaluación del impacto material en los estados financieros.`;
    }

    // Caja del veredicto
    doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 15, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`VEREDICTO: ${veredicto}`, margin + 10, currentY + 10);

    currentY += 25;

    // Texto de conclusión
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitConclusion = doc.splitTextToSize(conclusion, pageWidth - (margin * 2));
    doc.text(splitConclusion, margin, currentY);
    currentY += splitConclusion.length * 5 + 20;

    // DESGLOSE DE EXPANSIÓN
    doc.setFillColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 60, 5, 5, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("DESGLOSE DE EXPANSIÓN", margin + 10, currentY + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    
    const totalValue = pop.total_monetary_value || 0;
    const sampleValue = results.sample.reduce((sum, item) => sum + (item.value || 0), 0);
    
    doc.text(`n = ${results.sampleSize} | Valor Muestra = ${formatCurrency(sampleValue)}`, margin + 10, currentY + 28);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    
    // Línea de separación
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(margin + 10, currentY + 33, pageWidth - margin - 10, currentY + 33);
    
    // Desglose por fases
    doc.text(`Fase 1 (Piloto):`, margin + 10, currentY + 42);
    doc.text(`${pilotCount} registros`, pageWidth - margin - 70, currentY + 42);
    
    doc.text(`Fase 2 (Ampliación):`, margin + 10, currentY + 49);
    doc.setTextColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
    doc.text(`+ ${expansionCount} registros`, pageWidth - margin - 70, currentY + 49);
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Auditado:`, margin + 10, currentY + 56);
    doc.text(`${results.sampleSize} registros`, pageWidth - margin - 70, currentY + 56);

    currentY += 75;

    // DICTAMEN DE HALLAZGOS (solo si hay excepciones)
    if (totalErrors > 0) {
        doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("DICTAMEN DE HALLAZGOS", margin, currentY);
        currentY += 15;

        // Agrupar excepciones por tipo (similar al sistema existente)
        const grouped = {
            'Integridad': { items: 0, desc: 'Se detectaron fallos en la completitud de los registros o campos obligatorios vacíos.' },
            'Documentación': { items: 0, desc: 'Los ítems seleccionados carecen de soporte documental o referencias cruzadas válidas.' },
            'Cálculo': { items: 0, desc: 'Diferencias aritméticas encontradas entre el valor en libros y la verificación física.' }
        };

        errors.forEach(ex => {
            const desc = (ex.error_description || '').toLowerCase();
            if (desc.includes('falta') || desc.includes('soporte') || desc.includes('document')) {
                grouped.Documentación.items++;
            } else if (desc.includes('calculo') || desc.includes('error') || desc.includes('diferencia')) {
                grouped.Cálculo.items++;
            } else {
                grouped.Integridad.items++;
            }
        });

        // Mostrar solo los tipos que tienen errores
        Object.entries(grouped)
            .filter(([_, data]) => data.items > 0)
            .forEach(([titulo, data]) => {
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 25, 3, 3, 'F');
                
                doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(`RIESGO DE ${titulo.toUpperCase()}`, margin + 10, currentY + 8);
                
                doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.text(`n=${data.items}`, pageWidth - margin - 30, currentY + 8);
                
                doc.setTextColor(100, 116, 139);
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(8);
                const splitDesc = doc.splitTextToSize(`"${data.desc}"`, pageWidth - (margin * 2) - 20);
                doc.text(splitDesc, margin + 10, currentY + 16);
                
                currentY += 35;
            });
    }

    addFooter(4);

    // --- PÁGINA 5: ANÁLISIS EXPLICATIVO DE RESULTADOS FORENSES ---
    doc.addPage();
    addPageHeader("Análisis Explicativo de Resultados Forenses", "Interpretación y Recomendaciones para el Auditor");

    currentY = 50;

    // 10. PÁRRAFOS EXPLICATIVOS DE RESULTADOS FORENSES
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERPRETACIÓN DE RESULTADOS FORENSES", margin, currentY);
    currentY += 10;

    if (pop.advanced_analysis) {
        const analysis = pop.advanced_analysis;

        // Análisis de Ley de Benford
        if (analysis.benford && analysis.benford.length > 0) {
            doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text("LEY DE BENFORD - ANÁLISIS DE PRIMER DÍGITO", margin, currentY);
            currentY += 8;

            const suspiciousDigits = analysis.benford.filter(b => b.isSuspicious).length;
            let benfordExplanation = "";
            
            if (suspiciousDigits === 0) {
                benfordExplanation = "La distribución de primeros dígitos sigue el patrón esperado según la Ley de Benford. Esto indica que los datos no han sido manipulados artificialmente y reflejan un comportamiento natural. No se requieren procedimientos adicionales relacionados con este análisis.";
            } else if (suspiciousDigits <= 2) {
                benfordExplanation = `Se detectaron ${suspiciousDigits} dígitos con desviaciones menores respecto al patrón esperado. Estas desviaciones pueden ser normales en ciertos tipos de transacciones o procesos específicos. Se recomienda revisar los ítems que comienzan con estos dígitos para confirmar que no hay patrones de manipulación.`;
            } else {
                benfordExplanation = `Se identificaron ${suspiciousDigits} dígitos con desviaciones significativas, lo cual puede indicar manipulación de datos, errores sistemáticos o procesos no naturales. Es altamente recomendable realizar una revisión detallada de las transacciones que comienzan con estos dígitos y considerar la ampliación de procedimientos sustantivos.`;
            }

            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const splitBenford = doc.splitTextToSize(benfordExplanation, pageWidth - (margin * 2));
            doc.text(splitBenford, margin, currentY);
            currentY += splitBenford.length * 4 + 10;
        }

        // Recomendaciones Finales
        doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text("RECOMENDACIONES PARA EL AUDITOR", margin, currentY);
        currentY += 8;

        const totalAnomalies = (analysis.benford?.filter(b => b.isSuspicious).length || 0) + 
                              (analysis.duplicatesCount || 0) + 
                              (analysis.outliersCount || 0);

        let finalRecommendations = "";
        
        if (totalAnomalies === 0) {
            finalRecommendations = "Basado en el análisis forense, la población presenta un perfil de riesgo bajo. Se puede proceder con confianza en los controles internos y aplicar procedimientos de auditoría estándar. No se requieren procedimientos sustantivos adicionales relacionados con los análisis forenses realizados.";
        } else if (totalAnomalies <= 10) {
            finalRecommendations = `El análisis identificó ${totalAnomalies} anomalías que requieren atención. Se recomienda: (1) Revisar individualmente cada ítem identificado como anómalo, (2) Documentar las explicaciones obtenidas de la administración, (3) Evaluar si los hallazgos indican debilidades en controles internos que requieran comunicación a la gerencia, (4) Considerar si es necesario ampliar el alcance de las pruebas en áreas relacionadas.`;
        } else {
            finalRecommendations = `Se detectaron ${totalAnomalies} anomalías significativas que indican un perfil de riesgo elevado. Se recomienda encarecidamente: (1) Ampliar sustancialmente el tamaño de la muestra, (2) Implementar procedimientos de auditoría adicionales y más detallados, (3) Considerar la participación de especialistas forenses, (4) Evaluar la necesidad de comunicar deficiencias materiales en control interno, (5) Documentar exhaustivamente todos los hallazgos para posible escalamiento a niveles superiores de la organización.`;
        }

        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const splitRecommendations = doc.splitTextToSize(finalRecommendations, pageWidth - (margin * 2));
        doc.text(splitRecommendations, margin, currentY);
        currentY += splitRecommendations.length * 4 + 10;
    }

    addFooter(5);

    console.log("✅ Reporte No Estadístico generado exitosamente");
    doc.save(`PT_NoEstadistico_${pop.file_name.split('.')[0]}_${new Date().getTime()}.pdf`);
};