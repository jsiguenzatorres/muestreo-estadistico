
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    variant?: 'default' | 'indigo' | 'emerald' | 'rose' | 'slate';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, variant = 'default' }) => {
    const [isBrowser, setIsBrowser] = useState(false);

    useEffect(() => {
        setIsBrowser(true);
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen || !isBrowser) return null;

    const styles = {
        default: { bg: 'from-slate-900 via-blue-900 to-slate-900', icon: 'fa-info-circle', iconColor: 'text-amber-400', accent: 'bg-blue-400' },
        indigo: { bg: 'from-indigo-900 via-indigo-800 to-indigo-900', icon: 'fa-book', iconColor: 'text-indigo-400', accent: 'bg-indigo-400' },
        emerald: { bg: 'from-emerald-900 via-emerald-800 to-teal-900', icon: 'fa-check-circle', iconColor: 'text-emerald-400', accent: 'bg-emerald-400' },
        rose: { bg: 'from-rose-900 via-rose-800 to-rose-950', icon: 'fa-exclamation-triangle', iconColor: 'text-rose-400', accent: 'bg-rose-400' },
        slate: { bg: 'from-slate-800 via-slate-700 to-slate-900', icon: 'fa-layer-group', iconColor: 'text-slate-300', accent: 'bg-slate-400' }
    };

    const activeStyle = styles[variant || 'default'] || styles.default;

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
            <div
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
                onClick={onClose}
                aria-hidden="true"
            ></div>

            <div
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all scale-100 overflow-hidden border border-slate-700/50 animate-fade-in-up"
                onClick={e => e.stopPropagation()}
            >
                <div className={`relative flex justify-between items-center px-6 py-5 bg-gradient-to-r ${activeStyle.bg} border-b border-white/10 shadow-lg overflow-hidden`}>
                    <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white to-transparent opacity-20`}></div>

                    <div className="flex items-center space-x-4 relative z-10">
                        <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 backdrop-blur-md border border-white/10 shadow-lg group-hover:bg-white/10 transition-all">
                            <i className={`fas ${activeStyle.icon} ${activeStyle.iconColor} text-xl`}></i>
                        </div>

                        <div className="flex flex-col">
                            <h3 className="text-xl font-extrabold text-white tracking-wide font-sans drop-shadow-md leading-tight">
                                {title}
                            </h3>
                            <div className="flex items-center mt-1">
                                <span className={`h-px w-6 ${activeStyle.accent} mr-2 opacity-50`}></span>
                                <span className="text-[10px] text-slate-300 uppercase tracking-[0.2em] font-bold opacity-80">
                                    Notificación del Sistema
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="group p-2 rounded-full hover:bg-white/10 transition-all duration-200 focus:outline-none"
                    >
                        <i className="fas fa-times text-slate-400 text-lg group-hover:text-white transition-all"></i>
                    </button>
                </div>

                {/* Content Area - Styled for readability */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50 flex-grow">
                    {/* The content container ensures styles from constants.tsx apply correctly */}
                    <div className="text-slate-700 leading-relaxed text-sm md:text-base">
                        {children}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-900 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-600 font-bold text-sm transition-all transform hover:-translate-y-0.5 uppercase tracking-wide border border-slate-700"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );

    const rootElement = document.getElementById('root');
    return rootElement ? ReactDOM.createPortal(modalContent, rootElement) : null;
};

export default Modal;
