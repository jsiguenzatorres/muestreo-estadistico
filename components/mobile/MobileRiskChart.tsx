/**
 * Componente de Gráfico de Riesgo Optimizado para Móvil
 * Incluye gestos táctiles, zoom, pan y navegación optimizada
 */

import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useMobileOptimization } from '../../services/mobileOptimizationService';
import type { TouchGesture } from '../../services/mobileOptimizationService';

interface Props {
    scatterData: any[];
    onPointClick: (data: any) => void;
    visibleRiskLevels: {
        high: boolean;
        medium: boolean;
        low: boolean;
    };
    onToggleRiskLevel: (level: 'high' | 'medium' | 'low') => void;
    getFilteredScatterData: () => any[];
    CustomTooltip: React.ComponentType<any>;
}

const MobileRiskChart: React.FC<Props> = ({
    scatterData,
    onPointClick,
    visibleRiskLevels,
    onToggleRiskLevel,
    getFilteredScatterData,
    CustomTooltip
}) => {
    const { deviceInfo, isMobile, adaptiveUI } = useMobileOptimization();
    const chartRef = useRef<HTMLDivElement>(null);
    
    // Estados para gestos móviles
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [selectedPoint, setSelectedPoint] = useState<any>(null);
    const [showMobileTooltip, setShowMobileTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [isGestureActive, setIsGestureActive] = useState(false);

    // Configuración adaptativa para móvil
    const mobileConfig = {
        chartHeight: adaptiveUI.chartHeight,
        minZoom: 0.5,
        maxZoom: 3,
        panSensitivity: 1,
        doubleTapZoomFactor: 1.5,
        longPressDelay: 500
    };

    useEffect(() => {
        if (!isMobile) return;

        const { onGesture, offGesture } = useMobileOptimization();

        // Registrar gestos táctiles
        onGesture('chart-gestures', handleGesture);

        return () => {
            offGesture('chart-gestures');
        };
    }, [isMobile]);

    /**
     * Maneja gestos táctiles en el gráfico
     */
    const handleGesture = (gesture: TouchGesture) => {
        if (!chartRef.current) return;

        const chartRect = chartRef.current.getBoundingClientRect();
        const isInsideChart = 
            gesture.startX >= chartRect.left &&
            gesture.startX <= chartRect.right &&
            gesture.startY >= chartRect.top &&
            gesture.startY <= chartRect.bottom;

        if (!isInsideChart) return;

        setIsGestureActive(true);
        setTimeout(() => setIsGestureActive(false), 300);

        switch (gesture.type) {
            case 'tap':
                handleTap(gesture);
                break;
            case 'double-tap':
                handleDoubleTap(gesture);
                break;
            case 'long-press':
                handleLongPress(gesture);
                break;
            case 'swipe':
                handleSwipe(gesture);
                break;
            case 'pinch':
                handlePinch(gesture);
                break;
            case 'pan':
                handlePan(gesture);
                break;
        }
    };

    /**
     * Maneja tap simple - seleccionar punto
     */
    const handleTap = (gesture: TouchGesture) => {
        const point = findPointAtPosition(gesture.startX, gesture.startY);
        
        if (point) {
            setSelectedPoint(point);
            setTooltipPosition({ x: gesture.startX, y: gesture.startY });
            setShowMobileTooltip(true);
            
            // Vibración táctil si está disponible
            if ('vibrate' in navigator) {
                navigator.vibrate(50);
            }
        } else {
            setShowMobileTooltip(false);
            setSelectedPoint(null);
        }
    };

    /**
     * Maneja doble tap - zoom in/out
     */
    const handleDoubleTap = (gesture: TouchGesture) => {
        const newZoom = zoomLevel < 1.5 
            ? zoomLevel * mobileConfig.doubleTapZoomFactor 
            : 1;
        
        setZoomLevel(Math.min(Math.max(newZoom, mobileConfig.minZoom), mobileConfig.maxZoom));
        
        // Vibración para feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([50, 50, 50]);
        }
    };

    /**
     * Maneja long press - abrir modal de detalles
     */
    const handleLongPress = (gesture: TouchGesture) => {
        const point = findPointAtPosition(gesture.startX, gesture.startY);
        
        if (point) {
            onPointClick(point);
            
            // Vibración más larga para long press
            if ('vibrate' in navigator) {
                navigator.vibrate(100);
            }
        }
    };

    /**
     * Maneja swipe - navegación y filtros
     */
    const handleSwipe = (gesture: TouchGesture) => {
        if (!gesture.direction) return;

        switch (gesture.direction) {
            case 'left':
                // Cambiar al siguiente filtro de riesgo
                cycleThroughRiskFilters('next');
                break;
            case 'right':
                // Cambiar al filtro anterior
                cycleThroughRiskFilters('prev');
                break;
            case 'up':
                // Zoom in
                setZoomLevel(prev => Math.min(prev * 1.2, mobileConfig.maxZoom));
                break;
            case 'down':
                // Zoom out
                setZoomLevel(prev => Math.max(prev / 1.2, mobileConfig.minZoom));
                break;
        }
    };

    /**
     * Maneja pinch - zoom
     */
    const handlePinch = (gesture: TouchGesture) => {
        if (!gesture.scale) return;

        const newZoom = zoomLevel * gesture.scale;
        setZoomLevel(Math.min(Math.max(newZoom, mobileConfig.minZoom), mobileConfig.maxZoom));
    };

    /**
     * Maneja pan - desplazamiento
     */
    const handlePan = (gesture: TouchGesture) => {
        const deltaX = (gesture.endX - gesture.startX) * mobileConfig.panSensitivity;
        const deltaY = (gesture.endY - gesture.startY) * mobileConfig.panSensitivity;
        
        setPanOffset(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
        }));
    };

    /**
     * Encuentra punto en posición específica
     */
    const findPointAtPosition = (x: number, y: number): any | null => {
        // Simulación de detección de punto
        // En implementación real, se calcularía basado en las coordenadas del gráfico
        const filteredData = getFilteredScatterData();
        
        // Por ahora, retornamos un punto aleatorio para demostración
        if (filteredData.length > 0) {
            const randomIndex = Math.floor(Math.random() * filteredData.length);
            return filteredData[randomIndex];
        }
        
        return null;
    };

    /**
     * Cicla a través de filtros de riesgo
     */
    const cycleThroughRiskFilters = (direction: 'next' | 'prev') => {
        const levels: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
        const currentActive = levels.filter(level => visibleRiskLevels[level]);
        
        if (currentActive.length === 0) {
            // Si no hay ninguno activo, activar alto riesgo
            onToggleRiskLevel('high');
            return;
        }

        if (currentActive.length === 3) {
            // Si todos están activos, mostrar solo alto riesgo
            onToggleRiskLevel('medium');
            onToggleRiskLevel('low');
            return;
        }

        // Lógica de ciclo
        const currentIndex = levels.indexOf(currentActive[0]);
        let nextIndex;
        
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % levels.length;
        } else {
            nextIndex = currentIndex === 0 ? levels.length - 1 : currentIndex - 1;
        }

        // Desactivar actual y activar siguiente
        currentActive.forEach(level => onToggleRiskLevel(level));
        onToggleRiskLevel(levels[nextIndex]);
    };

    /**
     * Resetea zoom y pan
     */
    const resetView = () => {
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
        setShowMobileTooltip(false);
        setSelectedPoint(null);
    };

    // Tooltip móvil personalizado
    const MobileTooltip = () => {
        if (!showMobileTooltip || !selectedPoint) return null;

        return (
            <div 
                className="fixed z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 max-w-xs"
                style={{
                    left: Math.min(tooltipPosition.x, window.innerWidth - 200),
                    top: Math.max(tooltipPosition.y - 100, 20)
                }}
            >
                <div className="flex items-center gap-3 mb-3">
                    <div 
                        className="h-4 w-4 rounded-full"
                        style={{ 
                            backgroundColor: selectedPoint.y > 75 ? '#f43f5e' : 
                                           selectedPoint.y > 40 ? '#f59e0b' : '#10b981' 
                        }}
                    ></div>
                    <div className="font-bold text-slate-800 text-sm">
                        {selectedPoint.name || selectedPoint.id}
                    </div>
                </div>
                
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-slate-600">Score:</span>
                        <span className="font-bold">{selectedPoint.y?.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Alertas:</span>
                        <span className="font-bold">{selectedPoint.x}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Valor:</span>
                        <span className="font-bold">{selectedPoint.value?.toLocaleString('es-ES', { 
                            style: 'currency', 
                            currency: 'USD' 
                        })}</span>
                    </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    Mantén presionado para más detalles
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            {/* Controles móviles superiores */}
            {isMobile && (
                <div className="mb-4 flex items-center justify-between bg-slate-50 rounded-2xl p-3">
                    <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-slate-600">
                            Zoom: {(zoomLevel * 100).toFixed(0)}%
                        </div>
                        {isGestureActive && (
                            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                        )}
                    </div>
                    
                    <button
                        onClick={resetView}
                        className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all"
                    >
                        <i className="fas fa-undo mr-1"></i>
                        Reset
                    </button>
                </div>
            )}

            {/* Contenedor del gráfico */}
            <div 
                ref={chartRef}
                className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden"
                style={{
                    transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                    transformOrigin: 'center center',
                    transition: isGestureActive ? 'none' : 'transform 0.3s ease'
                }}
            >
                <div className="flex justify-between items-center mb-6">
                    <h4 className={`font-black text-slate-400 uppercase tracking-wide ${adaptiveUI.fontSize}`}>
                        Red de Dispersión Forense
                    </h4>
                    
                    {isMobile && (
                        <div className="text-xs text-slate-500">
                            <i className="fas fa-hand-paper mr-1"></i>
                            Gestos activos
                        </div>
                    )}
                </div>

                <div style={{ height: mobileConfig.chartHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis 
                                type="number" 
                                dataKey="x" 
                                name="Alertas" 
                                hide={deviceInfo.screenSize === 'small'}
                                tick={{ fontSize: deviceInfo.isMobile ? 8 : 10, fontWeight: 'bold' }}
                            />
                            <YAxis 
                                type="number" 
                                dataKey="y" 
                                name="Score" 
                                domain={[0, 100]} 
                                tick={{ fontSize: deviceInfo.isMobile ? 8 : 10, fontWeight: 'bold' }} 
                            />
                            <ZAxis type="number" dataKey="z" range={[30, 400]} />
                            
                            {/* Tooltip solo para desktop */}
                            {!isMobile && <Tooltip content={<CustomTooltip />} />}
                            
                            <ReferenceLine 
                                y={75} 
                                stroke="#f43f5e" 
                                strokeDasharray="5 5" 
                                label={{ 
                                    position: 'right', 
                                    value: 'ALTA PRIORIDAD', 
                                    fill: '#f43f5e', 
                                    fontSize: deviceInfo.isMobile ? 6 : 8, 
                                    fontWeight: 'bold' 
                                }} 
                            />
                            
                            <Scatter 
                                name="Hallazgos" 
                                data={getFilteredScatterData()}
                                onClick={isMobile ? undefined : onPointClick}
                                style={{ cursor: 'pointer' }}
                            >
                                {getFilteredScatterData().map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={entry.y > 75 ? '#f43f5e' : entry.y > 40 ? '#f59e0b' : '#10b981'} 
                                        fillOpacity={0.7}
                                        stroke={entry.y > 75 ? '#dc2626' : entry.y > 40 ? '#d97706' : '#059669'}
                                        strokeWidth={deviceInfo.isMobile ? 2 : 1}
                                        r={deviceInfo.isMobile ? 6 : 4}
                                        style={{ cursor: 'pointer' }}
                                    />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Controles de filtro móviles */}
            {isMobile && (
                <div className="mt-4 space-y-3">
                    <div className="text-xs font-bold text-slate-600 text-center">
                        Desliza ← → para cambiar filtros
                    </div>
                    
                    <div className="flex gap-2 justify-center">
                        <button
                            onClick={() => onToggleRiskLevel('high')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                visibleRiskLevels.high 
                                    ? 'bg-red-100 text-red-800 border-2 border-red-300' 
                                    : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                            }`}
                        >
                            <div className={`h-2 w-2 rounded-full ${visibleRiskLevels.high ? 'bg-red-500' : 'bg-gray-400'}`}></div>
                            Alto ({scatterData.filter(p => p.y > 75).length})
                        </button>
                        
                        <button
                            onClick={() => onToggleRiskLevel('medium')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                visibleRiskLevels.medium 
                                    ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' 
                                    : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                            }`}
                        >
                            <div className={`h-2 w-2 rounded-full ${visibleRiskLevels.medium ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
                            Medio ({scatterData.filter(p => p.y > 40 && p.y <= 75).length})
                        </button>
                        
                        <button
                            onClick={() => onToggleRiskLevel('low')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                visibleRiskLevels.low 
                                    ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                                    : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                            }`}
                        >
                            <div className={`h-2 w-2 rounded-full ${visibleRiskLevels.low ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            Bajo ({scatterData.filter(p => p.y <= 40).length})
                        </button>
                    </div>
                </div>
            )}

            {/* Instrucciones de gestos para móvil */}
            {isMobile && (
                <div className="mt-4 bg-blue-50 rounded-2xl p-4 border border-blue-200">
                    <div className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-2">
                        <i className="fas fa-info-circle"></i>
                        Gestos Disponibles
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                        <div>• Tap: Seleccionar punto</div>
                        <div>• Doble tap: Zoom</div>
                        <div>• Mantener: Detalles</div>
                        <div>• Deslizar: Filtros</div>
                        <div>• Pellizcar: Zoom</div>
                        <div>• Arrastrar: Mover</div>
                    </div>
                </div>
            )}

            {/* Tooltip móvil */}
            <MobileTooltip />
        </div>
    );
};

export default MobileRiskChart;