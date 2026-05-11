import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                    <div className="max-w-3xl w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-rose-200">
                        <div className="bg-rose-500 px-8 py-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-rose-600 flex items-center justify-center text-white text-2xl shadow-inner">
                                <i className="fas fa-bug"></i>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white uppercase tracking-tight">System Critical Error</h1>
                                <p className="text-rose-100 font-medium text-sm">React Component Render Failure</p>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-lg">
                                <h2 className="text-rose-800 font-bold mb-2 text-lg">Error Message:</h2>
                                <code className="block bg-white p-4 rounded border border-rose-100 text-rose-600 font-mono text-sm break-words">
                                    {this.state.error?.toString()}
                                </code>
                            </div>

                            <div>
                                <h2 className="text-slate-700 font-bold mb-3 uppercase tracking-wider text-xs">Component Stack Trace:</h2>
                                <div className="bg-slate-900 rounded-xl p-4 overflow-auto max-h-96 shadow-inner custom-scrollbar">
                                    <pre className="text-emerald-400 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                                        {this.state.errorInfo?.componentStack || "No stack trace available"}
                                    </pre>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                                >
                                    <i className="fas fa-sync-alt mr-2"></i> Recargar Sistema
                                </button>
                                <button
                                    onClick={() => {
                                        localStorage.clear();
                                        window.location.reload();
                                    }}
                                    className="w-full py-4 bg-white text-rose-600 border-2 border-rose-100 rounded-xl font-bold uppercase tracking-widest hover:bg-rose-50 transition-all"
                                >
                                    <i className="fas fa-trash-alt mr-2"></i> Limpiar Caché y Reiniciar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
