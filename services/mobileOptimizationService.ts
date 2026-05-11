/**
 * Servicio de Optimización Móvil para AAMA
 * Maneja detección de dispositivos, gestos táctiles y adaptaciones de UI
 */

interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    screenSize: 'small' | 'medium' | 'large' | 'xlarge';
    orientation: 'portrait' | 'landscape';
    touchSupport: boolean;
    platform: string;
}

interface TouchGesture {
    type: 'tap' | 'double-tap' | 'long-press' | 'swipe' | 'pinch' | 'pan';
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration: number;
    distance: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    scale?: number;
}

interface MobileConfig {
    enableTouchGestures: boolean;
    swipeThreshold: number;
    longPressDelay: number;
    doubleTapDelay: number;
    pinchThreshold: number;
    adaptiveUI: boolean;
    offlineMode: boolean;
}

class MobileOptimizationService {
    private config: MobileConfig = {
        enableTouchGestures: true,
        swipeThreshold: 50,
        longPressDelay: 500,
        doubleTapDelay: 300,
        pinchThreshold: 0.1,
        adaptiveUI: true,
        offlineMode: true
    };

    private gestureCallbacks: Map<string, (gesture: TouchGesture) => void> = new Map();
    private activeGestures: Map<string, any> = new Map();
    private deviceInfo: DeviceInfo;

    constructor() {
        this.deviceInfo = this.detectDevice();
        this.initializeTouchHandlers();
        this.setupOrientationListener();
        console.log('📱 Mobile Optimization Service inicializado:', this.deviceInfo);
    }

    /**
     * Detecta información del dispositivo
     */
    private detectDevice(): DeviceInfo {
        const userAgent = navigator.userAgent.toLowerCase();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Detectar tipo de dispositivo
        const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || screenWidth < 768;
        const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) || (screenWidth >= 768 && screenWidth < 1024);
        const isDesktop = !isMobile && !isTablet;

        // Determinar tamaño de pantalla
        let screenSize: DeviceInfo['screenSize'] = 'small';
        if (screenWidth >= 1536) screenSize = 'xlarge';
        else if (screenWidth >= 1024) screenSize = 'large';
        else if (screenWidth >= 768) screenSize = 'medium';

        // Detectar orientación
        const orientation = screenWidth > screenHeight ? 'landscape' : 'portrait';

        // Detectar soporte táctil
        const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Detectar plataforma
        let platform = 'unknown';
        if (/iphone|ipad|ipod/i.test(userAgent)) platform = 'ios';
        else if (/android/i.test(userAgent)) platform = 'android';
        else if (/windows/i.test(userAgent)) platform = 'windows';
        else if (/mac/i.test(userAgent)) platform = 'mac';

        return {
            isMobile,
            isTablet,
            isDesktop,
            screenSize,
            orientation,
            touchSupport,
            platform
        };
    }

    /**
     * Inicializa manejadores de gestos táctiles
     */
    private initializeTouchHandlers(): void {
        if (!this.config.enableTouchGestures || !this.deviceInfo.touchSupport) return;

        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        let lastTapTime = 0;
        let longPressTimer: NodeJS.Timeout | null = null;

        // Touch Start
        document.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };

            // Configurar long press
            longPressTimer = setTimeout(() => {
                this.handleGesture({
                    type: 'long-press',
                    startX: touchStartPos.x,
                    startY: touchStartPos.y,
                    endX: touchStartPos.x,
                    endY: touchStartPos.y,
                    duration: Date.now() - touchStartTime,
                    distance: 0
                });
            }, this.config.longPressDelay);
        });

        // Touch End
        document.addEventListener('touchend', (e) => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            const touchEndTime = Date.now();
            const touchEndPos = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY
            };

            const duration = touchEndTime - touchStartTime;
            const distance = Math.sqrt(
                Math.pow(touchEndPos.x - touchStartPos.x, 2) +
                Math.pow(touchEndPos.y - touchStartPos.y, 2)
            );

            // Detectar tipo de gesto
            if (distance < 10 && duration < 300) {
                // Tap o Double Tap
                const timeSinceLastTap = touchEndTime - lastTapTime;
                
                if (timeSinceLastTap < this.config.doubleTapDelay) {
                    this.handleGesture({
                        type: 'double-tap',
                        startX: touchStartPos.x,
                        startY: touchStartPos.y,
                        endX: touchEndPos.x,
                        endY: touchEndPos.y,
                        duration,
                        distance
                    });
                } else {
                    this.handleGesture({
                        type: 'tap',
                        startX: touchStartPos.x,
                        startY: touchStartPos.y,
                        endX: touchEndPos.x,
                        endY: touchEndPos.y,
                        duration,
                        distance
                    });
                }
                
                lastTapTime = touchEndTime;
            } else if (distance > this.config.swipeThreshold) {
                // Swipe
                const deltaX = touchEndPos.x - touchStartPos.x;
                const deltaY = touchEndPos.y - touchStartPos.y;
                
                let direction: TouchGesture['direction'];
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    direction = deltaX > 0 ? 'right' : 'left';
                } else {
                    direction = deltaY > 0 ? 'down' : 'up';
                }

                this.handleGesture({
                    type: 'swipe',
                    startX: touchStartPos.x,
                    startY: touchStartPos.y,
                    endX: touchEndPos.x,
                    endY: touchEndPos.y,
                    duration,
                    distance,
                    direction
                });
            }
        });

        // Pinch/Zoom gestures
        let initialDistance = 0;
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = this.getDistance(e.touches[0], e.touches[1]);
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const scale = currentDistance / initialDistance;
                
                if (Math.abs(scale - 1) > this.config.pinchThreshold) {
                    this.handleGesture({
                        type: 'pinch',
                        startX: e.touches[0].clientX,
                        startY: e.touches[0].clientY,
                        endX: e.touches[1].clientX,
                        endY: e.touches[1].clientY,
                        duration: 0,
                        distance: currentDistance,
                        scale
                    });
                }
            }
        });
    }

    /**
     * Calcula distancia entre dos puntos táctiles
     */
    private getDistance(touch1: Touch, touch2: Touch): number {
        return Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        );
    }

    /**
     * Maneja gestos detectados
     */
    private handleGesture(gesture: TouchGesture): void {
        console.log('👆 Gesto detectado:', gesture.type, gesture);
        
        // Ejecutar callbacks registrados
        for (const [id, callback] of this.gestureCallbacks.entries()) {
            try {
                callback(gesture);
            } catch (error) {
                console.error(`Error en callback de gesto ${id}:`, error);
            }
        }
    }

    /**
     * Configura listener para cambios de orientación
     */
    private setupOrientationListener(): void {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.deviceInfo = this.detectDevice();
                console.log('📱 Orientación cambiada:', this.deviceInfo.orientation);
                
                // Notificar cambio de orientación
                this.handleGesture({
                    type: 'pan', // Usamos pan para indicar cambio de orientación
                    startX: 0,
                    startY: 0,
                    endX: window.innerWidth,
                    endY: window.innerHeight,
                    duration: 0,
                    distance: 0
                });
            }, 100);
        });

        window.addEventListener('resize', () => {
            this.deviceInfo = this.detectDevice();
        });
    }

    /**
     * Registra callback para gestos
     */
    public onGesture(id: string, callback: (gesture: TouchGesture) => void): void {
        this.gestureCallbacks.set(id, callback);
    }

    /**
     * Desregistra callback de gestos
     */
    public offGesture(id: string): void {
        this.gestureCallbacks.delete(id);
    }

    /**
     * Obtiene información del dispositivo
     */
    public getDeviceInfo(): DeviceInfo {
        return { ...this.deviceInfo };
    }

    /**
     * Verifica si es dispositivo móvil
     */
    public isMobileDevice(): boolean {
        return this.deviceInfo.isMobile || this.deviceInfo.isTablet;
    }

    /**
     * Obtiene clases CSS adaptativas
     */
    public getResponsiveClasses(): string {
        const classes = [];
        
        if (this.deviceInfo.isMobile) classes.push('mobile-device');
        if (this.deviceInfo.isTablet) classes.push('tablet-device');
        if (this.deviceInfo.isDesktop) classes.push('desktop-device');
        
        classes.push(`screen-${this.deviceInfo.screenSize}`);
        classes.push(`orientation-${this.deviceInfo.orientation}`);
        
        if (this.deviceInfo.touchSupport) classes.push('touch-enabled');
        
        return classes.join(' ');
    }

    /**
     * Obtiene configuración de UI adaptativa
     */
    public getAdaptiveUIConfig(): {
        chartHeight: number;
        fontSize: string;
        spacing: string;
        buttonSize: string;
        modalSize: string;
    } {
        const base = {
            chartHeight: 400,
            fontSize: 'text-sm',
            spacing: 'p-4',
            buttonSize: 'px-4 py-2',
            modalSize: 'max-w-2xl'
        };

        if (this.deviceInfo.isMobile) {
            return {
                chartHeight: 300,
                fontSize: 'text-xs',
                spacing: 'p-2',
                buttonSize: 'px-6 py-3',
                modalSize: 'max-w-full mx-2'
            };
        }

        if (this.deviceInfo.isTablet) {
            return {
                chartHeight: 350,
                fontSize: 'text-sm',
                spacing: 'p-3',
                buttonSize: 'px-5 py-2.5',
                modalSize: 'max-w-4xl'
            };
        }

        return base;
    }

    /**
     * Habilita/deshabilita modo offline
     */
    public setOfflineMode(enabled: boolean): void {
        this.config.offlineMode = enabled;
        console.log('🔄 Modo offline:', enabled ? 'habilitado' : 'deshabilitado');
    }

    /**
     * Verifica si está en modo offline
     */
    public isOfflineMode(): boolean {
        return this.config.offlineMode && !navigator.onLine;
    }

    /**
     * Actualiza configuración
     */
    public updateConfig(newConfig: Partial<MobileConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuración móvil actualizada:', this.config);
    }

    /**
     * Obtiene configuración actual
     */
    public getConfig(): MobileConfig {
        return { ...this.config };
    }
}

// Instancia singleton del servicio
export const mobileOptimizationService = new MobileOptimizationService();

// Hook personalizado para usar optimización móvil
export const useMobileOptimization = () => {
    return {
        deviceInfo: mobileOptimizationService.getDeviceInfo(),
        isMobile: mobileOptimizationService.isMobileDevice(),
        responsiveClasses: mobileOptimizationService.getResponsiveClasses(),
        adaptiveUI: mobileOptimizationService.getAdaptiveUIConfig(),
        isOffline: mobileOptimizationService.isOfflineMode(),
        
        onGesture: (id: string, callback: (gesture: TouchGesture) => void) =>
            mobileOptimizationService.onGesture(id, callback),
        
        offGesture: (id: string) =>
            mobileOptimizationService.offGesture(id),
        
        setOfflineMode: (enabled: boolean) =>
            mobileOptimizationService.setOfflineMode(enabled),
        
        updateConfig: (config: Partial<MobileConfig>) =>
            mobileOptimizationService.updateConfig(config)
    };
};

export type { DeviceInfo, TouchGesture, MobileConfig };