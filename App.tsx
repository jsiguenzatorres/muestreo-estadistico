
import React, { useState } from 'react';
import { AppState, SamplingMethod, AuditPopulation, ColumnMapping, AuditResults, AppView } from './types';
import Step4Results from './components/steps/Step4_Results';
import Dashboard from './components/dashboard/Dashboard';
import SamplingWorkspace from './components/sampling/SamplingWorkspace';
import PopulationManager from './components/data/PopulationManager';
import DataUploadFlow from './components/data/DataUploadFlow';
import ValidationWorkspace from './components/data/ValidationWorkspace';
import DiscoveryModule from './components/data/DiscoveryModule';
import RiskProfiler from './components/risk/RiskProfiler';
import Stepper from './components/layout/Stepper';
import { ToastProvider, useToast } from './components/ui/ToastContext';
import { supabase } from './services/supabaseClient';

import Sidebar from './components/layout/Sidebar';
import TopHeader from './components/layout/TopHeader';
import MainDashboard from './components/dashboard/MainDashboard';
import AuditExpedienteView from './components/results/AuditExpedienteView';
import { AuthProvider, useAuth } from './services/AuthContext';
import LoginView from './components/auth/LoginView';
import AdminUserManagementView from './components/admin/AdminUserManagementView';

const AuthenticatedApp: React.FC = () => {
    const { user, profile, loading, signOut } = useAuth();
    const { addToast } = useToast();
    const [view, setView] = useState<AppView>('main_dashboard');
    const [activePopulation, setActivePopulation] = useState<AuditPopulation | null>(null);
    const [validationPopulationId, setValidationPopulationId] = useState<string | null>(null);

    const [appState, setAppState] = useState<AppState>({
        connection: { table: '', idColumn: '', valueColumn: '', validated: false, user: '', url: '' },
        selectedPopulation: null,
        generalParams: { objective: '', standard: 'NIA 530', template: 'NIA 530 Detalle', seed: Math.floor(Math.random() * 100000) },
        samplingMethod: SamplingMethod.Attribute,
        samplingParams: {
            attribute: { N: 0, NC: 95, ET: 5, PE: 1, useSequential: false },
            mus: { V: 0, TE: 50000, EE: 500, RIA: 5, optimizeTopStratum: true, handleNegatives: 'Separate', usePilotSample: false },
            cav: { sigma: 0, stratification: true, estimationTechnique: 'Media', usePilotSample: false, NC: 95, TE: 50000 },
            stratified: { basis: 'Monetary', strataCount: 3, allocationMethod: 'Óptima (Neyman)', certaintyStratumThreshold: 10000, detectOutliers: false, usePilotSample: false, selectedVariables: [], manualAllocations: undefined, NC: 95, ET: 5, PE: 1 },
            nonStatistical: { criteria: '', justification: '', sampleSize: 30, selectedInsight: 'Default', sizeJustification: '', materiality: 50000 },
        },
        results: null,
        isLocked: false,
        isCurrentVersion: false
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9]">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-bold animate-pulse text-sm">Validando Credenciales...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <LoginView />;
    }

    if (profile && !profile.is_active) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] p-8">
                <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-12 text-center animate-fade-in">
                    <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-amber-100 shadow-inner">
                        <i className="fas fa-clock-rotate-left text-4xl text-amber-500"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-4">Acceso en Revisión</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">
                        Hola <span className="text-slate-800 font-bold">{profile.full_name}</span>. Tu cuenta ha sido registrada correctamente, pero aún no está activa.
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-6 text-xs text-slate-400 font-bold uppercase tracking-widest border border-slate-100 italic">
                        Un administrador validará tus credenciales y autorizará tu acceso en breve.
                    </div>
                    <button
                        onClick={() => signOut()}
                        className="mt-10 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                    >
                        Salir / Iniciar con otra cuenta
                    </button>
                </div>
            </div>
        );
    }

    const handlePopulationSelected = async (population: AuditPopulation) => {
        try {
            console.log("🔍 Cargando población:", population.id);
            // Use Proxy for Fetching Results to Bypass Firewall
            const res = await fetch(`/api/get_audit_results?population_id=${population.id}`);
            let existingResults = null;

            if (res.ok) {
                const { data } = await res.json();
                existingResults = data;
            } else {
                console.warn("⚠️ Failed to fetch results via proxy", await res.text());
            }

            const rawJson = existingResults?.results_json as any;
            const isMultiMethod = rawJson && (rawJson[SamplingMethod.MUS] || rawJson[SamplingMethod.Attribute] || rawJson[SamplingMethod.NonStatistical]);

            let loadedResults: AuditResults | null = null;
            let loadedParams = null;
            let activeMethod: SamplingMethod = appState.samplingMethod;

            if (isMultiMethod) {
                activeMethod = rawJson.last_method as SamplingMethod || activeMethod;
                loadedResults = rawJson[activeMethod] || null;
                loadedParams = loadedResults?.sampling_params || null;
            } else if (rawJson) {
                loadedResults = rawJson;
                loadedParams = rawJson.sampling_params || null;
                activeMethod = rawJson.method || activeMethod;
            }

            setAppState(prev => ({
                ...prev,
                selectedPopulation: population,
                isLocked: !!existingResults,
                isCurrentVersion: !!existingResults,
                full_results_storage: rawJson || {},
                results: loadedResults,
                samplingMethod: activeMethod,
                samplingParams: loadedParams ? { ...prev.samplingParams, ...loadedParams } : {
                    ...prev.samplingParams,
                    attribute: { ...prev.samplingParams.attribute, N: population.total_rows },
                    mus: { ...prev.samplingParams.mus, V: population.total_monetary_value }
                }
            }));

            setActivePopulation(population);
        } catch (e) {
            console.error("💥 Excepción crítica en handlePopulationSelected:", e);
            setActivePopulation(population);
        } finally {
            setView('dashboard');
        }
    };

    const handleUploadComplete = (populationId: string) => {
        console.log("🚩 Carga completa. Cambiando a ValidationWorkspace para:", populationId);
        setValidationPopulationId(populationId);
        setView('validation_workspace');
    };

    const handleValidationComplete = (population: AuditPopulation) => {
        setValidationPopulationId(population.id);
        setView('discovery_analysis');
    };



    const handleDiscoveryComplete = async (mapping: ColumnMapping, activeTests: string[]) => {
        if (!validationPopulationId) return;

        try {
            // Use Proxy to bypass Firewall
            const res = await fetch('/api/update_mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: validationPopulationId,
                    column_mapping: mapping,
                    advanced_analysis: { forensicDiscovery: activeTests }
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Proxy update failed');
            }

            const data = await res.json();
            setActivePopulation(data as AuditPopulation);
            setView('risk_profiling');
            addToast("Mapeo confirmado correctamente", 'success');

        } catch (error: any) {
            console.error("Error saving discovery results:", error);
            addToast("Error al confirmar mapeo (Firewall Bypass): " + error.message, 'error');
        }
    };

    const handleRiskComplete = (updatedPop: AuditPopulation) => {
        setValidationPopulationId(null);
        handlePopulationSelected(updatedPop);
    };

    const handleMethodSelect = (method: SamplingMethod) => {
        setAppState(prev => {
            const storage = prev.full_results_storage || {};
            const methodSpecificResults = storage[method];
            const isLegacyMatch = prev.results && (prev.results as any).method === method;
            const existingWork = methodSpecificResults || (isLegacyMatch ? prev.results : null);

            if (existingWork) {
                setTimeout(() => setView('results'), 0);
            } else {
                setTimeout(() => setView('sampling_config'), 0);
            }

            return {
                ...prev,
                samplingMethod: method,
                results: existingWork,
                samplingParams: existingWork?.sampling_params ? { ...prev.samplingParams, ...existingWork.sampling_params } : prev.samplingParams
            };
        });
    };

    const navigateTo = (targetView: AppView) => {
        if (targetView === 'population_manager' || targetView === 'main_dashboard') {
            setAppState(prev => ({ ...prev, selectedPopulation: null, results: null, isLocked: false, isCurrentVersion: false }));
            setActivePopulation(null);
        }
        setView(targetView);
    };

    const handleLoadProject = async (id: string) => {
        const { data, error } = await supabase
            .from('audit_populations')
            .select('*')
            .eq('id', id)
            .single();

        if (data && !error) {
            handlePopulationSelected(data as AuditPopulation);
        }
    };

    const renderView = () => {
        const displayUserName = profile?.full_name || user?.email?.split('@')[0] || "Auditor";
        switch (view) {
            case 'main_dashboard':
                return <MainDashboard userName={displayUserName} onNavigate={navigateTo} onLoadPopulation={handleLoadProject} />;
            case 'population_manager':
                return <PopulationManager onPopulationSelected={handlePopulationSelected} onAddNew={() => setView('data_upload')} />;
            case 'data_upload':
                return <DataUploadFlow onComplete={handleUploadComplete} onCancel={() => setView('population_manager')} />;
            case 'validation_workspace':
                if (!validationPopulationId) return <p>ID de población no válido.</p>;
                return <ValidationWorkspace
                    populationId={validationPopulationId}
                    onValidationComplete={handleValidationComplete}
                    onCancel={() => setView('population_manager')}
                />;
            case 'discovery_analysis':
                if (!validationPopulationId) return <p>ID de población no válido para Descubrimiento.</p>;
                return <DiscoveryModule
                    populationId={validationPopulationId}
                    onComplete={handleDiscoveryComplete}
                />;
            case 'risk_profiling':
                if (!activePopulation) return <p>Datos de población no cargados para Perfilado de Riesgo.</p>;
                return <RiskProfiler
                    population={activePopulation}
                    onComplete={handleRiskComplete}
                />;
            case 'dashboard':
                if (!activePopulation) return <p>No hay una población activa.</p>;
                return <Dashboard onMethodSelect={handleMethodSelect} population={activePopulation} onNavigate={navigateTo} />;
            case 'sampling_config':
                if (!activePopulation) return null;
                return <SamplingWorkspace
                    appState={appState}
                    setAppState={setAppState}
                    currentMethod={appState.samplingMethod}
                    onBack={() => setView('dashboard')}
                    onComplete={() => setView('results')}
                />;
            case 'results':
                if (!appState.results) return null;
                return <Step4Results
                    appState={appState}
                    setAppState={setAppState}
                    onBack={() => setView('sampling_config')}
                    onRestart={() => navigateTo('population_manager')}
                />;
            case 'audit_expediente':
                return <AuditExpedienteView appState={appState} onBack={() => setView('main_dashboard')} />;
            case 'admin_user_management':
                return <AdminUserManagementView />;
            default:
                return <MainDashboard userName={displayUserName} onNavigate={navigateTo} />;
        }
    };

    return (
        <div className="flex h-screen bg-[#F4F7F9] font-sans text-slate-800 overflow-hidden">
            {/* BARRA LATERAL FIJA */}
            <Sidebar currentView={view} onNavigate={navigateTo} appState={appState} />

            {/* CONTENIDO PRINCIPAL */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <TopHeader
                    onNavigate={navigateTo}
                />

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F4F7F9] p-0 relative">

                    <div className="container mx-auto">
                        {renderView()}
                    </div>
                </main>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ToastProvider>
            <AuthProvider>
                <AuthenticatedApp />
            </AuthProvider>
        </ToastProvider>
    );
};

export default App;
