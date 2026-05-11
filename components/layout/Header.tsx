
import React, { useState } from 'react';
import { AppView } from '../../App';

interface Props {
    onNavigate: (view: AppView) => void;
}

const Header: React.FC<Props> = ({ onNavigate }) => {
    const [selectorInput, setSelectorInput] = useState('');
    const [highlighted, setHighlighted] = useState<Element[]>([]);

    const applySelector = () => {
        highlighted.forEach(el => el.classList.remove('highlight-selector'));
        if (!selectorInput.trim()) {
            setHighlighted([]);
            return;
        }
        try {
            const elements = Array.from(document.querySelectorAll(selectorInput));
            if (elements.length === 0) {
                setHighlighted([]);
                return;
            }
            elements.forEach(el => el.classList.add('highlight-selector'));
            setHighlighted(elements);
        } catch (error) {
            setHighlighted([]);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') applySelector();
    };

    return (
        <header className="relative bg-slate-900 shadow-xl z-30 overflow-hidden font-sans">
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 opacity-90"></div>
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-900/10 to-transparent pointer-events-none"></div>
            
            {/* Top Gradient Ribbon - Harmonizing with BFA colors (Emerald, Blue, Amber) */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-600 to-amber-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] z-20"></div>

            <div className="container mx-auto px-6 h-20 flex items-center justify-between relative z-10">
                {/* Logo & Identity */}
                <div 
                    onClick={() => onNavigate('population_manager')} 
                    className="flex items-center cursor-pointer group select-none"
                >
                    {/* Institutional Icon */}
                    <div className="relative w-11 h-11 flex-shrink-0 mr-4">
                        {/* Background Shapes */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 to-cyan-600 rounded-lg transform rotate-3 group-hover:rotate-6 transition-transform duration-500 shadow-lg opacity-90"></div>
                        <div className="absolute inset-0 bg-slate-800 rounded-lg border border-slate-600/50 flex items-center justify-center transform -rotate-3 group-hover:rotate-0 transition-transform duration-500 backdrop-blur-sm shadow-inner">
                            <i className="fas fa-university text-lg text-blue-100 drop-shadow-md"></i>
                        </div>
                        {/* Status Dot */}
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                    </div>

                    <div className="flex flex-col justify-center">
                        <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-none group-hover:text-blue-50 transition-colors drop-shadow-sm">
                            Asistente de Muestras Estadísticas
                        </h1>
                        <div className="flex items-center mt-1">
                            <div className="h-px w-4 bg-blue-500 mr-2 opacity-50"></div>
                            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 group-hover:text-blue-300 transition-colors">
                                Auditoría Interna
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center space-x-6">
                    
                    {/* CSS Inspector (Functional but refined style) */}
                    <div className="hidden lg:flex items-center bg-slate-950/50 rounded-full border border-slate-700/50 px-3 py-1.5 transition-all hover:border-slate-600 focus-within:ring-1 focus-within:ring-blue-500/50 focus-within:border-blue-500/50 shadow-inner">
                        <i className="fas fa-terminal text-slate-600 text-xs mr-2"></i>
                        <input
                            type="text"
                            placeholder="Inspector CSS..."
                            value={selectorInput}
                            onChange={(e) => setSelectorInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="bg-transparent border-none text-xs text-slate-300 placeholder-slate-600 focus:outline-none w-32 font-mono"
                        />
                         <button onClick={applySelector} className="text-slate-500 hover:text-blue-400 transition-colors">
                            <i className="fas fa-search text-xs"></i>
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-800 mx-2 hidden md:block"></div>

                    {/* User Profile */}
                    <div className="flex items-center space-x-3 pl-1 cursor-default">
                        <div className="text-right hidden md:block leading-tight">
                            <p className="text-xs font-bold text-slate-200">Auditor Principal</p>
                            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Conectado</p>
                        </div>
                        <div className="relative group">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center shadow-lg group-hover:border-blue-500/50 transition-colors">
                                <span className="font-bold text-xs text-blue-100 group-hover:text-white">AP</span>
                            </div>
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Glow Line */}
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
        </header>
    );
};

export default Header;
