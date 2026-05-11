import React, { useState, useEffect, useRef } from 'react';
import { AppState, SamplingMethod, UserRole } from '../../types';
import { generateAuditReport } from '../../services/reportService';
// 🎯 IMPORTAR DIRECTAMENTE LA FUNCIÓN ESPECIALIZADA
import { generateNonStatisticalReport } from '../../services/nonStatisticalReportService';
import { utils, writeFile } from 'xlsx';
import Modal from '../ui/Modal';
import { RichInfoCard } from '../ui/RichInfoCard';
import InfoHelper from '../ui/InfoHelper';
import ObservationsManager from '../sampling/ObservationsManager';
import { ASSISTANT_CONTENT } from '../../constants';

interface Props {
    appState: AppState;
    role: UserRole;
    onBack: () => void;
    title: string;
    subtitle?: string;
    sidebarContent: React.ReactNode;
    mainContent?: React.ReactNode;
    children?: React.ReactNode;
    certificationContent: React.ReactNode;
    onSaveManual?: () => void;
    isSaving?: boolean;
}

interface AnalysisResult {
    titulo: string;
    descripcion_profesional: string;
    cantidad_items: number;
}

const SharedResultsLayout: React.FC<Props> = ({
    appState, role, onBack, title, subtitle,
    sidebarContent, mainContent, children, certificationContent,
    onSaveManual, isSaving
}) => {
    const [analysisResults, setAnalysisResults] = useState<AnalysisResult[] | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [showObservations, setShowObservations] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false); // 🔧 NUEVO ESTADO

    const exceptions = (appState.results?.sample || [])
        .filter(i => i.compliance_status === 'EXCEPCION');

    // 🔧 FUNCIÓN MEJORADA PARA GENERAR REPORTE
    const handleGenerateReport = async () => {
        if (isGeneratingReport) {
            console.warn("⚠️ Reporte ya en generación, ignorando click adicional");
            return;
        }

        setIsGeneratingReport(true);
        
        try {
            console.log("📄 Iniciando generación de reporte PDF...");
            const startTime = Date.now();
            
            // 🎯 DETECCIÓN DIRECTA DEL MÉTODO
            if (appState.samplingMethod === SamplingMethod.NonStatistical) {
                console.log("🎯 Detectado método No Estadístico - Usando reporte especializado");
                await generateNonStatisticalReport(appState);
            } else {
                console.log("📄 Usando reporte estándar para método:", appState.samplingMethod);
                await generateAuditReport(appState);
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ Reporte generado exitosamente en ${duration}ms`);
            
        } catch (error) {
            console.error("❌ Error generando reporte:", error);
            alert(`Error al generar el reporte: ${error.message || 'Error desconocido'}`);
        } finally {
            setIsGeneratingReport(false);
        }
    };

    useEffect(() => {
        if (exceptions.length > 0) {
            // Heurística de Agrupamiento Local (Simulación de IA)
            const grouped = {
                'Integridad': { items: 0, desc: 'Se detectaron fallos en la completitud de los registros o campos obligatorios vacíos.' },
                'Documentación': { items: 0, desc: 'Los ítems seleccionados carecen de soporte documental o referencias cruzadas válidas.' },
                'Cálculo': { items: 0, desc: 'Diferencias aritméticas encontradas entre el valor en libros y la verificación física.' }
            };

            exceptions.forEach(ex => {
                const desc = (ex.error_description || '').toLowerCase();
                if (desc.includes('falta') || desc.includes('soporte') || desc.includes('document')) grouped.Documentación.items++;
                else if (desc.includes('calculo') || desc.includes('error') || desc.includes('diferencia')) grouped.Cálculo.items++;
                else grouped.Integridad.items++;
            });

            const results = Object.entries(grouped)
                .filter(([_, data]) => data.items > 0)
                .map(([titulo, data]) => ({
                    titulo: `Riesgo de ${titulo}`,
                    descripcion_profesional: data.desc,
                    cantidad_items: data.items
                }));

            setAnalysisResults(results);
        } else {
            setAnalysisResults(null);
        }
    }, [exceptions.length]);

    const handleExportExcel = () => {
        const mapping = appState.selectedPopulation?.column_mapping;
        const sample = appState.results?.sample || [];
        const data = sample.map((item, idx) => {
            const raw = item.raw_row || {};
            const monetaryVal = mapping?.monetaryValue ? raw[mapping.monetaryValue] : undefined;
            const uniqueIdVal = mapping?.uniqueId ? raw[mapping.uniqueId] : undefined;

            // Determinar fase
            const fase = item.is_pilot_item ? "FASE 1: PILOTO" :
                (item.risk_factors?.some(f => f.includes('Ampliación')) ? "FASE 2: AMPLIACIÓN" : "MUESTRA");

            return {
                'Item #': idx + 1,
                'ID Referencia': item.id || uniqueIdVal || 'N/A',
                'Fase / Origen': fase,
                'Estrato': item.stratum_label || 'E1',
                'Valor Libros / Importe': parseFloat(String(item.value || monetaryVal || 0)),
                'Riesgo (Pts)': item.risk_score || 0,
                'Evaluación de Control': item.compliance_status === 'OK' ? 'CONFORME' : 'EXCEPCIÓN',
                'Hallazgos / Observaciones Técnicas': item.error_description || (item.compliance_status === 'OK' ? 'Sin desviación detectada' : '')
            };
        });

        const ws = utils.json_to_sheet(data || []);

        // Estética y anchos de columna
        if (!ws['!cols']) ws['!cols'] = [];
        ws['!cols'] = [
            { wch: 8 },  // Item #
            { wch: 25 }, // ID Referencia
            { wch: 20 }, // Fase
            { wch: 15 }, // Estrato
            { wch: 20 }, // Importe
            { wch: 12 }, // Riesgo
            { wch: 20 }, // Evaluación
            { wch: 60 }  // Hallazgos
        ];

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Ficha Tecnica Auditoria");
        writeFile(wb, `CEDULA_PT_${appState.samplingMethod.toUpperCase()}_${new Date().getTime()}.xlsx`);
    };

    return (
        <div className="animate-fade-in space-y-8 pb-40">
            <div className="bg-white/80 backdrop-blur-md px-10 py-5 rounded-[2.5rem] shadow-xl border border-white sticky top-4 z-40 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <button onClick={onBack} className="group flex items-center gap-3 px-6 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:border-indigo-400">
                            <i className="fas fa-chevron-left"></i> Ajustar Parámetros
                        </button>
                        <div>
                            <h2 className="text-slate-900 font-black text-lg uppercase tracking-tight">{title}</h2>
                            {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{subtitle}</p>}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setShowObservations(true)} className="px-6 py-3 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                            <i className="fas fa-folder-open mr-2"></i> Expediente
                        </button>
                        <button onClick={handleExportExcel} className="px-6 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">
                            Exportar Excel
                        </button>
                        {onSaveManual && (
                            <button
                                onClick={onSaveManual}
                                disabled={isSaving}
                                className="px-6 py-3 bg-[#ccff00] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#bbe600] transition-all shadow-lg shadow-emerald-400/20 flex items-center gap-2"
                            >
                                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                                Guardar Trabajo
                            </button>
                        )}
                        <button 
                            onClick={handleGenerateReport}
                            disabled={isGeneratingReport}
                            className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isGeneratingReport ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-file-pdf"></i>
                                    Generar Reporte PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1 space-y-10">
                    {sidebarContent}

                    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
                        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.15em] mb-8">Dictamen de Hallazgos</h4>
                        <div className="space-y-4">
                            {analysisResults ? analysisResults.map((item, i) => (
                                <div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <h5 className="text-[11px] font-black text-slate-700 uppercase">{item.titulo}</h5>
                                        <span className="text-[10px] font-black text-indigo-600">n={item.cantidad_items}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-500 font-medium italic">"{item.descripcion_profesional}"</p>
                                </div>
                            )) : (
                                <div className="text-center py-10 opacity-30">
                                    <p className="text-[9px] font-black uppercase tracking-widest">Sin Excepciones</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    {children || mainContent}
                </div>
            </div>

            {certificationContent}

            {/* Modal de Expediente de Evidencias */}
            <Modal isOpen={showObservations} onClose={() => setShowObservations(false)} title="Expediente de Auditoría" variant="default">
                {appState.selectedPopulation ? (
                    <ObservationsManager
                        populationId={appState.selectedPopulation.id}
                        method={appState.samplingMethod}
                        onObservationsUpdate={() => { }} // Optional: refresh UI if needed
                    />
                ) : (
                    <p>No hay población seleccionada.</p>
                )}
            </Modal>
        </div>
    );
};

export default SharedResultsLayout;
