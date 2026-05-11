import React, { useState } from 'react';
import Modal from '../ui/Modal';

interface ForensicConfig {
    splittingThresholds: number[];
    timeWindow: number;
    entropyThreshold: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: ForensicConfig) => void;
    initialConfig?: ForensicConfig;
}

const ForensicConfigModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialConfig }) => {
    const [config, setConfig] = useState<ForensicConfig>(
        initialConfig || {
            splittingThresholds: [1000, 5000, 10000, 25000, 50000],
            timeWindow: 30,
            entropyThreshold: 0.02
        }
    );

    const [thresholdInput, setThresholdInput] = useState(
        config.splittingThresholds.join(', ')
    );

    const handleSave = () => {
        // Parsear umbrales de fraccionamiento
        const thresholds = thresholdInput
            .split(',')
            .map(t => parseFloat(t.trim()))
            .filter(t => !isNaN(t) && t > 0)
            .sort((a, b) => a - b);

        const finalConfig = {
            ...config,
            splittingThresholds: thresholds.length > 0 ? thresholds : [1000, 5000, 10000]
        };

        onSave(finalConfig);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="⚙️ Configuración de Análisis Forense">
            <div className="p-6 space-y-6">
                {/* Umbrales de Fraccionamiento */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <i className="fas fa-scissors mr-2"></i>
                        Umbrales de Fraccionamiento
                    </label>
                    <input
                        type="text"
                        value={thresholdInput}
                        onChange={(e) => setThresholdInput(e.target.value)}
                        placeholder="1000, 5000, 10000, 25000, 50000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Ingrese los umbrales monetarios separados por comas. El sistema detectará compras divididas que excedan estos montos.
                    </p>
                </div>

                {/* Ventana de Tiempo */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <i className="fas fa-clock mr-2"></i>
                        Ventana de Tiempo para Fraccionamiento (días)
                    </label>
                    <input
                        type="number"
                        value={config.timeWindow}
                        onChange={(e) => setConfig({
                            ...config,
                            timeWindow: parseInt(e.target.value) || 30
                        })}
                        min="1"
                        max="365"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Número máximo de días para considerar transacciones como parte del mismo patrón de fraccionamiento.
                    </p>
                </div>

                {/* Umbral de Entropía */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <i className="fas fa-microchip mr-2"></i>
                        Umbral de Rareza para Entropía (%)
                    </label>
                    <input
                        type="number"
                        value={config.entropyThreshold * 100}
                        onChange={(e) => setConfig({
                            ...config,
                            entropyThreshold: (parseFloat(e.target.value) || 2) / 100
                        })}
                        min="0.1"
                        max="10"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Porcentaje mínimo de frecuencia para considerar una combinación categórica como anómala.
                    </p>
                </div>

                {/* Información Adicional */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">
                        <i className="fas fa-info-circle mr-2"></i>
                        Información sobre la Configuración
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                        <li>• <strong>Umbrales de Fraccionamiento:</strong> Montos de autorización típicos en su organización</li>
                        <li>• <strong>Ventana de Tiempo:</strong> Período para agrupar transacciones sospechosas</li>
                        <li>• <strong>Umbral de Entropía:</strong> Sensibilidad para detectar combinaciones categóricas raras</li>
                    </ul>
                </div>

                {/* Vista Previa */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">
                        <i className="fas fa-eye mr-2"></i>
                        Vista Previa de Configuración
                    </h4>
                    <div className="text-sm text-gray-600 space-y-1">
                        <div>
                            <strong>Umbrales:</strong> {thresholdInput.split(',').map(t => t.trim()).filter(t => t).map(t => `$${parseFloat(t).toLocaleString()}`).join(', ')}
                        </div>
                        <div>
                            <strong>Ventana:</strong> {config.timeWindow} días
                        </div>
                        <div>
                            <strong>Entropía:</strong> {(config.entropyThreshold * 100).toFixed(1)}% de rareza mínima
                        </div>
                    </div>
                </div>

                {/* Botones */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        <i className="fas fa-save mr-2"></i>
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ForensicConfigModal;