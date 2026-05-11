
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { SamplingMethod } from '../../types';

interface RiskChartProps {
    upperErrorLimit: number;
    tolerableError: number;
    method?: SamplingMethod;
}

const RiskChart: React.FC<RiskChartProps> = ({ upperErrorLimit, tolerableError, method }) => {

    // Normalize data for Attribute sampling (percent) vs Monetary (value)
    // If method is attribute, tolerableError input is actually Total Expected Error Count for visualization or similar
    // To simplify, we rely on the props passed.

    const isAcceptable = upperErrorLimit <= tolerableError;
    const isClose = upperErrorLimit > tolerableError * 0.9 && isAcceptable;

    const data = [
        {
            name: 'Resultados',
            'Límite Superior (Proyección)': upperErrorLimit,
            'Error Tolerable (Umbral)': tolerableError,
        },
    ];

    const formatMoney = (value: number) => {
        return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const formatValue = (val: number) => method === 'attribute' ? `${val}%` : `$${formatMoney(val)}`;

    // Define Action Label
    let actionLabel = "✅ Aceptable: Monitoreo";
    let actionColor = "bg-green-100 text-green-800";
    if (!isAcceptable) {
        actionLabel = "🔍 Inaceptable: Revisión Inmediata";
        actionColor = "bg-red-100 text-red-800 animate-pulse";
    } else if (isClose) {
        actionLabel = "⚠ Precaución: Revisión Prioritaria";
        actionColor = "bg-orange-100 text-orange-800";
    }

    return (
        <div className="relative w-full h-full flex flex-col" style={{ minHeight: '200px' }}>
            <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%" debounce={300} minWidth={200} minHeight={150}>
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 20, right: 120, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" tickFormatter={(val) => method === 'attribute' ? val : `$${val / 1000}k`} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis dataKey="name" type="category" hide />
                        <Tooltip
                            cursor={{ fill: '#f8fafc', opacity: 0.5 }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [formatValue(value), '']}
                            itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <Legend verticalAlign="bottom" height={40} iconSize={10} wrapperStyle={{ paddingTop: '20px', fontSize: '10px' }} />

                        <Bar dataKey="Límite Superior (Proyección)" fill={isAcceptable ? (isClose ? '#fbbf24' : '#4ade80') : '#f87171'} radius={[0, 4, 4, 0]} barSize={30}>
                            <LabelList dataKey="Límite Superior (Proyección)" position="right" formatter={(val: number) => formatValue(val)} style={{ fontSize: '12px', fontWeight: 'bold', fill: '#475569' }} />
                        </Bar>
                        <Bar dataKey="Error Tolerable (Umbral)" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={30}>
                            <LabelList dataKey="Error Tolerable (Umbral)" position="right" formatter={(val: number) => formatValue(val)} style={{ fontSize: '12px', fontWeight: 'bold', fill: '#475569' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-2 flex justify-end">
                <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border ${actionColor}`}>
                    {actionLabel}
                </span>
            </div>
        </div>
    );
};

export default RiskChart;
