
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import InfoHelper from './InfoHelper';
import { ASSISTANT_CONTENT } from '../../constants';

// --- Types & Interfaces ---

export interface PremiumVariableCardProps {
    title: string;
    icon: string;
    colorTheme: 'blue' | 'amber' | 'teal' | 'slate' | 'indigo' | 'orange';
    infoKey: keyof typeof ASSISTANT_CONTENT;
    children: React.ReactNode;
    subtitle: string;
    currentValue?: string | number;
}

export interface DropdownOption {
    value: number;
    label: string;
    annotation?: string;
}

export interface CustomDropdownProps {
    value: number;
    options: DropdownOption[];
    onChange: (value: number) => void;
    colorTheme: 'blue' | 'amber' | 'teal' | 'indigo' | 'orange';
}

// --- Helper Components ---

export const PremiumVariableCard: React.FC<PremiumVariableCardProps> = ({
    title,
    icon,
    colorTheme,
    infoKey,
    children,
    subtitle,
    currentValue
}) => {
    const themeClasses = {
        blue: 'border-l-blue-500 shadow-blue-100 hover:shadow-blue-200',
        amber: 'border-l-amber-500 shadow-amber-100 hover:shadow-amber-200',
        teal: 'border-l-teal-500 shadow-teal-100 hover:shadow-teal-200',
        slate: 'border-l-slate-500 shadow-slate-100 hover:shadow-slate-200',
        indigo: 'border-l-indigo-500 shadow-indigo-100 hover:shadow-indigo-200',
        orange: 'border-l-orange-500 shadow-orange-100 hover:shadow-orange-200',
    };

    const iconColors = {
        blue: 'text-blue-600 bg-blue-50',
        amber: 'text-amber-600 bg-amber-50',
        teal: 'text-teal-600 bg-teal-50',
        slate: 'text-slate-600 bg-slate-50',
        indigo: 'text-indigo-600 bg-indigo-50',
        orange: 'text-orange-600 bg-orange-50',
    };

    return (
        <div className={`bg-white p-6 rounded-xl border border-gray-100 border-l-[6px] shadow-[0_4px_20px_rgb(0,0,0,0.05)] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg ${themeClasses[colorTheme]} group h-full flex flex-col`}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center">
                    <div className={`p-2.5 rounded-lg mr-3 transition-colors ${iconColors[colorTheme]}`}>
                        <i className={`fas ${icon} text-lg`}></i>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-800 uppercase tracking-wide block group-hover:text-gray-900 transition-colors">
                            {title}
                        </label>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{subtitle}</p>
                    </div>
                </div>
                <div className="text-gray-400 hover:text-blue-600 transition-colors">
                    <InfoHelper
                        title={ASSISTANT_CONTENT[infoKey].title}
                        content={ASSISTANT_CONTENT[infoKey].content}
                        currentValue={currentValue}
                    />
                </div>
            </div>
            <div className="relative mt-auto z-10">
                {children}
            </div>
        </div>
    );
};

// ─── CustomGradientDropdown ────────────────────────────────────────────────────
// El menú se renderiza via ReactDOM.createPortal directamente en document.body
// para escapar de cualquier contexto de apilamiento (stacking context) o
// overflow:hidden que exista en los ancestros del componente.
// La posición se calcula con getBoundingClientRect() y se usa position:fixed,
// lo que garantiza que el menú siempre aparece sobre todos los demás elementos.
export const CustomGradientDropdown: React.FC<CustomDropdownProps> = ({ value, options, onChange, colorTheme }) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef   = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    const themes = {
        blue: {
            button: 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-blue-200',
            activeItem: 'bg-blue-50 text-blue-700',
            ring: 'ring-blue-200',
            icon: 'text-blue-100',
            check: 'text-blue-600'
        },
        amber: {
            button: 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-600 hover:to-amber-500 text-white shadow-amber-200',
            activeItem: 'bg-amber-50 text-amber-700',
            ring: 'ring-amber-200',
            icon: 'text-amber-100',
            check: 'text-amber-600'
        },
        teal: {
            button: 'bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-600 hover:to-teal-500 text-white shadow-teal-200',
            activeItem: 'bg-teal-50 text-teal-700',
            ring: 'ring-teal-200',
            icon: 'text-teal-100',
            check: 'text-teal-600'
        },
        indigo: {
            button: 'bg-gradient-to-r from-indigo-500 to-indigo-400 hover:from-indigo-600 hover:to-indigo-500 text-white shadow-indigo-200',
            activeItem: 'bg-indigo-50 text-indigo-700',
            ring: 'ring-indigo-200',
            icon: 'text-indigo-100',
            check: 'text-indigo-600'
        },
        orange: {
            button: 'bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white shadow-orange-200',
            activeItem: 'bg-orange-50 text-orange-700',
            ring: 'ring-orange-200',
            icon: 'text-orange-100',
            check: 'text-orange-600'
        }
    };

    const currentTheme = themes[colorTheme] || themes.blue;
    const selectedOption = options.find(opt => opt.value === value);

    // Recalcula la posición del menú a partir del botón
    const syncPosition = () => {
        if (!buttonRef.current) return;
        const r = buttonRef.current.getBoundingClientRect();
        setMenuStyle({
            position: 'fixed',
            top:   r.bottom + 4,
            left:  r.left,
            width: r.width,
            zIndex: 9999,
        });
    };

    // Cierra al hacer clic fuera del botón o del menú
    useEffect(() => {
        if (!isOpen) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!buttonRef.current?.contains(t) && !menuRef.current?.contains(t)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [isOpen]);

    // Mantiene la posición sincronizada mientras el menú está abierto
    useEffect(() => {
        if (!isOpen) return;
        syncPosition();
        window.addEventListener('scroll', syncPosition, true);
        window.addEventListener('resize', syncPosition);
        return () => {
            window.removeEventListener('scroll', syncPosition, true);
            window.removeEventListener('resize', syncPosition);
        };
    }, [isOpen]);

    const handleToggle = () => {
        if (!isOpen) syncPosition();
        setIsOpen(prev => !prev);
    };

    const handleSelect = (val: number) => {
        onChange(val);
        setIsOpen(false);
    };

    // Menú renderizado en document.body → no hay overflow ni z-index que lo clippe
    const menu = isOpen ? ReactDOM.createPortal(
        <div
            ref={menuRef}
            style={menuStyle}
            className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up max-h-64 overflow-y-auto custom-scrollbar"
        >
            {options.map((option) => (
                <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={`px-4 py-3 cursor-pointer flex justify-between items-center transition-colors border-b border-gray-50 last:border-0 hover:bg-gray-50 ${option.value === value ? currentTheme.activeItem : 'text-gray-700'}`}
                >
                    <div className="flex flex-col">
                        <span className="font-bold text-sm">{option.label}</span>
                        {option.annotation && (
                            <span className={`text-[10px] uppercase font-bold mt-0.5 ${option.value === value ? 'opacity-80' : 'text-gray-400'}`}>
                                {option.annotation}
                            </span>
                        )}
                    </div>
                    {option.value === value && (
                        <i className={`fas fa-check ${currentTheme.check}`}></i>
                    )}
                </div>
            ))}
        </div>,
        document.body
    ) : null;

    return (
        <div className="relative w-full">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                className={`w-full px-4 py-3 rounded-lg shadow-md flex items-center justify-between transition-all duration-200 transform active:scale-[0.98] focus:outline-none focus:ring-4 ${currentTheme.ring} ${currentTheme.button}`}
            >
                <div className="flex flex-col items-start text-left">
                    <span className="text-lg font-bold leading-none tracking-tight">{selectedOption?.label}</span>
                    {selectedOption?.annotation && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-90 mt-1">{selectedOption.annotation}</span>
                    )}
                </div>
                <i className={`fas fa-chevron-down transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${currentTheme.icon}`}></i>
            </button>
            {menu}
        </div>
    );
};
