import React, { useState, useEffect } from 'react';
import { AppState, SamplingMethod, AuditResults } from '../../types';
import AttributeResultsView from '../results/AttributeResultsView';
import MonetaryResultsView from '../results/MonetaryResultsView';
import NonStatisticalResultsView from '../results/NonStatisticalResultsView';
import StratifiedResultsView from '../results/StratifiedResultsView';
import CAVResultsView from '../results/CAVResultsView';

interface Props {
    appState: AppState;
    setAppState: React.Dispatch<React.SetStateAction<AppState>>;
    onBack: () => void;
    onRestart: () => void;
}

const Step4Results: React.FC<Props> = ({ appState, setAppState, onBack, onRestart }) => {
    if (!appState.results) return null;

    const { samplingMethod, selectedPopulation } = appState;
    const role = 'auditor'; // Default role, could be dynamic

    // Render logic based on sampling method
    switch (samplingMethod) {
        case SamplingMethod.Attribute:
            return (
                <AttributeResultsView
                    appState={appState}
                    setAppState={setAppState}
                    role={role}
                    onBack={onBack}
                />
            );
        case SamplingMethod.MUS:
            return (
                <MonetaryResultsView
                    appState={appState}
                    setAppState={setAppState}
                    role={role}
                    onBack={onBack}
                />
            );
        case SamplingMethod.CAV:
            return (
                <CAVResultsView
                    appState={appState}
                    setAppState={setAppState}
                    role={role}
                    onBack={onBack}
                />
            );
        case SamplingMethod.Stratified:
            return (
                <StratifiedResultsView
                    appState={appState}
                    setAppState={setAppState}
                    role={role}
                    onBack={onBack}
                />
            );
        case SamplingMethod.NonStatistical:
            return (
                <NonStatisticalResultsView
                    appState={appState}
                    setAppState={setAppState}
                    role={role}
                    onBack={onBack}
                />
            );
        default:
            return (
                <div className="p-10 text-center">
                    <h3 className="text-xl font-bold text-slate-700">Vista de resultados no implementada para este método.</h3>
                    <button onClick={onBack} className="mt-4 text-blue-600 underline">Volver</button>
                </div>
            );
    }
};

export default Step4Results;
