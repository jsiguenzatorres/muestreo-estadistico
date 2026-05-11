
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { AppState } from '../../types';

interface AllocationRow {
    stratum: string;
    totalCount: number;
    totalValue: number;
    suggestedSize: number;
    manualSize: number;
}

interface Props {
    appState: AppState;
    onConfirm: (allocations: Record<string, number>) => void;
    onCancel: () => void;
}

const StratumAllocationPreview: React.FC<Props> = ({ appState, onConfirm, onCancel }) => {
    const [loading, setLoading] = useState(true);
    const [allocations, setAllocations] = useState<AllocationRow[]>([]);
    const [totalTarget, setTotalTarget] = useState(50);
    const [statisticalN, setStatisticalN] = useState(0);
    const [showWarning, setShowWarning] = useState(false);

    const mapping = appState.selectedPopulation?.column_mapping;
    const selectedVariables = appState.samplingParams.stratified.selectedVariables || [];
    const populationId = appState.selectedPopulation?.id;

    useEffect(() => {
        fetchDistribution();
    }, []);

    const fetchDistribution = async () => {
        if (!populationId || selectedVariables.length === 0) return;
        setLoading(true);

        try {
            // 1. Calcular n estadístico basado en los nuevos parámetros de Estratificado
            const attr = appState.samplingParams.stratified;
            let rFactorAttr = 2.3; // Default (90-94%)
            if (attr.NC >= 99) rFactorAttr = 4.6;
            else if (attr.NC >= 95) rFactorAttr = 3.0;

            const calcN = Math.ceil((rFactorAttr * 100) / (Math.max(0.1, attr.ET - attr.PE)));
            setStatisticalN(calcN);

            // Si el piloto (50) es mayor que el n estadístico, activar advertencia
            if (attr.usePilotSample && calcN < 50) {
                setShowWarning(true);
            }

            // Fetch all rows for grouping
            const { data: rows, error } = await supabase
                .from('audit_data_rows')
                .select('raw_json')
                .eq('population_id', populationId);

            if (error) throw error;

            const distribution: Record<string, { count: number; value: number }> = {};

            rows?.forEach(r => {
                const raw = r.raw_json || {};
                const keys = selectedVariables.map(v => {
                    const mappingKey = v === 'Category' ? 'category' : (v === 'Subcategory' ? 'subcategory' : v.toLowerCase());
                    const colName = mapping?.[mappingKey as keyof typeof mapping] as string;
                    return String(raw[colName] || 'Sin Clasificar');
                });
                const key = keys.join(' | ');

                if (!distribution[key]) distribution[key] = { count: 0, value: 0 };
                distribution[key].count++;

                const valCol = mapping?.monetaryValue;
                const val = parseFloat(String(raw[valCol as string] || 0));
                distribution[key].value += val;
            });

            const totalRows = appState.selectedPopulation?.total_rows || 1;
            const currentTarget = totalTarget; // Use current state target

            const initialAllocations = Object.entries(distribution).map(([stratum, data]) => {
                const suggested = Math.max(1, Math.round((data.count / totalRows) * currentTarget));
                return {
                    stratum,
                    totalCount: data.count,
                    totalValue: data.value,
                    suggestedSize: suggested,
                    manualSize: suggested
                };
            });

            setAllocations(initialAllocations);
        } catch (err) {
            console.error("Error calculating distribution:", err);
        } finally {
            setLoading(false);
        }
    };

    const adjustToStatisticalMin = () => {
        setTotalTarget(statisticalN);
        setShowWarning(false);

        // Recalcular alocaciones con el nuevo totalTarget
        const totalRows = appState.selectedPopulation?.total_rows || 1;
        setAllocations(prev => prev.map(row => {
            const suggested = Math.max(1, Math.round((row.totalCount / totalRows) * statisticalN));
            return { ...row, suggestedSize: suggested, manualSize: suggested };
        }));
    };

    const handleManualChange = (index: number, value: number) => {
        const newAllocations = [...allocations];
        newAllocations[index].manualSize = value;
        setAllocations(newAllocations);
    };

    const handleConfirm = () => {
        const result: Record<string, number> = {};
        allocations.forEach(a => {
            result[a.stratum] = a.manualSize;
        });
        onConfirm(result);
    };

    const formatCurrency = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <div className="h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-black text-indigo-900 uppercase tracking-widest">Calculando Distribución de Estratos...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            {showWarning && (
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl animate-bounce-subtle">
                    <div className="flex items-center gap-6 text-center md:text-left">
                        <div className="h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-inner">
                            <i className="fas fa-exclamation-triangle text-2xl"></i>
                        </div>
                        <div>
                            <h4 className="text-amber-900 font-black text-sm uppercase tracking-widest">Inconsistencia de Tamaño Piloto</h4>
                            <p className="text-xs text-amber-700 font-medium leading-relaxed max-w-md">
                                El piloto configurado (50) es <span className="font-black">superior</span> al requerimiento estadístico total calculado (<span className="text-amber-900 font-black">{statisticalN}</span>).
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowWarning(false)}
                            className="px-6 py-3 bg-white border border-amber-200 text-amber-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-100 transition-all"
                        >
                            Ignorar
                        </button>
                        <button
                            onClick={adjustToStatisticalMin}
                            className="px-8 py-3 bg-amber-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-amber-700 transition-all transform hover:-translate-y-1"
                        >
                            <i className="fas fa-magic mr-2"></i> Ajustar a {statisticalN} ítems
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-2xl">
                <h4 className="font-black text-indigo-900 uppercase text-xs tracking-widest mb-2">Pre-Análisis de Celdas (Cross-Stratification)</h4>
                <p className="text-sm text-indigo-800 leading-relaxed font-medium">
                    Hemos agrupado el universo por <span className="bg-indigo-200 px-2 py-0.5 rounded text-indigo-900 font-black">{selectedVariables.join(' y ')}</span>. Por favor, valide la distribución y ajuste las submuestras según su juicio profesional.
                </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estrato / Combinación</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">N (Items)</th>
                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Valor Total</th>
                            <th className="px-6 py-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center bg-indigo-50/50">Muestra Sugerida</th>
                            <th className="px-6 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center bg-emerald-50/50 underline">Muestra Manual</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {allocations.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4">
                                    <span className="text-xs font-black text-slate-700">{row.stratum}</span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-xs font-bold text-slate-500">{row.totalCount.toLocaleString()}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <span className="text-xs font-bold text-slate-600">{formatCurrency(row.totalValue)}</span>
                                </td>
                                <td className="px-6 py-4 text-center bg-indigo-50/20">
                                    <span className="text-xs font-black text-indigo-400">{row.suggestedSize}</span>
                                </td>
                                <td className="px-6 py-4 text-center bg-emerald-50/20">
                                    <input
                                        type="number"
                                        value={row.manualSize}
                                        onChange={(e) => handleManualChange(idx, Number(e.target.value))}
                                        className="w-16 bg-transparent border-b-2 border-emerald-200 text-center font-black text-emerald-700 focus:outline-none focus:border-emerald-500"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-900 text-white">
                            <td className="px-6 py-4 font-black text-[10px] uppercase tracking-widest">Totales</td>
                            <td className="px-6 py-4 text-center font-black text-xs">{allocations.reduce((a, b) => a + b.totalCount, 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-black text-xs">{formatCurrency(allocations.reduce((a, b) => a + b.totalValue, 0))}</td>
                            <td className="px-6 py-4 text-center text-xs font-black text-indigo-300">{allocations.reduce((a, b) => a + b.suggestedSize, 0)}</td>
                            <td className="px-6 py-4 text-center text-xs font-black text-emerald-400">{allocations.reduce((a, b) => a + b.manualSize, 0)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={onCancel}
                    className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 hover:border-slate-300 transition-all"
                >
                    Volver
                </button>
                <button
                    onClick={handleConfirm}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-2xl uppercase text-[10px] tracking-widest transition-all transform hover:-translate-y-1 flex items-center justify-center"
                >
                    <i className="fas fa-check-double mr-2 text-cyan-400"></i>
                    Confirmar y Ejecutar Muestreo
                </button>
            </div>
        </div>
    );
};

export default StratumAllocationPreview;
