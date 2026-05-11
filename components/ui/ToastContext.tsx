import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            px-4 py-3 rounded-lg shadow-lg text-white font-medium text-sm animate-fade-in-up transition-all
                            ${toast.type === 'success' ? 'bg-emerald-500' : ''}
                            ${toast.type === 'error' ? 'bg-rose-500' : ''}
                            ${toast.type === 'info' ? 'bg-slate-800' : ''}
                        `}
                    >
                        <div className="flex items-center gap-2">
                            {toast.type === 'success' && <i className="fas fa-check-circle"></i>}
                            {toast.type === 'error' && <i className="fas fa-exclamation-circle"></i>}
                            {toast.type === 'info' && <i className="fas fa-info-circle"></i>}
                            {toast.message}
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
