/**
 * Servicio de Carga Progresiva (Lazy Loading) para Datos Grandes
 * Optimiza el rendimiento cargando datos en lotes progresivos
 */

interface LazyLoadConfig {
    batchSize: number;
    maxConcurrentRequests: number;
    delayBetweenBatches: number;
    priorityThreshold: number; // Score de riesgo para priorizar carga
}

interface LoadBatch {
    offset: number;
    limit: number;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'loading' | 'completed' | 'error';
    data?: any[];
    error?: string;
}

interface LazyLoadState {
    totalRows: number;
    loadedRows: number;
    batches: LoadBatch[];
    isLoading: boolean;
    progress: number;
    currentBatch: number;
    estimatedTimeRemaining: number;
}

class LazyLoadingService {
    private config: LazyLoadConfig = {
        batchSize: 500,           // 500 registros por lote
        maxConcurrentRequests: 3, // Máximo 3 requests simultáneos
        delayBetweenBatches: 100, // 100ms entre lotes
        priorityThreshold: 75     // Score > 75 = alta prioridad
    };

    private activeRequests: Set<number> = new Set();
    private loadStartTime: number = 0;

    /**
     * Calcula los lotes necesarios para cargar todos los datos
     */
    private calculateBatches(totalRows: number): LoadBatch[] {
        const batches: LoadBatch[] = [];
        const totalBatches = Math.ceil(totalRows / this.config.batchSize);

        for (let i = 0; i < totalBatches; i++) {
            const offset = i * this.config.batchSize;
            const limit = Math.min(this.config.batchSize, totalRows - offset);
            
            // Los primeros lotes tienen prioridad alta para mostrar datos rápido
            const priority = i < 3 ? 'high' : i < 10 ? 'medium' : 'low';

            batches.push({
                offset,
                limit,
                priority,
                status: 'pending'
            });
        }

        return batches;
    }

    /**
     * Carga datos de forma progresiva con priorización
     */
    public async loadDataProgressively(
        populationId: string,
        totalRows: number,
        onProgress: (state: LazyLoadState) => void,
        onBatchLoaded: (data: any[], batchIndex: number) => void,
        onComplete: (allData: any[]) => void,
        onError: (error: string) => void
    ): Promise<void> {
        this.loadStartTime = Date.now();
        const batches = this.calculateBatches(totalRows);
        let allData: any[] = [];
        let completedBatches = 0;

        const state: LazyLoadState = {
            totalRows,
            loadedRows: 0,
            batches,
            isLoading: true,
            progress: 0,
            currentBatch: 0,
            estimatedTimeRemaining: 0
        };

        console.log(`🚀 Lazy Loading: Iniciando carga de ${totalRows} registros en ${batches.length} lotes`);

        try {
            // Procesar lotes por prioridad
            const highPriorityBatches = batches.filter(b => b.priority === 'high');
            const mediumPriorityBatches = batches.filter(b => b.priority === 'medium');
            const lowPriorityBatches = batches.filter(b => b.priority === 'low');

            // Cargar lotes de alta prioridad primero
            await this.processBatchGroup(
                highPriorityBatches, 
                populationId, 
                (data, batchIndex) => {
                    allData.push(...data);
                    completedBatches++;
                    
                    state.loadedRows += data.length;
                    state.progress = (completedBatches / batches.length) * 100;
                    state.currentBatch = completedBatches;
                    state.estimatedTimeRemaining = this.calculateETA(completedBatches, batches.length);
                    
                    onProgress(state);
                    onBatchLoaded(data, batchIndex);
                }
            );

            // Cargar lotes de prioridad media
            await this.processBatchGroup(
                mediumPriorityBatches, 
                populationId, 
                (data, batchIndex) => {
                    allData.push(...data);
                    completedBatches++;
                    
                    state.loadedRows += data.length;
                    state.progress = (completedBatches / batches.length) * 100;
                    state.currentBatch = completedBatches;
                    state.estimatedTimeRemaining = this.calculateETA(completedBatches, batches.length);
                    
                    onProgress(state);
                    onBatchLoaded(data, batchIndex);
                }
            );

            // Cargar lotes de baja prioridad
            await this.processBatchGroup(
                lowPriorityBatches, 
                populationId, 
                (data, batchIndex) => {
                    allData.push(...data);
                    completedBatches++;
                    
                    state.loadedRows += data.length;
                    state.progress = (completedBatches / batches.length) * 100;
                    state.currentBatch = completedBatches;
                    state.estimatedTimeRemaining = this.calculateETA(completedBatches, batches.length);
                    
                    onProgress(state);
                    onBatchLoaded(data, batchIndex);
                }
            );

            state.isLoading = false;
            state.progress = 100;
            onProgress(state);
            onComplete(allData);

            console.log(`✅ Lazy Loading: Completado en ${Date.now() - this.loadStartTime}ms`);

        } catch (error) {
            console.error('❌ Lazy Loading: Error durante la carga:', error);
            onError(error instanceof Error ? error.message : 'Error desconocido');
        }
    }

    /**
     * Procesa un grupo de lotes con control de concurrencia
     */
    private async processBatchGroup(
        batches: LoadBatch[],
        populationId: string,
        onBatchComplete: (data: any[], batchIndex: number) => void
    ): Promise<void> {
        const promises: Promise<void>[] = [];

        for (let i = 0; i < batches.length; i++) {
            // Controlar concurrencia
            while (this.activeRequests.size >= this.config.maxConcurrentRequests) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            const batch = batches[i];
            const batchIndex = i;

            const promise = this.loadBatch(populationId, batch, batchIndex)
                .then(data => {
                    onBatchComplete(data, batchIndex);
                })
                .finally(() => {
                    this.activeRequests.delete(batchIndex);
                });

            this.activeRequests.add(batchIndex);
            promises.push(promise);

            // Delay entre lotes para no sobrecargar el servidor
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
            }
        }

        await Promise.all(promises);
    }

    /**
     * Carga un lote individual de datos
     */
    private async loadBatch(
        populationId: string, 
        batch: LoadBatch, 
        batchIndex: number
    ): Promise<any[]> {
        batch.status = 'loading';

        try {
            const response = await fetch(
                `/api/get_validation_data?id=${populationId}&offset=${batch.offset}&limit=${batch.limit}`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const { rows } = await response.json();
            
            batch.status = 'completed';
            batch.data = rows;

            console.log(`📦 Lote ${batchIndex + 1}: Cargados ${rows.length} registros (${batch.offset}-${batch.offset + batch.limit})`);

            return rows;

        } catch (error) {
            batch.status = 'error';
            batch.error = error instanceof Error ? error.message : 'Error desconocido';
            
            console.error(`❌ Error en lote ${batchIndex + 1}:`, error);
            throw error;
        }
    }

    /**
     * Calcula el tiempo estimado restante
     */
    private calculateETA(completedBatches: number, totalBatches: number): number {
        if (completedBatches === 0) return 0;

        const elapsedTime = Date.now() - this.loadStartTime;
        const avgTimePerBatch = elapsedTime / completedBatches;
        const remainingBatches = totalBatches - completedBatches;
        
        return Math.round((remainingBatches * avgTimePerBatch) / 1000); // En segundos
    }

    /**
     * Actualiza la configuración del lazy loading
     */
    public updateConfig(newConfig: Partial<LazyLoadConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Lazy Loading: Configuración actualizada', this.config);
    }

    /**
     * Obtiene la configuración actual
     */
    public getConfig(): LazyLoadConfig {
        return { ...this.config };
    }

    /**
     * Cancela todas las cargas en progreso
     */
    public cancelLoading(): void {
        this.activeRequests.clear();
        console.log('🛑 Lazy Loading: Carga cancelada');
    }
}

// Instancia singleton del servicio
export const lazyLoadingService = new LazyLoadingService();

// Hook personalizado para usar lazy loading en componentes React
export const useLazyLoading = () => {
    return {
        loadProgressively: (
            populationId: string,
            totalRows: number,
            onProgress: (state: LazyLoadState) => void,
            onBatchLoaded: (data: any[], batchIndex: number) => void,
            onComplete: (allData: any[]) => void,
            onError: (error: string) => void
        ) => lazyLoadingService.loadDataProgressively(
            populationId, totalRows, onProgress, onBatchLoaded, onComplete, onError
        ),
        
        updateConfig: (config: Partial<LazyLoadConfig>) => 
            lazyLoadingService.updateConfig(config),
        
        getConfig: () => lazyLoadingService.getConfig(),
        
        cancel: () => lazyLoadingService.cancelLoading()
    };
};

export type { LazyLoadState, LazyLoadConfig };