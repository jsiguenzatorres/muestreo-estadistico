
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState, SamplingMethod, AuditResults, AuditObservation, AdvancedAnalysis } from '../types';
import { calculateInference } from './statisticalService';

const COLORS = {
    primary: [15, 23, 42] as [number, number, number],     // Oxford Black
    secondary: [30, 58, 138] as [number, number, number],  // Deep Navy
    accent: [5, 150, 105] as [number, number, number],     // Emerald
    danger: [185, 28, 28] as [number, number, number],     // Red 700
    text: [30, 41, 59] as [number, number, number],
    border: [203, 213, 225] as [number, number, number],
    highlight: [248, 250, 252] as [number, number, number] // Slate 50
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
    
    // Mostrar hallazgos básicos en tabla
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
                    // Colorear según el estado
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
                    // Colorear según el estado
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
    
    // Recomendaciones específicas
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text("RECOMENDACIONES DE MUESTREO", margin, currentY);
    currentY += 8;
    
    const recommendations = [];
    
    if (criticalFindings > 0) {
        recommendations.push("• URGENTE: Implementar muestreo dirigido en áreas problemáticas identificadas");
        recommendations.push("• Aumentar tamaño de muestra en 50-100% sobre lo inicialmente planeado");
        recommendations.push("• Considerar auditoría forense especializada para hallazgos críticos");
        recommendations.push("• Documentar todos los hallazgos para escalamiento gerencial");
    } else if (warningFindings > 0) {
        recommendations.push("• Considerar muestreo estratificado por nivel de riesgo");
        recommendations.push("• Aumentar tamaño de muestra en 25-50% en áreas de advertencia");
        recommendations.push("• Implementar controles adicionales durante la ejecución");
    } else {
        recommendations.push("• Proceder con muestreo estadístico según metodología seleccionada");
        recommendations.push("• Mantener controles estándar de calidad");
        recommendations.push("• Documentar ausencia de patrones anómalos significativos");
    }
    
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    recommendations.forEach(rec => {
        const splitRec = doc.splitTextToSize(rec, pageWidth - (margin * 2));
        doc.text(splitRec, margin, currentY);
        currentY += splitRec.length * 4 + 2;
    });
    
    currentY += 10;
    
    return currentY;
};

// Función especializada para generar reporte PDF de Muestreo No Estadístico
const generateNonStatisticalReport = async (appState: AppState) => {
    console.log("🎯 INICIANDO REPORTE ESPECIALIZADO NO ESTADÍSTICO");
    console.log("🎯 AppState recibido:", { 
        population: !!appState.selectedPopulation,
        results: !!appState.results,
        method: appState.samplingMethod 
    });
    
    const { selectedPopulation: pop, results, generalParams, samplingParams } = appState;
    if (!pop || !results) throw new Error("Datos incompletos para generar el reporte.");

    console.log("🎯 Datos validados, iniciando generación de PDF especializado...");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const nonStatParams = samplingParams.nonStatistical;

    // --- HELPER: HEADER & FOOTER ---
    const addPageHeader = (title: string, subtitle?: string) => {
        // Franja Teal Superior (distintiva para No Estadístico)
        doc.setFillColor(20, 184, 166); // Teal 500
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
        doc.setTextColor(20, 184, 166);
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

    // 2. MÉTODOS DE ANÁLISIS FORENSE (Estilo de las imágenes)
    doc.setTextColor(20, 184, 166);
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
            headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 
                0: { fontStyle: 'bold', cellWidth: 50 },
                1: { halign: 'center', cellWidth: 25 },
                2: { cellWidth: 'auto' }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // 3. FICHA TÉCNICA DESCRIPTIVA (EDA)
    if (pop.advanced_analysis?.eda) {
        const eda = pop.advanced_analysis.eda;
        
        doc.setTextColor(20, 184, 166);
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
            ['Asimetría', eda.skewness ? eda.skewness.toFixed(3) : '0', 'Indica hacia dónde se inclina la distribución'],
            ['Ratio RSF', eda.rsf ? eda.rsf.toFixed(2) : '0', 'Máximo / Segundo Máximo (detección de outliers extremos)']
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
    doc.setTextColor(20, 184, 166);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("CONFIGURACIÓN DEL MUESTREO NO ESTADÍSTICO", margin, currentY);
    currentY += 10;

    const configData = [
        ['Tamaño de la Muestra (n)', (nonStatParams.sampleSize || 30).toString(), 'Cantidad de ítems seleccionados para revisión'],
        ['Materialidad (TE)', formatCurrency(nonStatParams.materiality || 50000), 'Umbral de error tolerable para la auditoría'],
        ['Criticidad del Proceso', nonStatParams.processCriticality || 'Medio', 'Nivel de riesgo asignado al proceso auditado'],
        ['Estrategia Seleccionada', nonStatParams.selectedInsight || 'RiskScoring', 'Método de selección aplicado'],
        ['Objetivo Específico', generalParams.objective || 'No especificado', 'Alcance y propósito de la selección']
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['PARÁMETRO', 'VALOR', 'DESCRIPCIÓN']],
        body: configData,
        theme: 'grid',
        headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 60 },
            1: { cellWidth: 50 },
            2: { cellWidth: 'auto' }
        }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 5. CRITERIO DE SELECCIÓN
    doc.setTextColor(20, 184, 166);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("CRITERIO DE SELECCIÓN", margin, currentY);
    currentY += 8;

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const criteriaText = nonStatParams.criteria || "No se ha especificado un criterio de selección.";
    const splitCriteria = doc.splitTextToSize(criteriaText, pageWidth - (margin * 2));
    doc.text(splitCriteria, margin, currentY);
    currentY += splitCriteria.length * 4 + 10;

    // 6. JUSTIFICACIÓN DEL MUESTREO
    doc.setTextColor(20, 184, 166);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("JUSTIFICACIÓN DEL MUESTREO", margin, currentY);
    currentY += 8;

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const justificationText = nonStatParams.justification || "No se ha especificado una justificación.";
    const splitJustification = doc.splitTextToSize(justificationText, pageWidth - (margin * 2));
    doc.text(splitJustification, margin, currentY);
    currentY += splitJustification.length * 4 + 15;

    // 7. JUSTIFICACIÓN DE TAMAÑO (si es diferente al sugerido)
    const suggestedSize = 30 + ((pop.risk_profile?.gapAlerts || 0) * 5);
    if (nonStatParams.sampleSize !== suggestedSize && nonStatParams.sizeJustification) {
        doc.setTextColor(245, 101, 101); // Amber
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text("JUSTIFICACIÓN DE ALCANCE MANUAL", margin, currentY);
        currentY += 8;

        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const sizeJustText = nonStatParams.sizeJustification;
        const splitSizeJust = doc.splitTextToSize(sizeJustText, pageWidth - (margin * 2));
        doc.text(splitSizeJust, margin, currentY);
        currentY += splitSizeJust.length * 4 + 15;
    }

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
        ['Método de Selección Aplicado', nonStatParams.selectedInsight || 'RiskScoring']
    ];

    autoTable(doc, {
        startY: currentY,
        head: [['MÉTRICA DE EJECUCIÓN', 'RESULTADO']],
        body: executionData,
        theme: 'grid',
        headStyles: { fillColor: [20, 184, 166] },
        columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 9. DETALLE COMPLETO DE LA MUESTRA
    doc.setTextColor(20, 184, 166);
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
        let statusColor = [100, 116, 139]; // Gray
        if (item.compliance_status === 'OK') {
            statusText = 'CONFORME';
            statusColor = [22, 163, 74]; // Green
        } else if (item.compliance_status === 'EXCEPCION') {
            statusText = 'EXCEPCIÓN';
            statusColor = [220, 38, 38]; // Red
        }

        // Obtener factores de riesgo
        const riskFactors = item.risk_factors || [];
        const riskScore = item.risk_score || 0;

        return [
            idx + 1,
            item.id,
            formatCurrency(totalVal),
            riskScore ? riskScore.toFixed(1) : '0',
            riskFactors.slice(0, 2).join(', ') || 'Normal', // Primeros 2 factores
            statusText,
            item.error_description || (statusText === 'EXCEPCIÓN' ? 'Sin descripción' : '')
        ];
    });

    autoTable(doc, {
        startY: currentY,
        head: [['#', 'ID Referencia', 'Importe', 'Risk Score', 'Factores de Riesgo', 'Estado', 'Observación / Hallazgo']],
        body: sampleRows,
        theme: 'striped',
        headStyles: { fillColor: [20, 184, 166], fontSize: 8 },
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

    // --- PÁGINA 4: ANÁLISIS EXPLICATIVO DE RESULTADOS FORENSES ---
    doc.addPage();
    addPageHeader("Análisis Explicativo de Resultados Forenses", "Interpretación y Recomendaciones para el Auditor");

    currentY = 50;

    // 10. PÁRRAFOS EXPLICATIVOS DE RESULTADOS FORENSES
    doc.setTextColor(20, 184, 166);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("INTERPRETACIÓN DE RESULTADOS FORENSES", margin, currentY);
    currentY += 10;

    if (pop.advanced_analysis) {
        const analysis = pop.advanced_analysis;

        // Análisis de Ley de Benford
        if (analysis.benford && analysis.benford.length > 0) {
            doc.setTextColor(30, 58, 138);
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

        // Análisis de Duplicados
        if (analysis.duplicatesCount !== undefined) {
            doc.setTextColor(30, 58, 138);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text("ANÁLISIS DE DUPLICADOS", margin, currentY);
            currentY += 8;

            let duplicatesExplanation = "";
            
            if (analysis.duplicatesCount === 0) {
                duplicatesExplanation = "No se detectaron transacciones duplicadas en la población. Esto indica un buen control interno en el proceso de registro y validación de transacciones. El riesgo de errores por duplicidad es bajo.";
            } else if (analysis.duplicatesCount <= 5) {
                duplicatesExplanation = `Se identificaron ${analysis.duplicatesCount} transacciones duplicadas. Un número bajo de duplicados puede ser normal en ciertos procesos, pero requiere verificación para confirmar que son legítimos (ej: pagos recurrentes, ajustes contables). Se recomienda revisar cada caso para determinar si representan errores de procesamiento.`;
            } else {
                duplicatesExplanation = `Se detectaron ${analysis.duplicatesCount} transacciones duplicadas, lo cual representa un nivel elevado que puede indicar debilidades en los controles internos, errores sistemáticos en el procesamiento, o posibles intentos de manipulación. Se recomienda una revisión exhaustiva de estos casos y una evaluación de los controles preventivos del proceso.`;
            }

            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const splitDuplicates = doc.splitTextToSize(duplicatesExplanation, pageWidth - (margin * 2));
            doc.text(splitDuplicates, margin, currentY);
            currentY += splitDuplicates.length * 4 + 10;
        }

        // Análisis de Valores Atípicos
        if (analysis.outliersCount !== undefined) {
            doc.setTextColor(30, 58, 138);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text("ANÁLISIS DE VALORES ATÍPICOS (OUTLIERS)", margin, currentY);
            currentY += 8;

            let outliersExplanation = "";
            
            if (analysis.outliersCount === 0) {
                outliersExplanation = "No se detectaron valores atípicos significativos en la población. La distribución de montos es homogénea y no presenta transacciones anómalas que requieran atención especial. El riesgo de errores materiales por valores extremos es bajo.";
            } else {
                const outliersPercentage = ((analysis.outliersCount / (pop.total_rows || 1)) * 100).toFixed(2);
                outliersExplanation = `Se identificaron ${analysis.outliersCount} valores atípicos (${outliersPercentage}% de la población) que exceden significativamente el rango intercuartílico normal. Estos valores requieren atención especial ya que: (1) representan el mayor riesgo monetario individual, (2) pueden indicar errores de digitación o procesamiento, (3) podrían ser transacciones fraudulentas o no autorizadas. Se recomienda priorizar la revisión de estos ítems y verificar su documentación soporte.`;
            }

            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const splitOutliers = doc.splitTextToSize(outliersExplanation, pageWidth - (margin * 2));
            doc.text(splitOutliers, margin, currentY);
            currentY += splitOutliers.length * 4 + 10;
        }

        // Análisis Forense Avanzado (si está disponible)
        if (analysis.entropy || analysis.splitting || analysis.sequential) {
            doc.setTextColor(30, 58, 138);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text("ANÁLISIS FORENSE AVANZADO", margin, currentY);
            currentY += 8;

            let advancedExplanation = "Los métodos forenses avanzados aplicados proporcionan una capa adicional de detección de irregularidades:";

            if (analysis.entropy && analysis.entropy.anomalousCount > 0) {
                advancedExplanation += ` El análisis de entropía detectó ${analysis.entropy.anomalousCount} combinaciones categóricas inusuales, lo que puede indicar errores de clasificación o patrones de codificación anómalos.`;
            }

            if (analysis.splitting && analysis.splitting.highRiskGroups > 0) {
                advancedExplanation += ` Se identificaron ${analysis.splitting.highRiskGroups} grupos sospechosos de fraccionamiento, sugiriendo posibles intentos de evadir controles de autorización mediante la división artificial de transacciones.`;
            }

            if (analysis.sequential && analysis.sequential.highRiskGaps > 0) {
                advancedExplanation += ` El análisis secuencial reveló ${analysis.sequential.highRiskGaps} gaps críticos en la numeración, lo que puede indicar documentos faltantes o eliminados intencionalmente.`;
            }

            advancedExplanation += " Estos hallazgos requieren investigación adicional y pueden justificar la ampliación de procedimientos de auditoría en las áreas afectadas.";

            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const splitAdvanced = doc.splitTextToSize(advancedExplanation, pageWidth - (margin * 2));
            doc.text(splitAdvanced, margin, currentY);
            currentY += splitAdvanced.length * 4 + 15;
        }

        // Recomendaciones Finales
        doc.setTextColor(30, 58, 138);
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

    addFooter(4);

    doc.save(`PT_NoEstadistico_${pop.file_name.split('.')[0]}_${new Date().getTime()}.pdf`);
};

export const generateAuditReport = async (appState: AppState) => {
    const { selectedPopulation: pop, results, generalParams, samplingMethod, samplingParams } = appState;
    if (!pop || !results) throw new Error("Datos incompletos para generar el reporte.");

    console.log("🔍 GENERADOR COMPLETO - Método detectado:", samplingMethod);
    console.log("🔍 GENERADOR COMPLETO - Tipo de método:", typeof samplingMethod);
    console.log("🔍 GENERADOR COMPLETO - SamplingMethod.NonStatistical:", SamplingMethod.NonStatistical);

    // Si es Muestreo No Estadístico, usar el reporte especializado
    if (samplingMethod === SamplingMethod.NonStatistical) {
        console.log("✅ GENERADOR COMPLETO - Detectado No Estadístico, usando reporte especializado");
        return generateNonStatisticalReport(appState);
    }

    console.log("📄 GENERADOR COMPLETO - Usando reporte estándar para método:", samplingMethod);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // --- HELPER: HEADER & FOOTER ---
    const addPageHeader = (title: string, subtitle?: string) => {
        // Franja Azul Superior
        doc.setFillColor(30, 58, 138); // Deep Navy
        doc.rect(0, 0, pageWidth, 25, 'F');

        // Logo o Título de la Firma (Simulado)
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text("AUDITORÍA DE CUMPLIMIENTO", margin, 12);

        // Subtítulos
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Cliente: ${pop.file_name} | Fecha: ${new Date().toLocaleDateString()}`, margin, 19);

        // Título de la Sección
        doc.setTextColor(30, 58, 138);
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
        doc.text("Generado por Asistente de Muestreo de Auditoría v2.0", margin, pageHeight - 10);
    };

    // --- PÁGINA 1: DIAGNÓSTICO FORENSE Y RESUMEN EJECUTIVO ---
    addPageHeader("Cédula de Planificación de Muestreo", "Diagnóstico Preliminar y Estrategia");

    let currentY = 50;

    // 0. DIAGNÓSTICO PRELIMINAR DE ANÁLISIS FORENSE/BÁSICO (NUEVA SECCIÓN)
    if (pop.advanced_analysis) {
        currentY = generateForensicDiagnosis(doc, pop.advanced_analysis, currentY, pageWidth, margin);
        currentY += 10; // Espacio adicional antes de la siguiente sección
    }

    // 1.1 RESUMEN ESTADÍSTICO DEL UNIVERSO (Renumerado)
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("1.1 RESUMEN ESTADÍSTICO DEL UNIVERSO", margin, currentY);
    currentY += 8;
    autoTable(doc, {
        startY: currentY,
        head: [['CONCEPTO', 'DETALLE']],
        body: [
            ['Población sujeta a auditoría (N)', `${pop.total_rows.toLocaleString()} registros`],
            ['Valor Total en Libros', formatCurrency(pop.total_monetary_value)],
            ['Identificador Único', pop.column_mapping.uniqueId || "N/A"],
            ['Columna Importe', pop.column_mapping.monetaryValue || "N/A"],
            ['Semilla Estadística (Seed)', generalParams.seed.toString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 1.2 CONFIGURACIÓN DE MUESTREO (Renumerado)
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 138);
    doc.setFont('helvetica', 'bold');
    doc.text(`1.2 CONFIGURACIÓN: MÉTODO ${samplingMethod === SamplingMethod.Attribute ? 'ATRIBUTOS' : samplingMethod}`, margin, currentY);
    currentY += 5;

    let paramsData: string[][] = [];
    let formulaText = "";

    if (samplingMethod === SamplingMethod.Attribute) {
        const attr = samplingParams.attribute;
        paramsData = [
            ['Nivel de Confianza (NC)', `${attr.NC}%`, 'Probabilidad de que la muestra represente a la población.'],
            ['Desviación Tolerable (ET)', `${attr.ET}%`, 'Máximo error aceptable sin modificar valoración de riesgo.'],
            ['Desviación Esperada (PE)', `${attr.PE}%`, 'Error anticipado basado en experiencia previa.'],
            ['Estrategia', attr.useSequential ? 'Muestreo Secuencial (Stop-or-Go)' : 'Muestreo de Tamaño Fijo', 'Enfoque de selección.']
        ];
        formulaText = "Tamaño (n) = (Factor de Confianza * 100) / (ET - PE)";
    } else if (samplingMethod === SamplingMethod.MUS) {
        const mus = samplingParams.mus;
        const confidenceFactor = mus.RIA <= 5 ? 3.0 : 2.31;
        const confidenceLabel = mus.RIA <= 5 ? "95% (Alto)" : "90% (Medio)";

        paramsData = [
            ['Nivel de Confianza', confidenceLabel, `Factor de confiabilidad R=${confidenceFactor}`],
            ['Error Tolerable (TE)', formatCurrency(mus.TE), 'Umbral de materialidad monetaria definido.'],
            ['Error Esperado (EE)', formatCurrency(mus.EE), 'Anticipación de errores basada en historial.'],
            ['Intervalo de Muestreo (J)', formatCurrency(mus.TE / confidenceFactor), 'Teórico: TE / Factor R.'],
            ['Capa de Certeza', mus.optimizeTopStratum ? 'Activada' : 'No Aplicada', 'Extracción al 100% de ítems >= J.'],
            ['Tratamiento Negativos', mus.handleNegatives === 'Separate' ? 'Segregar' : mus.handleNegatives === 'Absolute' ? 'Valor Absoluto' : 'Tratar como Cero', 'Política para saldos acreedores.'],
            ['Semilla Estadística', generalParams.seed.toString(), 'Valor para reproducibilidad NIA 530.']
        ];
        formulaText = "Intervalo (J) = TE / Factor R;  Certeza = Ítems >= J;  Muestra = Residual / J";
    } else if (samplingMethod === SamplingMethod.Stratified) {
        const st = samplingParams.stratified;
        paramsData = [
            ['Modelo Proyectivo', 'NIA 530', 'Norma Internacional de Auditoría aplicada.'],
            ['Base Estratificación', st.basis === 'Monetary' ? 'Monetaria (Clásico)' : 'Por Categoría', 'Criterio de división del universo.'],
            ['Cantidad de Estratos', st.strataCount.toString(), 'Número de segmentos creados.'],
            ['Método Asignación', st.allocationMethod, 'Lógica de distribución de la muestra.'],
            ['Umbral de Certeza ($)', formatCurrency(st.certaintyStratumThreshold), 'Límite para extracción al 100%.'],
            ['Nivel de Confianza (NC)', `${st.NC || 95}%`, `Seguridad estadística (Riesgo ${100 - (st.NC || 95)}%).`],
            ['Error Tolerable (ET %)', `${st.ET || 5}%`, 'Margen de error aceptable sobre el total.'],
            ['Error Esperado (PE %)', `${st.PE || 1}%`, 'Tasa de error anticipada en la población.'],
            ['Semilla Estadística', generalParams.seed.toString(), 'Valor para reproducibilidad NIA 530.']
        ];
        formulaText = "n = (N * Z * σ / TE)²;  Asignación n_h según método (Neyman/Proporcional).";
    } else if (samplingMethod === SamplingMethod.CAV) {
        const cav = samplingParams.cav;
        const isPilot = results.pilotMetrics?.type === 'CAV_PILOT';
        const sigmaUsed = isPilot ? (results.pilotMetrics as any).calibratedSigma : cav.sigma;
        const ncLabel = `${cav.NC || 95}%`;

        paramsData = [
            ['Técnica Estimación', cav.estimationTechnique === 'Media' ? 'Media por Unidad (MPU)' : cav.estimationTechnique, 'Lógica de proyección del error.'],
            ['Nivel de Confianza (NC)', ncLabel, 'Nivel de seguridad estadística independiente.'],
            ['Error Tolerable (TE)', formatCurrency(cav.TE), 'Umbral monetario total específico para CAV.'],
            ['Sigma de Diseño (σ)', formatCurrency(cav.sigma), 'Variabilidad inicial estimada.'],
            ['Sigma Calibrado (σ)', isPilot ? formatCurrency(sigmaUsed) : 'No aplicado', 'Calibración vía piloto de 50 ítems.'],
            ['Estratificación de Población', cav.stratification ? 'Activada' : 'No Aplicada', 'Segmentación para optimizar eficiencia estadística.'],
            ['Universo (N)', (appState.selectedPopulation?.total_rows || 0).toLocaleString(), 'Registros totales en la población.'],
            ['Semilla Estadística', generalParams.seed.toString(), 'Valor para reproducibilidad NIA 530.']
        ];
        formulaText = "Tamaño n = [ (N * Z * Sigma) / TE ]^2;  Proyección = MPU * N";
    }

    autoTable(doc, {
        startY: currentY,
        head: [['PARÁMETRO', 'VALOR', 'EXPLICACIÓN TÉCNICA']],
        body: paramsData,
        theme: 'striped',
        headStyles: { fillColor: [71, 85, 105] }, // Slate 600
        styles: { fontSize: 9 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // 1.3 Fórmula Utilizada (Renumerado)
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text("1.3 FÓRMULA APLICADA", margin, currentY);
    currentY += 8;
    
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 20, 2, 2, 'F');
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(formulaText, margin + 5, currentY + 12);

    addFooter(1);

    // --- PÁGINA 2: EJECUCIÓN Y RESULTADOS ---
    doc.addPage();
    addPageHeader("Evaluación y Resultados", "Resumen de Hallazgos y Proyección");

    // 2.1 Resumen de Ejecución (Renumerado)
    const errors = results.sample.filter(i => i.compliance_status === 'EXCEPCION');
    const totalErrors = errors.length;
    const errorRate = ((totalErrors / results.sampleSize) * 100).toFixed(2);

    const executionData = [
        ['Tamaño de Muestra Ejecutado', results.sampleSize],
        ['Items Evaluados "Conformes"', results.sampleSize - totalErrors],
        ['Items con "Excepción" (Errores)', totalErrors],
        ['Tasa de Desviación Muestral', `${errorRate}%`],
        ['Fase Final Alcanzada', results.sample.some(i => !i.is_pilot_item) ? "Fase 2 (Ampliación)" : "Fase 1 (Piloto)"]
    ];

    autoTable(doc, {
        startY: 50,
        head: [['MÉTRICA DE EJECUCIÓN', 'RESULTADO']],
        body: executionData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        columnStyles: { 0: { cellWidth: 100, fontStyle: 'bold' } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // --- NUEVA SECCIÓN: DETALLE DE ÍTEMS CON EXCEPCIÓN ---
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

    // 2.1 Resumen de Estratificación (Si aplica)
    if (samplingMethod === SamplingMethod.Stratified || samplingMethod === SamplingMethod.CAV) {
        const strataGroups: Record<string, { count: number, value: number, errors: number }> = {};
        results.sample.forEach(item => {
            const key = item.stratum_label || 'Sin Estrato';
            if (!strataGroups[key]) strataGroups[key] = { count: 0, value: 0, errors: 0 };
            strataGroups[key].count++;
            strataGroups[key].value += (item.value || 0);
            if (item.compliance_status === 'EXCEPCION') strataGroups[key].errors++;
        });

        const strataRows = Object.entries(strataGroups).map(([name, data]) => [
            name,
            data.count,
            formatCurrency(data.value),
            data.errors
        ]);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(30, 58, 138);
        doc.text("RESUMEN DE DISTRIBUCIÓN POR ESTRATOS", margin, currentY);
        currentY += 5;

        autoTable(doc, {
            startY: currentY,
            head: [['ESTRATO / SEGMENTO', 'ÍTEMS', 'VALOR TOTAL', 'ERRORES']],
            body: strataRows,
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 8 },
            columnStyles: {
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'center', fontStyle: 'bold' }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- CONCLUSIÓN DE AUDITORÍA AMPLIADA Y TÉCNICA ---
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("CONCLUSIÓN DE AUDITORÍA", margin, currentY);
    currentY += 15;

    // Determinar veredicto basado en resultados y método específico
    let veredicto = "FAVORABLE";
    let verdictColor = [22, 163, 74]; // Verde
    let conclusion = "";

    // Calcular materialidad y monto total observado
    let materialidad = 50000; // Default
    if (samplingMethod === SamplingMethod.MUS) {
        materialidad = samplingParams.mus?.TE || 50000;
    } else if (samplingMethod === SamplingMethod.CAV) {
        materialidad = samplingParams.cav?.TE || 50000;
    } else if (samplingMethod === SamplingMethod.Attribute) {
        materialidad = 50000; // Para atributos usamos un valor base
    }

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

    // Lógica específica por método de muestreo
    if (samplingMethod === SamplingMethod.Attribute) {
        const attr = samplingParams.attribute;
        const inference = calculateInference(results, samplingMethod, 0);
        
        if (totalErrors === 0) {
            veredicto = "FAVORABLE";
            verdictColor = [22, 163, 74]; // Verde
            conclusion = `Basado en la evaluación de ${results.sampleSize} ítems mediante muestreo de atributos, no se detectaron desviaciones de control interno. La tasa de error observada (0%) está significativamente por debajo del error tolerable establecido (${attr.ET}%). Los controles evaluados operan efectivamente y proporcionan seguridad razonable sobre la confiabilidad de los procesos auditados.`;
        } else if (parseFloat(errorRate) <= attr.ET) {
            veredicto = "FAVORABLE CON OBSERVACIONES";
            verdictColor = [251, 191, 36]; // Amarillo
            conclusion = `Se detectaron ${totalErrors} excepciones en la muestra (${errorRate}% de tasa de error), las cuales están dentro del umbral tolerable establecido (≤${attr.ET}%). El límite superior de confianza proyectado de ${inference.upperLimit?.toFixed(2)}% indica que los controles internos operan dentro de parámetros aceptables. Se recomienda seguimiento de las observaciones identificadas para fortalecer el ambiente de control.`;
        } else {
            veredicto = "CON SALVEDADES";
            verdictColor = [220, 38, 38]; // Rojo
            conclusion = `La tasa de error del ${errorRate}% (${totalErrors} de ${results.sampleSize} ítems) excede el umbral tolerable de ${attr.ET}%. El límite superior de confianza proyectado de ${inference.upperLimit?.toFixed(2)}% indica deficiencias significativas en los controles internos evaluados. Se requiere implementación inmediata de controles correctivos y ampliación de procedimientos sustantivos para mitigar el riesgo de control identificado.`;
        }
    } else if (samplingMethod === SamplingMethod.MUS) {
        const mus = samplingParams.mus;
        const inference = calculateInference(results, samplingMethod, 0);
        const projectedError = inference.projectedError || 0;
        
        if (totalErrors === 0) {
            veredicto = "FAVORABLE";
            verdictColor = [22, 163, 74]; // Verde
            conclusion = `Basado en la evaluación de ${results.sampleSize} unidades monetarias mediante MUS, no se detectaron errores materiales. El error proyectado de $0.00 está significativamente por debajo de la materialidad establecida de ${formatCurrency(mus.TE)}. Los saldos evaluados son confiables y no requieren ajustes contables. La precisión alcanzada proporciona seguridad razonable sobre la integridad de los importes registrados.`;
        } else if (projectedError <= mus.TE) {
            veredicto = "FAVORABLE CON OBSERVACIONES";
            verdictColor = [251, 191, 36]; // Amarillo
            conclusion = `Se detectaron ${totalErrors} excepciones que resultan en un error proyectado de ${formatCurrency(projectedError)} (${errorVsMateriality}% de la materialidad). Este monto está dentro del umbral tolerable de ${formatCurrency(mus.TE)}. Los errores identificados no afectan materialmente la razonabilidad de los saldos, pero se recomienda evaluación de las causas subyacentes y fortalecimiento de controles preventivos.`;
        } else {
            veredicto = "CON SALVEDADES";
            verdictColor = [220, 38, 38]; // Rojo
            conclusion = `El error proyectado de ${formatCurrency(projectedError)} EXCEDE la materialidad tolerable de ${formatCurrency(mus.TE)} (${errorVsMateriality}% de exceso). Esta desviación indica un riesgo material significativo que afecta la confiabilidad de los saldos evaluados. Se requiere ajuste contable por el monto proyectado, investigación exhaustiva de las causas raíz, y ampliación sustancial de procedimientos de auditoría en áreas relacionadas.`;
        }
    } else if (samplingMethod === SamplingMethod.CAV) {
        const cav = samplingParams.cav;
        const inference = calculateInference(results, samplingMethod, pop.total_monetary_value, pop.total_rows);
        const projectedError = inference.projectedError || 0;
        
        if (totalErrors === 0) {
            veredicto = "FAVORABLE";
            verdictColor = [22, 163, 74]; // Verde
            conclusion = `La estimación mediante Variables Clásicas (Media por Unidad) no detectó errores materiales en la población evaluada. El error proyectado de $0.00 está significativamente por debajo de la materialidad de ${formatCurrency(cav.TE)}. La variabilidad observada en la muestra está dentro de parámetros estadísticos normales, confirmando la razonabilidad de los valores registrados en la población.`;
        } else if (projectedError <= cav.TE) {
            veredicto = "FAVORABLE CON OBSERVACIONES";
            verdictColor = [251, 191, 36]; // Amarillo
            conclusion = `La proyección MPU resultó en un error estimado de ${formatCurrency(projectedError)} (${errorVsMateriality}% de la materialidad), el cual está dentro del umbral tolerable de ${formatCurrency(cav.TE)}. La desviación estándar observada y el intervalo de confianza calculado indican que los errores identificados no comprometen la integridad global de la población, aunque requieren seguimiento correctivo.`;
        } else {
            veredicto = "CON SALVEDADES";
            verdictColor = [220, 38, 38]; // Rojo
            conclusion = `La estimación MPU proyecta un error de ${formatCurrency(projectedError)} que EXCEDE la materialidad tolerable de ${formatCurrency(cav.TE)} (${errorVsMateriality}% de exceso). El análisis estadístico indica una desviación sistemática significativa que compromete la confiabilidad de los valores registrados. Se requiere ajuste contable, revisión exhaustiva de procesos de valuación, y consideración de limitaciones al alcance de la auditoría.`;
        }
    } else if (samplingMethod === SamplingMethod.Stratified) {
        const inference = calculateInference(results, samplingMethod, pop.total_monetary_value, pop.total_rows);
        const projectedError = inference.projectedError || 0;
        
        if (totalErrors === 0) {
            veredicto = "FAVORABLE";
            verdictColor = [22, 163, 74]; // Verde
            conclusion = `El muestreo estratificado no detectó errores materiales en ninguno de los estratos evaluados. La estimación de razón combinada resulta en un error proyectado de $0.00, confirmando la integridad de la población segmentada. La eficiencia estadística alcanzada mediante estratificación proporciona alta confianza en la representatividad de los resultados obtenidos.`;
        } else if (projectedError <= materialidad) {
            veredicto = "FAVORABLE CON OBSERVACIONES";
            verdictColor = [251, 191, 36]; // Amarillo
            conclusion = `La proyección estratificada resulta en un error estimado de ${formatCurrency(projectedError)} (${errorVsMateriality}% de la materialidad), distribuido entre los estratos evaluados. Este monto está dentro del umbral tolerable de ${formatCurrency(materialidad)}. El análisis por estratos permite identificar áreas específicas de mejora sin comprometer la evaluación global de la población.`;
        } else {
            veredicto = "CON SALVEDADES";
            verdictColor = [220, 38, 38]; // Rojo
            conclusion = `La estimación estratificada proyecta un error de ${formatCurrency(projectedError)} que EXCEDE la materialidad de ${formatCurrency(materialidad)} (${errorVsMateriality}% de exceso). El análisis por estratos revela concentraciones de error que indican deficiencias sistemáticas en segmentos específicos de la población. Se requiere investigación detallada por estrato, ajustes contables diferenciados, y revisión de controles específicos por segmento.`;
        }
    }

    // Caja del veredicto
    doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 15, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`VEREDICTO: ${veredicto}`, margin + 10, currentY + 10);

    currentY += 25;

    // Texto de conclusión técnica
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitConclusion = doc.splitTextToSize(conclusion, pageWidth - (margin * 2));
    doc.text(splitConclusion, margin, currentY);
    currentY += splitConclusion.length * 5 + 20;

    // --- NUEVA SECCIÓN: DESGLOSE DE EXPANSIÓN (Card Estilo UI) ---
    const pilotCount = results.sample.filter(i => i.is_pilot_item).length;
    const expansionCount = results.sample.filter(i => !i.is_pilot_item).length;

    doc.setFillColor(15, 23, 42); // Slate 900
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 45, 3, 3, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("DESGLOSE DE EXPANSIÓN", margin + 10, currentY + 10);

    doc.setFont('courier', 'bold');
    doc.setTextColor(52, 211, 153); // Emerald 400

    if (samplingMethod === SamplingMethod.Attribute) {
        const rFactor = (samplingParams.attribute?.NC >= 95 ? 3.0 : 2.3);
        const et = samplingParams.attribute?.ET || 1;
        const pe = samplingParams.attribute?.PE || 0;
        doc.text(`n_teórico = (${rFactor} * 100) / (${et} - ${pe}) = ${results.sampleSize}`, margin + 10, currentY + 20);
    } else {
        const mus = samplingParams.mus;
        const confFactor = mus.RIA <= 5 ? 3.0 : 2.31;
        const intervalJ = mus.TE / confFactor;
        doc.text(`J = ${formatCurrency(intervalJ)} | n = V / J = ${results.sampleSize}`, margin + 10, currentY + 20);
    }

    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.1);
    doc.line(margin + 10, currentY + 25, pageWidth - margin - 10, currentY + 25);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text("Fase 1 (Piloto):", margin + 10, currentY + 32);
    doc.text(`${pilotCount} registros`, pageWidth - margin - 35, currentY + 32);

    doc.setTextColor(52, 211, 153);
    doc.text("Fase 2 (Ampliación):", margin + 10, currentY + 38);
    doc.text(`+ ${expansionCount} registros`, pageWidth - margin - 35, currentY + 38);

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("Total Auditado:", margin + 10, currentY + 44);
    doc.text(`${results.sampleSize} registros`, pageWidth - margin - 35, currentY + 44);

    currentY += 55;

    // --- NUEVA SECCIÓN: DICTAMEN DE HALLAZGOS (IA) ---
    const exceptionsFull = results.sample.filter(i => i.compliance_status === 'EXCEPCION');
    if (exceptionsFull.length > 0) {
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("DICTAMEN DE HALLAZGOS", margin, currentY);
        currentY += 8;

        const grouped = {
            'Integridad': { items: 0, desc: 'Se detectaron fallos en la completitud de los registros o campos obligatorios vacíos.' },
            'Documentación': { items: 0, desc: 'Los ítems seleccionados carecen de soporte documental o referencias cruzadas válidas.' },
            'Cálculo': { items: 0, desc: 'Diferencias aritméticas encontradas entre el valor en libros y la verificación física.' }
        };

        exceptionsFull.forEach(ex => {
            const desc = (ex.error_description || '').toLowerCase();
            if (desc.includes('falta') || desc.includes('soporte') || desc.includes('document')) grouped.Documentación.items++;
            else if (desc.includes('calculo') || desc.includes('error') || desc.includes('diferencia')) grouped.Cálculo.items++;
            else grouped.Integridad.items++;
        });

        Object.entries(grouped).filter(([_, data]) => data.items > 0).forEach(([titulo, data]) => {
            if (currentY > pageHeight - 40) {
                addFooter(2);
                doc.addPage();
                addPageHeader("Evaluación y Resultados (Cont.)", "Continuación de Hallazgos");
                currentY = 50;
            }

            doc.setFillColor(248, 250, 252); // Slate 50
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.roundedRect(margin, currentY, pageWidth - margin * 2, 20, 2, 2, 'FD');

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`RIESGO DE ${titulo.toUpperCase()}`, margin + 5, currentY + 8);

            doc.setTextColor(30, 58, 138);
            doc.text(`n=${data.items}`, pageWidth - margin - 15, currentY + 8);

            doc.setTextColor(100, 116, 139);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            const splitDesc = doc.splitTextToSize(`"${data.desc}"`, pageWidth - margin * 2 - 10);
            doc.text(splitDesc, margin + 5, currentY + 14);

            currentY += 25;
        });
    }

    addFooter(2);

    // --- NUEVA SECCIÓN: OBSERVACIONES DEL EXPEDIENTE (SOLICITADO: ANTES DEL ANEXO) ---
    const observations = (appState as any).observations || [];
    if (observations.length > 0) {
        doc.addPage();
        addPageHeader("Sección V: Expediente de Hallazgos", "Observaciones cualitativas y evidencias del auditor");

        autoTable(doc, {
            startY: 50,
            head: [['Título', 'Descripción', 'Tipo de Control', 'Prioridad / Severidad']],
            body: observations.map((o: any) => [
                o.titulo,
                o.descripcion,
                o.tipo || 'General',
                o.severidad
            ]),
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138] },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 35, fontStyle: 'bold' },
                1: { cellWidth: 90 },
                2: { cellWidth: 30 },
                3: { cellWidth: 25, halign: 'center' }
            }
        });
        addFooter(3);
    }

    // --- PÁGINA ANEXO: DETALLE DE LA MUESTRA ---
    doc.addPage();
    addPageHeader("Anexo: Matriz de Control Detallada", "Evidencia ítem por ítem del papel de trabajo");

    const mapping = pop.column_mapping;
    const sampleRows = results.sample.map((item, idx) => {
        const raw = item.raw_row || {};
        const monetaryVal = mapping?.monetaryValue ? raw[mapping.monetaryValue] : undefined;
        const totalVal = parseFloat(String(item.value || monetaryVal || 0));

        let statusText = 'PENDIENTE';
        if (item.compliance_status === 'OK') statusText = 'CONFORME';
        else if (item.compliance_status === 'EXCEPCION') statusText = 'EXCEPCIÓN';

        let faseLabel = item.is_pilot_item ? "PILOTO" : "AMPLIACIÓN";
        if (item.risk_flag === 'TOP_STRATUM' || item.risk_flag === 'CERTEZA_ESTRAT.') faseLabel = "CERTEZA";
        else if (item.risk_flag === 'NEGATIVO_SEGREGADO' || item.risk_flag === 'NEGATIVO_ABS') faseLabel = "ACREEDOR";

        if (item.stratum_label && item.stratum_label !== 'Certeza') {
            faseLabel = `ESTRATO: ${item.stratum_label}`;
        }

        return [
            idx + 1,
            item.id,
            formatCurrency(totalVal),
            item.stratum_label || 'E1',
            item.risk_score || 0,
            faseLabel,
            statusText,
            item.error_description || (statusText === 'EXCEPCIÓN' ? 'Sin descripción' : '')
        ];
    });

    autoTable(doc, {
        startY: 50,
        head: [['It.', 'ID Ref', 'Importe', 'Estrato', 'Riesgo', 'Fase', 'Estado', 'Observación / Hallazgo']],
        body: sampleRows,
        theme: 'striped',
        headStyles: { fillColor: [71, 85, 105], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 30 },
            2: { cellWidth: 22, halign: 'right' },
            3: { cellWidth: 20 },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 18 },
            6: { cellWidth: 20, fontStyle: 'bold' },
            7: { cellWidth: 'auto' }
        },
        didParseCell: function (data) {
            if (data.section === 'body') {
                if (data.row.raw[6] === 'EXCEPCIÓN') {
                    data.cell.styles.fillColor = [254, 202, 202];
                    data.cell.styles.textColor = [185, 28, 28];
                } else if (data.row.raw[6] === 'PENDIENTE') {
                    data.cell.styles.textColor = [100, 116, 139];
                }
            }
        }
    });

    addFooter(4);

    // --- LA SECCIÓN DE OBSERVACIONES QUE ESTABA AQUÍ FUE MOVIDA ARRIBA ---

    doc.save(`PT_Auditoria_${pop.file_name.split('.')[0]}_${new Date().getTime()}.pdf`);
};
