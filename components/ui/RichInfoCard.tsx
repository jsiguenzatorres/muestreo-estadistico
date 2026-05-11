
import React from 'react';

interface RichInfoCardProps {
    title: string;
    children: React.ReactNode;
    type: 'definition' | 'justification' | 'impact' | 'formula' | 'standard' | 'warning' | 'tip';
    className?: string;
}

export const RichInfoCard: React.FC<RichInfoCardProps> = ({ title, children, type, className = '' }) => {
    const styles = {
        definition: { border: 'border-blue-500', bg: 'bg-white', icon: 'fa-book', text: 'text-blue-800' },
        justification: { border: 'border-slate-500', bg: 'bg-slate-50', icon: 'fa-balance-scale', text: 'text-slate-800' },
        impact: { border: 'border-amber-500', bg: 'bg-amber-50', icon: 'fa-chart-line', text: 'text-amber-800' },
        formula: { border: 'border-indigo-500', bg: 'bg-indigo-50', icon: 'fa-calculator', text: 'text-indigo-800' },
        standard: { border: 'border-emerald-500', bg: 'bg-emerald-50', icon: 'fa-ruler-combined', text: 'text-emerald-800' },
        warning: { border: 'border-red-500', bg: 'bg-red-50', icon: 'fa-exclamation-triangle', text: 'text-red-800' },
        tip: { border: 'border-cyan-500', bg: 'bg-cyan-50', icon: 'fa-lightbulb', text: 'text-cyan-800' },
    };
    
    const style = styles[type] || styles.definition;

    return (
        <div className={`border-l-4 ${style.border} shadow-sm rounded-r-lg p-4 mb-3 ${style.bg} ${className}`}>
            <h4 className={`flex items-center ${style.text} font-bold text-xs uppercase tracking-wider mb-2`}>
                <i className={`fas ${style.icon} mr-2`}></i> {title}
            </h4>
            <div className="text-slate-700 text-sm font-medium leading-relaxed">
                {children}
            </div>
        </div>
    );
};
