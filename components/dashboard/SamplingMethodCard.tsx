
import React from 'react';
import { SamplingMethod } from '../../types';
import Card from '../ui/Card';

export interface MethodColors {
    bg: string;
    hoverBg: string;
    iconBg: string;
    iconText: string;
    titleText: string;
    descriptionText: string;
    linkText: string;
}

export interface MethodConfig {
    id: SamplingMethod;
    title: string;
    description: string;
    icon: string;
    colors: MethodColors;
}

interface Props {
    method: MethodConfig;
    onClick: (method: SamplingMethod) => void;
    isRecommended?: boolean; // NEW PROP
}

export const SamplingMethodCard: React.FC<Props> = ({ method, onClick, isRecommended }) => {
    return (
        <div 
            onClick={() => onClick(method.id)} 
            className={`cursor-pointer group transition-transform duration-300 ease-in-out hover:-translate-y-1 ${isRecommended ? 'ring-4 ring-purple-400 ring-offset-2 rounded-lg' : ''}`}
        >
            <Card className={`h-full flex flex-col transition-colors duration-300 ${method.colors.bg} ${method.colors.hoverBg} border-transparent shadow-lg hover:shadow-2xl`}>
                <div className="flex-grow relative">
                    {isRecommended && (
                        <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-purple-400 z-10">
                            RECOMENDADO
                        </span>
                    )}
                    <div className={`flex items-center justify-center h-16 w-16 ${method.colors.iconBg} rounded-lg mb-4`}>
                        <i className={`fas ${method.icon} text-3xl ${method.colors.iconText}`}></i>
                    </div>
                    <h3 className={`text-lg font-bold mb-2 ${method.colors.titleText}`}>{method.title}</h3>
                    <p className={`text-sm ${method.colors.descriptionText}`}>{method.description}</p>
                </div>
                <div className="mt-4 text-right">
                        <span className={`text-sm font-semibold ${method.colors.linkText}`}>
                        Iniciar Muestreo <i className="fas fa-arrow-right ml-1 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </span>
                </div>
            </Card>
        </div>
    );
};
