/**
 * Servicio de Reportes Adaptados para Móvil
 * Genera reportes optimizados para lectura en dispositivos móviles
 * IMPORTANTE: NO modifica los PDFs existentes, solo crea versiones móviles adicionales
 */

import { jsPDF } from 'jspdf';
import { mobileOptimizationService } from './mobileOptimizationService';
import { offlineSyncService } from './offlineSyncService';

interface MobileReportConfig {
    pageSize: 'a4' | 'letter';
    orientation: 'portrait' | 'landscape';
    fontSize: {
        title: number;
        subtitle: number;
        body: number;
        caption: number;
    };
    margins: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        text: string;
    };
    mobileOptimizations: {
        largerText: boolean;
        simplifiedCharts: boolean;
        reducedContent: boolean;
        touchFriendlyButtons: boolean;
    };
}

interface MobileReportData {
    id: string;
    title: string;
    type: 'risk_analysis' | 'forensic' | 'sampling' | 'observations';
    data: any;
    generatedAt: Date;
    deviceInfo: any;
    optimizedFor: 'mobile' | 'tablet' | 'desktop';
}

class MobileReportService {
    private config: MobileReportConfig = {
        pageSize: 'a4',
        orientation: 'portrait',
        fontSize: {
            title: 18,
            subtitle: 14,
            body: 11,
            caption: 9
        },
        margins: {
            top: 20,
            bottom: 20,
            left: 15,
            right: 15
        },
        colors: {
            primary: '#1e293b',
            secondary: '#475569',
            accent: '#3b82f6',
            text: '#334155'
        },
        mobileOptimizations: {
            largerText: true,
            simplifiedCharts: true,
            reducedContent: false,
            touchFriendlyButtons: true
        }
    };

    constructor() {
        this.adaptConfigForDevice();
        console.log('📱 Mobile Report Service inicializado');
    }

    /**
     * Adapta configuración según el dispositivo
     */
    private adaptConfigForDevice(): void {
        const deviceInfo = mobileOptimizationService.getDeviceInfo();
        
        if (deviceInfo.isMobile) {
            // Configuración para móviles
            this.config.fontSize = {
                title: 16,
                subtitle: 12,
                body: 10,
                caption: 8
            };
            this.config.margins = {
                top: 15,
                bottom: 15,
                left: 10,
                right: 10
            };
            this.config.mobileOptimizations.largerText = true;
            this.config.mobileOptimizations.simplifiedCharts = true;
            this.config.mobileOptimizations.reducedContent = true;
        } else if (deviceInfo.isTablet) {
            // Configuración para tablets
            this.config.fontSize = {
                title: 17,
                subtitle: 13,
                body: 10.5,
                caption: 8.5
            };
            this.config.margins = {
                top: 18,
                bottom: 18,
                left: 12,
                right: 12
            };
            this.config.mobileOptimizations.largerText = true;
            this.config.mobileOptimizations.simplifiedCharts = false;
            this.config.mobileOptimizations.reducedContent = false;
        }
    }

    /**
     * Genera reporte de análisis de riesgo optimizado para móvil
     */
    public async generateMobileRiskAnalysisReport(data: {
        population: any;
        profile: any;
        analysisData: any;
        scatterData: any[];
        insight: string;
        generatedBy: string;
        generatedDate: Date;
    }): Promise<string> {
        const deviceInfo = mobileOptimizationService.getDeviceInfo();
        const reportId = `mobile_risk_${Date.now()}`;
        
        console.log('📱 Generando reporte de riesgo móvil...');

        try {
            // Crear PDF optimizado para móvil
            const pdf = new jsPDF({
                orientation: this.config.orientation,
                unit: 'mm',
                format: this.config.pageSize
            });

            let yPosition = this.config.margins.top;

            // Título principal
            yPosition = this.addMobileTitle(pdf, 'ANÁLISIS DE RIESGO MÓVIL', yPosition);
            yPosition = this.addMobileSubtitle(pdf, `Población: ${data.population.name}`, yPosition);

            // Información del dispositivo
            yPosition = this.addDeviceInfo(pdf, deviceInfo, yPosition);

            // Resumen ejecutivo simplificado
            yPosition = this.addMobileSummary(pdf, data.profile, yPosition);

            // Métricas principales (simplificadas para móvil)
            yPosition = this.addMobileMetrics(pdf, data.analysisData, yPosition);

            // Insight principal
            yPosition = this.addMobileInsight(pdf, data.insight, yPosition);

            // Recomendaciones (versión móvil)
            yPosition = this.addMobileRecommendations(pdf, data.analysisData, yPosition);

            // Información de generación
            this.addMobileFooter(pdf, data.generatedBy, data.generatedDate);

            // Guardar offline para sincronización
            const pdfBlob = pdf.output('blob');
            const reportData: MobileReportData = {
                id: reportId,
                title: `Análisis de Riesgo Móvil - ${data.population.name}`,
                type: 'risk_analysis',
                data: {
                    ...data,
                    pdfBlob: pdfBlob
                },
                generatedAt: new Date(),
                deviceInfo,
                optimizedFor: deviceInfo.isMobile ? 'mobile' : deviceInfo.isTablet ? 'tablet' : 'desktop'
            };

            // Guardar offline
            offlineSyncService.saveOfflineData(reportId, 'report', reportData, 'high');

            // Descargar
            const fileName = `analisis_riesgo_movil_${data.population.name}_${Date.now()}.pdf`;
            pdf.save(fileName);

            console.log('✅ Reporte móvil generado:', fileName);
            return fileName;

        } catch (error) {
            console.error('❌ Error generando reporte móvil:', error);
            throw error;
        }
    }

    /**
     * Agrega título optimizado para móvil
     */
    private addMobileTitle(pdf: jsPDF, title: string, yPosition: number): number {
        pdf.setFontSize(this.config.fontSize.title);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(this.config.colors.primary);
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const textWidth = pdf.getTextWidth(title);
        const xPosition = (pageWidth - textWidth) / 2;
        
        pdf.text(title, xPosition, yPosition);
        
        return yPosition + 12;
    }

    /**
     * Agrega subtítulo optimizado para móvil
     */
    private addMobileSubtitle(pdf: jsPDF, subtitle: string, yPosition: number): number {
        pdf.setFontSize(this.config.fontSize.subtitle);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(this.config.colors.secondary);
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const textWidth = pdf.getTextWidth(subtitle);
        const xPosition = (pageWidth - textWidth) / 2;
        
        pdf.text(subtitle, xPosition, yPosition);
        
        return yPosition + 10;
    }

    /**
     * Agrega información del dispositivo
     */
    private addDeviceInfo(pdf: jsPDF, deviceInfo: any, yPosition: number): number {
        pdf.setFontSize(this.config.fontSize.caption);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(this.config.colors.secondary);
        
        const deviceText = `Generado en: ${deviceInfo.isMobile ? 'Móvil' : deviceInfo.isTablet ? 'Tablet' : 'Desktop'} | ${deviceInfo.platform} | ${deviceInfo.screenSize}`;
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const textWidth = pdf.getTextWidth(deviceText);
        const xPosition = (pageWidth - textWidth) / 2;
        
        pdf.text(deviceText, xPosition, yPosition);
        
        return yPosition + 15;
    }

    /**
     * Agrega resumen ejecutivo simplificado
     */
    private addMobileSummary(pdf: jsPDF, profile: any, yPosition: number): number {
        // Título de sección
        pdf.setFontSize(this.config.fontSize.subtitle);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(this.config.colors.primary);
        pdf.text('RESUMEN EJECUTIVO', this.config.margins.left, yPosition);
        yPosition += 8;

        // Contenido simplificado
        pdf.setFontSize(this.config.fontSize.body);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(this.config.colors.text);

        const summaryItems = [
            `Score de Riesgo: ${profile.totalRiskScore.toFixed(1)}`,
            `Alertas Detectadas: ${profile.gapAlerts}`,
            `Nivel de Riesgo: ${profile.totalRiskScore > 70 ? 'CRÍTICO' : profile.totalRiskScore > 40 ? 'MODERADO' : 'BAJO'}`
        ];

        summaryItems.forEach(item => {
            pdf.text(`• ${item}`, this.config.margins.left + 5, yPosition);
            yPosition += 6;
        });

        return yPosition + 10;
    }

    /**
     * Agrega métricas principales simplificadas
     */
    private addMobileMetrics(pdf: jsPDF, analysisData: any, yPosition: number): number {
        // Título de sección
        pdf.setFontSize(this.config.fontSize.subtitle);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(this.config.colors.primary);
        pdf.text('MÉTRICAS PRINCIPALES', this.config.margins.left, yPosition);
        yPosition += 8;

        // Métricas simplificadas
        pdf.setFontSize(this.config.fontSize.body);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(this.config.colors.text);

        const metrics = [
            { label: 'Valores Atípicos', value: analysisData.outliersCount },
            { label: 'Duplicados', value: analysisData.duplicatesCount },
            { label: 'Anomalías Benford', value: analysisData.benford?.filter((b: any) => b.isSuspicious).length || 0 }
        ];

        // Agregar métricas forenses si existen
        if (analysisData.entropy) {
            metrics.push({ label: 'Anomalías Categóricas', value: analysisData.entropy.anomalousCount });
        }
        if (analysisData.splitting) {
            metrics.push({ label: 'Fraccionamiento', value: analysisData.splitting.suspiciousVendors });
        }

        metrics.forEach(metric => {
            pdf.text(`• ${metric.label}: ${metric.value}`, this.config.margins.left + 5, yPosition);
            yPosition += 6;
        });

        return yPosition + 10;
    }

    /**
     * Agrega insight principal
     */
    private addMobileInsight(pdf: jsPDF, insight: string, yPosition: number): number {
        // Título de sección
        pdf.setFontSize(this.config.fontSize.subtitle);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(this.config.colors.primary);
        pdf.text('DICTAMEN FORENSE', this.config.margins.left, yPosition);
        yPosition += 8;

        // Insight
        pdf.setFontSize(this.config.fontSize.body);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(this.config.colors.text);

        const pageWidth = pdf.internal.pageSize.getWidth();
        const maxWidth = pageWidth - this.config.margins.left - this.config.margins.right;
        
        const lines = pdf.splitTextToSize(insight, maxWidth);
        lines.forEach((line: string) => {
            pdf.text(line, this.config.margins.left + 5, yPosition);
            yPosition += 5;
        });

        return yPosition + 10;
    }

    /**
     * Agrega recomendaciones simplificadas
     */
    private addMobileRecommendations(pdf: jsPDF, analysisData: any, yPosition: number): number {
        // Título de sección
        pdf.setFontSize(this.config.fontSize.subtitle);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(this.config.colors.primary);
        pdf.text('RECOMENDACIONES', this.config.margins.left, yPosition);
        yPosition += 8;

        // Recomendaciones simplificadas
        pdf.setFontSize(this.config.fontSize.body);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(this.config.colors.text);

        const recommendations = this.generateMobileRecommendations(analysisData);
        
        recommendations.forEach(rec => {
            const pageWidth = pdf.internal.pageSize.getWidth();
            const maxWidth = pageWidth - this.config.margins.left - this.config.margins.right - 10;
            const lines = pdf.splitTextToSize(`• ${rec}`, maxWidth);
            
            lines.forEach((line: string) => {
                pdf.text(line, this.config.margins.left + 5, yPosition);
                yPosition += 5;
            });
            yPosition += 2;
        });

        return yPosition + 10;
    }

    /**
     * Genera recomendaciones simplificadas para móvil
     */
    private generateMobileRecommendations(analysisData: any): string[] {
        const recommendations: string[] = [];

        // Recomendaciones basadas en hallazgos críticos
        if (analysisData.outliersCount > 10) {
            recommendations.push('Revisar valores atípicos detectados - posibles errores de captura');
        }

        if (analysisData.duplicatesCount > 0) {
            recommendations.push('Investigar transacciones duplicadas - verificar controles de entrada');
        }

        const suspiciousBenford = analysisData.benford?.filter((b: any) => b.isSuspicious).length || 0;
        if (suspiciousBenford > 2) {
            recommendations.push('Analizar distribución de dígitos - posible manipulación de datos');
        }

        // Recomendaciones forenses
        if (analysisData.entropy?.highRiskCombinations > 0) {
            recommendations.push('Revisar combinaciones categóricas críticas detectadas');
        }

        if (analysisData.splitting?.highRiskGroups > 0) {
            recommendations.push('Investigar patrones de fraccionamiento de alto riesgo');
        }

        if (analysisData.sequential?.highRiskGaps > 0) {
            recommendations.push('Verificar gaps secuenciales críticos en numeración');
        }

        // Recomendación general si no hay hallazgos críticos
        if (recommendations.length === 0) {
            recommendations.push('La población presenta un perfil de riesgo normal');
            recommendations.push('Proceder con muestreo estadístico estándar');
        }

        return recommendations.slice(0, 5); // Máximo 5 recomendaciones para móvil
    }

    /**
     * Agrega footer móvil
     */
    private addMobileFooter(pdf: jsPDF, generatedBy: string, generatedDate: Date): void {
        const pageHeight = pdf.internal.pageSize.getHeight();
        const yPosition = pageHeight - this.config.margins.bottom;

        pdf.setFontSize(this.config.fontSize.caption);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(this.config.colors.secondary);

        const footerText = `Generado por: ${generatedBy} | ${generatedDate.toLocaleDateString('es-ES')} | AAMA v4.1 Móvil`;
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const textWidth = pdf.getTextWidth(footerText);
        const xPosition = (pageWidth - textWidth) / 2;
        
        pdf.text(footerText, xPosition, yPosition);
    }

    /**
     * Genera vista previa HTML para móvil
     */
    public generateMobilePreview(data: any): string {
        const deviceInfo = mobileOptimizationService.getDeviceInfo();
        
        return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Vista Previa Móvil - Análisis de Riesgo</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 0;
                    padding: 16px;
                    background-color: #f8fafc;
                    font-size: ${deviceInfo.isMobile ? '14px' : '16px'};
                    line-height: 1.5;
                }
                .container {
                    max-width: 100%;
                    background: white;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .title {
                    font-size: ${deviceInfo.isMobile ? '20px' : '24px'};
                    font-weight: bold;
                    color: #1e293b;
                    text-align: center;
                    margin-bottom: 16px;
                }
                .subtitle {
                    font-size: ${deviceInfo.isMobile ? '14px' : '16px'};
                    color: #64748b;
                    text-align: center;
                    margin-bottom: 24px;
                }
                .section {
                    margin-bottom: 24px;
                    padding: 16px;
                    background: #f1f5f9;
                    border-radius: 8px;
                }
                .section-title {
                    font-size: ${deviceInfo.isMobile ? '16px' : '18px'};
                    font-weight: bold;
                    color: #1e293b;
                    margin-bottom: 12px;
                }
                .metric {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                .metric:last-child {
                    border-bottom: none;
                }
                .metric-label {
                    color: #64748b;
                }
                .metric-value {
                    font-weight: bold;
                    color: #1e293b;
                }
                .insight {
                    font-style: italic;
                    color: #475569;
                    background: #e0f2fe;
                    padding: 16px;
                    border-radius: 8px;
                    border-left: 4px solid #0ea5e9;
                }
                .recommendations {
                    list-style: none;
                    padding: 0;
                }
                .recommendations li {
                    padding: 8px 0;
                    padding-left: 20px;
                    position: relative;
                }
                .recommendations li:before {
                    content: "•";
                    color: #3b82f6;
                    font-weight: bold;
                    position: absolute;
                    left: 0;
                }
                .footer {
                    text-align: center;
                    font-size: 12px;
                    color: #94a3b8;
                    margin-top: 32px;
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                }
                @media (max-width: 480px) {
                    body { padding: 8px; }
                    .container { padding: 16px; }
                    .section { padding: 12px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="title">ANÁLISIS DE RIESGO MÓVIL</div>
                <div class="subtitle">Población: ${data.population?.name || 'N/A'}</div>
                
                <div class="section">
                    <div class="section-title">Resumen Ejecutivo</div>
                    <div class="metric">
                        <span class="metric-label">Score de Riesgo:</span>
                        <span class="metric-value">${data.profile?.totalRiskScore?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Alertas Detectadas:</span>
                        <span class="metric-value">${data.profile?.gapAlerts || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Nivel de Riesgo:</span>
                        <span class="metric-value">${(data.profile?.totalRiskScore || 0) > 70 ? 'CRÍTICO' : (data.profile?.totalRiskScore || 0) > 40 ? 'MODERADO' : 'BAJO'}</span>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Dictamen Forense</div>
                    <div class="insight">${data.insight || 'No disponible'}</div>
                </div>

                <div class="section">
                    <div class="section-title">Recomendaciones</div>
                    <ul class="recommendations">
                        ${this.generateMobileRecommendations(data.analysisData || {}).map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>

                <div class="footer">
                    Generado en dispositivo ${deviceInfo.isMobile ? 'móvil' : deviceInfo.isTablet ? 'tablet' : 'desktop'} | AAMA v4.1 Móvil
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Actualiza configuración del servicio
     */
    public updateConfig(newConfig: Partial<MobileReportConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuración de reportes móviles actualizada');
    }

    /**
     * Obtiene configuración actual
     */
    public getConfig(): MobileReportConfig {
        return { ...this.config };
    }
}

// Instancia singleton del servicio
export const mobileReportService = new MobileReportService();

// Hook personalizado para reportes móviles
export const useMobileReports = () => {
    return {
        generateRiskAnalysis: (data: any) =>
            mobileReportService.generateMobileRiskAnalysisReport(data),
        
        generatePreview: (data: any) =>
            mobileReportService.generateMobilePreview(data),
        
        updateConfig: (config: Partial<MobileReportConfig>) =>
            mobileReportService.updateConfig(config),
        
        getConfig: () =>
            mobileReportService.getConfig()
    };
};

export type { MobileReportConfig, MobileReportData };